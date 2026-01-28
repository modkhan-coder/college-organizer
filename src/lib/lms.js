/**
 * LMS Integration Library
 * Standardizes interactions with Canvas, Blackboard, and Moodle APIs
 */

export const LMS_PROVIDERS = {
    CANVAS: 'canvas',
    BLACKBOARD: 'blackboard',
    MOODLE: 'moodle'
};

// URL for the Supabase Edge Function Proxy
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lms-proxy`;

/**
 * Generate the OAuth 2.0 Authorization URL for Canvas
 */
export const getCanvasAuthUrl = (instanceUrl, clientId) => {
    const baseUrl = instanceUrl.startsWith('http') ? instanceUrl : `https://${instanceUrl}`;
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lms-callback`;

    return `${baseUrl}/login/oauth2/auth?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=url:get|/api/v1/courses url:get|/api/v1/courses/:id/assignments`;
};

/**
 * Fetch courses from the connected LMS
 * @param {Object} connection - The database record from lms_connections
 */
export const fetchLMSCourses = async (connection) => {
    const { provider, instance_url, access_token } = connection;
    const isMock = !access_token || access_token === '' || access_token.startsWith('mock_token_');
    const baseUrl = instance_url?.startsWith('http') ? instance_url : `https://${instance_url || 'canvas.instructure.com'}`;

    try {
        if (provider === LMS_PROVIDERS.CANVAS) {
            if (isMock) {
                return [
                    { lms_id: 'canvas_c1', name: 'Introduction to Psychology', code: 'PSYCH 101', term: 'Spring 2026' },
                    { lms_id: 'canvas_c2', name: 'Calculus II', code: 'MATH 221', term: 'Spring 2026' },
                    { lms_id: 'canvas_c3', name: 'Organic Chemistry', code: 'CHEM 230', term: 'Spring 2026' },
                    { lms_id: 'canvas_c4', name: 'Art History', code: 'ARTS 105', term: 'Fall 2025' }
                ];
            }

            // REAL CANVAS API CALL (via PROXY)
            const apiUrl = `${baseUrl}/api/v1/courses?enrollment_state=active`;

            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ provider, apiUrl, token: access_token })
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("LMS Proxy Edge Function not found. Please ensure it's deployed to your Supabase project.");
                if (response.status === 401) throw new Error("Invalid or expired Canvas token. Please reconnect with a fresh API key.");
                throw new Error(`Canvas API Error (${response.status}): ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            return data.map(c => ({
                lms_id: String(c.id),
                name: c.name,
                code: c.course_code,
                term: c.term?.name || 'Current Term',
                grading_standard_id: c.grading_standard_id
            }));
        }

        // ... Blackboard/Moodle mock blocks ...
        return provider === LMS_PROVIDERS.MOODLE ? [
            { lms_id: 'm_c1', name: 'World History', code: 'HIST 110', term: 'Spring 2026' }
        ] : [
            { lms_id: 'bb_c1', name: 'Microeconomics', code: 'ECON 201', term: 'Spring 2026' }
        ];
    } catch (error) {
        console.error(`LMS Error (${provider}):`, error);
        throw error;
    }
};

export const fetchLMSAssignments = async (connection, lmsCourseId) => {
    const { provider, instance_url, access_token } = connection;
    const isMock = !access_token || access_token === '' || access_token.startsWith('mock_token_');
    const baseUrl = instance_url?.startsWith('http') ? instance_url : `https://${instance_url || 'canvas.instructure.com'}`;

    try {
        if (provider === LMS_PROVIDERS.CANVAS) {
            if (isMock) {
                return [
                    { lms_id: `canvas_a_${lmsCourseId}_1`, title: 'Midterm Essay', due_date: new Date(Date.now() + 86400000 * 3).toISOString(), points_possible: 100, lms_status: 'missing', assignment_group_id: 'canvas_g2' },
                    { lms_id: `canvas_a_${lmsCourseId}_2`, title: 'Weekly Quiz 4', due_date: new Date(Date.now() + 86400000 * 1).toISOString(), points_possible: 10, lms_status: 'graded', points_earned: 9, assignment_group_id: 'canvas_g1' }
                ];
            }

            // REAL CANVAS API CALL (via PROXY)
            // Added include[]=submission to get grades, and per_page=100 to fetch more items
            const apiUrl = `${baseUrl}/api/v1/courses/${lmsCourseId}/assignments?include[]=submission&per_page=100`;

            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ provider, apiUrl, token: access_token })
            });

            if (!response.ok) throw new Error(`Canvas Assignment Sync Error: ${response.statusText}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            return data.map(a => {
                const submission = a.submission;
                let status = 'missing';
                if (submission) {
                    if (submission.workflow_state === 'graded' || submission.score !== undefined && submission.score !== null) {
                        status = 'graded';
                    } else if (submission.workflow_state === 'submitted') {
                        status = 'submitted';
                    }
                }

                return {
                    lms_id: String(a.id),
                    title: a.name,
                    due_date: a.due_at,
                    points_possible: a.points_possible,
                    points_earned: (submission?.score !== undefined && submission.score !== null) ? submission.score : null,
                    lms_status: status,
                    assignment_group_id: String(a.assignment_group_id)
                };
            });
        }
        return [];
    } catch (error) {
        console.error(`LMS Assignment Error (${provider}):`, error);
        throw error;
    }
};

/**
 * Fetch grading categories (assignment groups) for a course
 */
export const fetchLMSGrading = async (connection, lmsCourseId) => {
    const { provider, instance_url, access_token } = connection;
    const isMock = !access_token || access_token === '' || access_token.startsWith('mock_token_');
    const baseUrl = instance_url?.startsWith('http') ? instance_url : `https://${instance_url || 'canvas.instructure.com'}`;

    try {
        if (provider === LMS_PROVIDERS.CANVAS) {
            if (isMock) {
                return [
                    { id: 'canvas_g1', name: 'Homework', weight: 20 },
                    { id: 'canvas_g2', name: 'Quizzes', weight: 30 },
                    { id: 'canvas_g3', name: 'Midterm', weight: 20 },
                    { id: 'canvas_g4', name: 'Final Exam', weight: 30 }
                ];
            }

            // REAL CANVAS API CALL: /api/v1/courses/:id/assignment_groups
            const apiUrl = `${baseUrl}/api/v1/courses/${lmsCourseId}/assignment_groups`;
            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ provider, apiUrl, token: access_token })
            });

            if (!response.ok) return []; // Fallback to defaults
            const data = await response.json();

            return data.map(g => ({
                id: String(g.id),
                name: g.name,
                weight: g.group_weight || 0
            }));
        }
        return [];
    } catch (error) {
        console.error('Grading fetch error:', error);
        return [];
    }
};

