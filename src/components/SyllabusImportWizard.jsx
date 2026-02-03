import { useState, useEffect, useRef } from 'react';
import { FileText, Edit3, Upload, Brain, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SyllabusImportWizard = ({ onClose, onComplete, user }) => {
    const [step, setStep] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfId, setPdfId] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const [editedData, setEditedData] = useState(null);
    const [extractionTrigger, setExtractionTrigger] = useState(0);
    const [createdCourseId, setCreatedCourseId] = useState(null);
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    // Aggressive cleanup removed to prevent React Strict Mode from deleting valid courses.
    // relying on 'Clean Ghost Courses' button or explicit cancel for cleanup.

    // Effect to trigger extraction after step change
    useEffect(() => {
        if (step === 2 && extractionTrigger > 0) {
            handleExtraction();
        }
    }, [step, extractionTrigger]);

    // Step 1: Upload PDF
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a PDF file');
            return;
        }

        setPdfFile(file);
        setUploading(true);

        try {
            // Upload to temp storage (we'll process it later)
            const fileName = `temp_syllabus_${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage
                .from('course_materials')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            setPdfId(fileName);
            setExtractionTrigger(prev => prev + 1);
            setStep(2);
        } catch (error) {
            console.error('Upload error:', error.message || error);
            alert('Failed to upload PDF');
        } finally {
            setUploading(false);
        }
    };

    // Step 2: AI Extraction
    const handleExtraction = async () => {
        if (extracting) return;
        setExtracting(true);

        const currentPdfId = pdfId;
        const currentFile = pdfFile;

        try {
            console.log('[Wizard] Starting extraction pipeline...');

            if (!currentFile || !currentPdfId) {
                throw new Error('Upload verification failed. Please try uploading the PDF again.');
            }

            // First, create a temporary course to get an ID
            const tempCourse = {
                user_id: user.id,
                code: 'TEMP',
                name: 'Processing...',
                credits: 0
            };

            const { data: course, error: courseError } = await supabase
                .from('courses')
                .insert(tempCourse)
                .select()
                .single();

            if (courseError) throw new Error(`Course Creation: ${courseError.message}`);

            setCreatedCourseId(course.id);

            // Create PDF record
            const { data: pdf, error: pdfError } = await supabase
                .from('pdf_files')
                .insert({
                    user_id: user.id,
                    course_id: course.id,
                    file_name: currentFile.name,
                    file_path: currentPdfId,
                    num_pages: 1
                })
                .select()
                .single();

            if (pdfError) throw new Error(`PDF Record: ${pdfError.message}`);

            console.log('PDF record created:', pdf.id);

            // Step 1: Start (Async)
            setStatusText('Connecting to AI...');
            const { data: startData, error: startError } = await supabase.functions.invoke('extract-pdf-text', {
                body: { pdf_id: pdf.id, user_id: user.id, course_id: course.id, action: 'start' },
                headers: { 'Authorization': `Bearer ${anonKey}` }
            });

            if (startError) throw new Error(`AI Start (Connection): ${startError.message}`);
            if (!startData?.success) {
                console.error('[Wizard] AI Start Error Response:', startData);
                throw new Error(`AI Start Response: ${startData?.error || 'Unknown error'}`);
            }

            const { assistant_id, thread_id, run_id } = startData;

            // Step 2: Poll
            let isCompleted = false;
            let pollAttempts = 0;
            const maxPolls = 75; // 5 minutes total (75 * 4s)
            let consecutiveErrors = 0;

            while (!isCompleted && pollAttempts < maxPolls) {
                pollAttempts++;
                setStatusText(`AI is reading PDF... (${pollAttempts * 4}s)`);

                await new Promise(r => setTimeout(r, 4000));

                try {
                    const { data: pollData, error: pollError } = await supabase.functions.invoke('extract-pdf-text', {
                        body: {
                            pdf_id: pdf.id,
                            user_id: user.id,
                            course_id: course.id,
                            action: 'poll',
                            assistant_id,
                            thread_id,
                            run_id
                        },
                        headers: { 'Authorization': `Bearer ${anonKey}` }
                    });

                    if (pollError) throw pollError;

                    if (pollData?.success) {
                        consecutiveErrors = 0;
                        if (pollData.status === 'completed') {
                            isCompleted = true;
                        } else if (['failed', 'expired', 'cancelled'].includes(pollData.status)) {
                            throw new Error(`AI Status: ${pollData.status}`);
                        } else {
                            setStatusText(`AI is still thinking... (${pollData.status})`);
                        }
                    } else {
                        throw new Error(pollData?.error || 'Polling error');
                    }
                } catch (err) {
                    consecutiveErrors++;
                    console.log(`Poll attempt ${pollAttempts} failed:`, err.message || 'Connection lost');
                    if (consecutiveErrors >= 3) {
                        throw new Error(`Connection Lost: AI is unreachable after 3 attempts.`);
                    }
                }
            }

            if (!isCompleted) throw new Error('Extraction Timed Out: Please try a shorter PDF.');

            // Step 3: Analysis (ASYNC - Now Supporting Infinite Size)
            setStatusText('Starting AI structure analysis (RAG Mode)...');
            let analysisStart;
            try {
                const { data: sData, error: sErr } = await supabase.functions.invoke('extract-syllabus', {
                    body: { pdf_id: pdf.id, course_id: course.id, user_id: user.id, action: 'start' },
                    headers: { 'Authorization': `Bearer ${anonKey}` }
                });
                if (sErr || !sData?.success) throw new Error(sErr?.message || sData?.error || 'Analysis start failed');
                analysisStart = sData;
            } catch (err) {
                console.warn('[Analysis Start Failed] Falling back to manual entry:', err.message);
                const fallbackData = {
                    course_info: { title: currentFile.name.replace('.pdf', ''), instructor_name: '', instructor_email: '', location: '', meeting_times: '' },
                    office_hours: [], grading_policy: [{ category: 'Assignments', weight: 100 }], key_dates: [], assignments: [], policies: []
                };
                setExtractedData(fallbackData);
                setEditedData(JSON.parse(JSON.stringify(fallbackData)));
                setStep(3);
                return;
            }

            const { assistant_id: aAsstId, thread_id: aThId, run_id: aRunId } = analysisStart;

            // Step 3.1: Poll Analysis
            let aCompleted = false;
            let aAttempts = 0;
            const aMaxPolls = 60; // 4 minutes

            while (!aCompleted && aAttempts < aMaxPolls) {
                aAttempts++;
                setStatusText(`AI is analyzing categories... (${aAttempts * 4}s)`);
                await new Promise(r => setTimeout(r, 4000));

                try {
                    const { data: aPollData, error: aPollError } = await supabase.functions.invoke('extract-syllabus', {
                        body: {
                            action: 'poll', pdf_id: pdf.id, user_id: user.id, course_id: course.id,
                            assistant_id: aAsstId, thread_id: aThId, run_id: aRunId
                        },
                        headers: { 'Authorization': `Bearer ${anonKey}` }
                    });

                    if (aPollError) throw aPollError;

                    if (aPollData?.success) {
                        if (aPollData.status === 'completed') {
                            setExtractedData(aPollData.data);
                            setEditedData(JSON.parse(JSON.stringify(aPollData.data)));
                            aCompleted = true;
                            setStep(3);
                        } else if (['failed', 'expired', 'cancelled'].includes(aPollData.status)) {
                            throw new Error(`Analysis failed: ${aPollData.status}`);
                        }
                    }
                } catch (err) {
                    console.warn('Analysis poll attempt failed:', err.message);
                }
            }

            if (!aCompleted) {
                console.warn('[Analysis Timeout] Falling back to manual entry');
                const fallbackData = {
                    course_info: { title: currentFile.name.replace('.pdf', ''), instructor_name: '', instructor_email: '', location: '', meeting_times: '' },
                    office_hours: [], grading_policy: [{ category: 'Assignments', weight: 100 }], key_dates: [], assignments: [], policies: []
                };
                setExtractedData(fallbackData);
                setEditedData(JSON.parse(JSON.stringify(fallbackData)));
                setStep(3);
                alert("AI Note: Analysis is taking longer than expected. We've loaded the manual review for you.");
            }
        } catch (error) {
            console.error('[Extraction Pipeline Error]', error.message || 'Critical failure');
            alert(`AI Extraction Error:\n\n${error.message}\n\nPlease refresh and try again.`);
            setStep(1);
        } finally {
            setExtracting(false);
            setStatusText('');
        }
    };

    const handleClose = () => {
        // Explicit cleanup on manual close
        if (createdCourseId && !isFinishedRef.current) {
            console.log('[Wizard] User cancelled, cleaning up draft:', createdCourseId);
            supabase.from('courses').delete().eq('id', createdCourseId).then(({ error }) => {
                if (error) console.log('Cleanup error (ignorable):', error.message);
            });
        }
        onClose();
    };

    // Step 3-5: Review sections
    const handleDataEdit = (section, index, field, value) => {
        const updated = { ...editedData };
        if (index !== null) {
            updated[section][index][field] = value;
        } else {
            updated[section][field] = value;
        }
        setEditedData(updated);
    };

    // Final: Create Course
    const handleCreateCourse = async () => {
        try {
            const courseData = {
                id: createdCourseId, // Pass the ID so Courses.jsx knows to UPDATE instead of INSERT
                code: editedData.course_info.course_code || editedData.course_info.title.split(' ')[0] || 'COURSE',
                name: editedData.course_info.title,
                credits: 3,
                instructor: editedData.course_info.instructor_name,
                categories: editedData.grading_policy.map(cat => ({
                    id: crypto.randomUUID(),
                    name: cat.category,
                    weight: cat.weight
                }))
            };

            isFinishedRef.current = true; // Prevent cleanup effect
            onComplete(courseData);
        } catch (error) {
            console.error('Create course error:', error);
            alert('Failed to create course');
        }
    };

    return (
        <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
            {/* Step Indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                {[1, 2, 3, 4].map(s => (
                    <div key={s} style={{
                        width: '40px',
                        height: '4px',
                        background: s <= step ? 'var(--primary)' : '#e2e8f0',
                        borderRadius: '2px',
                        transition: 'background 0.3s'
                    }} />
                ))}
            </div>

            {/* Step 1: Upload */}
            {step === 1 && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                    <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                    <h2 style={{ marginBottom: '8px' }}>Upload Your Syllabus</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Upload a PDF of your course syllabus and we'll extract all the important information.
                    </p>

                    <label className="btn btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                        <Upload size={18} /> {uploading ? 'Uploading...' : 'Choose PDF File'}
                        <input
                            type="file"
                            accept=".pdf"
                            hidden
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>
            )}

            {/* Step 2: Extraction */}
            {step === 2 && (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{
                        display: 'inline-block',
                        animation: 'pulse 1.5s ease-in-out infinite'
                    }}>
                        <Brain size={64} style={{ color: 'var(--primary)' }} />
                    </div>
                    <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>Reading Your Syllabus...</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {statusText || "Extracting text and analyzing course information..."}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '16px' }}>
                        This usually takes 30-60 seconds
                    </p>
                </div>
            )}

            {/* Step 3: Review Course Info */}
            {step === 3 && editedData && (
                <div>
                    <h2 style={{ marginBottom: '16px' }}>Review Course Information</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="form-label">Course Title</label>
                            <input
                                className="input-field"
                                value={editedData?.course_info?.title || ''}
                                onChange={e => handleDataEdit('course_info', null, 'title', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label">Instructor</label>
                            <input
                                className="input-field"
                                value={editedData?.course_info?.instructor_name || ''}
                                onChange={e => handleDataEdit('course_info', null, 'instructor_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label">Email</label>
                            <input
                                className="input-field"
                                type="email"
                                value={editedData?.course_info?.instructor_email || ''}
                                onChange={e => handleDataEdit('course_info', null, 'instructor_email', e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label className="form-label">Meeting Times</label>
                                <input
                                    className="input-field"
                                    value={editedData?.course_info?.meeting_times || ''}
                                    onChange={e => handleDataEdit('course_info', null, 'meeting_times', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label">Location</label>
                                <input
                                    className="input-field"
                                    value={editedData?.course_info?.location || ''}
                                    onChange={e => handleDataEdit('course_info', null, 'location', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={() => setStep(4)}>
                            Next: Grading <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Review Grading */}
            {step === 4 && editedData && (
                <div>
                    <h2 style={{ marginBottom: '16px' }}>Review Grading Policy</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {editedData.grading_policy.map((cat, idx) => (
                            <div key={idx} style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr',
                                gap: '12px',
                                padding: '12px',
                                background: 'var(--bg-surface)',
                                borderRadius: '8px'
                            }}>
                                <input
                                    className="input-field"
                                    placeholder="Category name"
                                    value={cat.category}
                                    onChange={e => handleDataEdit('grading_policy', idx, 'category', e.target.value)}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        className="input-field"
                                        type="number"
                                        placeholder="Weight"
                                        value={cat.weight}
                                        onChange={e => handleDataEdit('grading_policy', idx, 'weight', parseFloat(e.target.value))}
                                    />
                                    <span>%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'space-between' }}>
                        <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateCourse}>
                                <CheckCircle2 size={16} /> Create Course
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SyllabusImportWizard;
