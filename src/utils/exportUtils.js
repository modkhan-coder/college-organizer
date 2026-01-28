export const generateICS = (assignments = [], tasks = [], courses = []) => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//College Organizer//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    // Ensure we handle null/undefined inputs safely
    const safeAssignments = Array.isArray(assignments) ? assignments : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeCourses = Array.isArray(courses) ? courses : [];

    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // 1. Assignments & One-time Tasks
    const allItems = [
        ...safeAssignments.map(a => ({ ...a, type: 'assignment' })),
        ...safeTasks.map(t => ({ ...t, type: 'task' }))
    ];

    allItems.forEach(item => {
        if (!item.dueDate) return;
        const isRecurring = item.recurrence && item.recurrence.frequency === 'weekly';

        // Basic Date formatting
        const datePart = item.dueDate.substring(0, 10);
        const dateStr = datePart.replace(/-/g, '');
        if (dateStr.length !== 8) return;

        const title = item.title || 'Untitled';
        const courseName = courses.find(c => c.id === item.courseId)?.code || 'General';
        const description = item.type === 'assignment'
            ? `Assignment for ${courseName}\\nDetails: ${item.details || 'None'}`
            : `Study Task: ${item.title}`;

        const uid = `${item.id}@collegeorganizer`;

        icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${dateStr}
DTEND;VALUE=DATE:${dateStr}
SUMMARY:${title} (${item.type === 'assignment' ? 'Due' : 'Task'})
DESCRIPTION:${description}
STATUS:${item.completed || item.pointsEarned ? 'CONFIRMED' : 'TENTATIVE'}
UID:${uid}
DTSTAMP:${dtStamp}
${isRecurring ? 'RRULE:FREQ=WEEKLY;UNTIL=20260530T000000Z' : ''}
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Reminder: ${title} is due tomorrow!
END:VALARM
END:VEVENT
`;
    });

    // 2. Class Schedules (Recurring)
    const dayMap = { 'Mon': 'MO', 'Tue': 'TU', 'Wed': 'WE', 'Thu': 'TH', 'Fri': 'FR', 'Sat': 'SA', 'Sun': 'SU' };

    safeCourses.forEach(course => {
        if (course.schedule && Array.isArray(course.schedule)) {
            course.schedule.forEach((slot, idx) => {
                if (!slot.day || !slot.start || !slot.end) return;

                // Determine next occurrence of this day
                // We'll just start "today" if today matches, or find next match
                const targetDayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(slot.day);
                if (targetDayIndex === -1) return;

                const startDateTime = new Date();
                const currentDayIndex = startDateTime.getDay();
                let dayDiff = targetDayIndex - currentDayIndex;
                if (dayDiff < 0) dayDiff += 7; // if target is earlier in week, move to next week

                startDateTime.setDate(startDateTime.getDate() + dayDiff);

                // Parse Time HH:MM
                const [startH, startM] = slot.start.split(':').map(Number);
                const [endH, endM] = slot.end.split(':').map(Number);

                startDateTime.setHours(startH, startM, 0);
                const endDateTime = new Date(startDateTime);
                endDateTime.setHours(endH, endM, 0);

                const formatDateParams = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const startStr = formatDateParams(startDateTime);
                const endStr = formatDateParams(endDateTime);
                const rruleDay = dayMap[slot.day] || 'MO';

                icsContent += `BEGIN:VEVENT
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:${course.code} Class
LOCATION:${slot.location || ''}
RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};UNTIL=20260530T000000Z
UID:${course.id}-class-${idx}@collegeorganizer
DTSTAMP:${dtStamp}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Class starts in 15 minutes
END:VALARM
END:VEVENT
`;
            });
        }
    });

    icsContent += 'END:VCALENDAR';
    return icsContent;
};

export const generateCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(it => {
        return headers.map(header => {
            const value = it[header] === null || it[header] === undefined ? '' : it[header];
            // Simple CSV quoting: Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

export const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