/**
 * Standardizes LMS data into the App's internal format
 */
export const mapLMSCourseToApp = (lmsCourse, provider, categories = null) => ({
    name: lmsCourse.name,
    code: lmsCourse.code,
    lms_provider: provider,
    lms_id: lmsCourse.lms_id,
    sync_enabled: true,
    color: '#6366f1', // Default indigo
    credits: 3,
    categories: categories || [
        { id: 'cat1', name: 'Assignments', weight: 40 },
        { id: 'cat2', name: 'Exams', weight: 60 }
    ]
});

export const mapLMSAssignmentToApp = (lmsAssign, courseId, categoryId = 'cat1') => ({
    courseId: courseId,
    title: lmsAssign.title,
    dueDate: lmsAssign.due_date,
    pointsPossible: lmsAssign.points_possible,
    pointsEarned: lmsAssign.points_earned,
    lms_id: lmsAssign.lms_id,
    lms_source: true,
    lms_status: lmsAssign.lms_status,
    categoryId: categoryId
});

/**
 * Fetch the specific grading scale (e.g. A=90-100)
 */
export const fetchLMSGradingScale = async (connection, lmsCourseId, gradingStandardId) => {
    const { provider, instance_url, access_token } = connection;
    const isMock = !access_token || access_token === '' || access_token.startsWith('mock_token_');
    const baseUrl = instance_url?.startsWith('http') ? instance_url : `https://${instance_url || 'canvas.instructure.com'}`;

    if (!gradingStandardId && !isMock) return null;

    try {
        if (provider === LMS_PROVIDERS.CANVAS) {
            if (isMock) {
                return [
                    { label: 'A', min: 90 },
                    { label: 'B', min: 80 },
                    { label: 'C', min: 70 },
                    { label: 'D', min: 60 },
                    { label: 'F', min: 0 }
                ];
            }

            const apiUrl = gradingStandardId
                ? `${baseUrl}/api/v1/grading_standards/${gradingStandardId}`
                : `${baseUrl}/api/v1/courses/${lmsCourseId}/grading_standards`;

            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ provider, apiUrl, token: access_token })
            });

            if (!response.ok) return null;
            const data = await response.json();

            const standard = Array.isArray(data) ? data[0] : data;
            if (!standard?.grading_scheme) return null;

            return standard.grading_scheme.map(s => ({
                label: s.name,
                min: s.value * 100
            }));
        }
        return null;
    } catch (error) {
        console.error('Scale fetch error:', error);
        return null;
    }
};
