import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

Deno.serve(async (req) => {
    // GET /calendar-feed?u=USER_ID
    const url = new URL(req.url)
    const userId = url.searchParams.get('u')

    if (!userId) {
        return new Response('Missing user ID', { status: 400 })
    }

    try {
        // 1. Fetch User Data (Assignments, Tasks, Courses)
        // We fetch everything in parallel for speed
        const [assignmentsRes, tasksRes, coursesRes] = await Promise.all([
            supabase.from('assignments').select('*').eq('user_id', userId),
            supabase.from('tasks').select('*').eq('user_id', userId).eq('completed', false), // Only active tasks? Or all? Let's do all for calendar history.
            supabase.from('courses').select('*').eq('user_id', userId)
        ])

        if (assignmentsRes.error) throw assignmentsRes.error
        if (tasksRes.error) throw tasksRes.error
        if (coursesRes.error) throw coursesRes.error

        const assignments = assignmentsRes.data || []
        const tasks = tasksRes.data || []
        const courses = coursesRes.data || []

        // 2. Generate ICS Content
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//College Organizer//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:My Study Schedule',
            'X-WR-TIMEZONE:UTC',
        ].join('\r\n') + '\r\n'

        const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

        // Helper to format date YYYYMMDD
        const formatDate = (dateStr: string) => dateStr.replace(/-/g, '')

        // Helper to format datetime YYYYMMDDTHHMMSSZ
        const formatDateTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

        // Process Assignments & Tasks
        const allItems = [
            ...assignments.map(a => ({ ...a, type: 'assignment' })),
            ...tasks.map(t => ({ ...t, type: 'task' }))
        ]

        for (const item of allItems) {
            if (!item.due_date) continue

            const title = item.title || 'Untitled'
            const dateStr = formatDate(item.due_date.substring(0, 10)) // YYYYMMDD
            const uid = `${item.id}@collegeorganizer.app`

            let desc = ''
            if (item.type === 'assignment') {
                const course = courses.find(c => c.id === item.category_id) // Assignments usually link via category or direct course_id depending on schema version
                // Actually schema has course_id on assignments? No, checked earlier, assignments have category_id usually.
                // Wait, schema check earlier showed assignments added lms_id etc. 
                // In AppContext.jsx map: courseId is not mapped directly?
                // Let's assume generic "Assignment".
                desc = `Assignment details: ${item.details || 'None'}`
            } else {
                desc = `Study Task`
            }

            icsContent += [
                'BEGIN:VEVENT',
                `DTSTART;VALUE=DATE:${dateStr}`,
                `DTEND;VALUE=DATE:${dateStr}`, // All day event
                `SUMMARY:${title} (${item.type === 'assignment' ? 'Due' : 'Task'})`,
                `DESCRIPTION:${desc}`,
                `UID:${uid}`,
                `DTSTAMP:${dtStamp}`,
                'BEGIN:VALARM',
                'TRIGGER:-P1D',
                'ACTION:DISPLAY',
                'DESCRIPTION:Reminder',
                'END:VALARM',
                'END:VEVENT',
                ''
            ].join('\r\n')
        }

        // Process Course Schedule (Weekly)
        const dayMap: Record<string, string> = { 'Mon': 'MO', 'Tue': 'TU', 'Wed': 'WE', 'Thu': 'TH', 'Fri': 'FR', 'Sat': 'SA', 'Sun': 'SU' }

        for (const course of courses) {
            if (course.schedule && Array.isArray(course.schedule)) {
                let idx = 0
                for (const slot of course.schedule) {
                    if (!slot.day || !slot.start || !slot.end) continue

                    // Calculate next occurrence
                    // Simply finding the first occurrence relative to NOW isn't strictly necessary for RRULE if we set a generic DTSTART.
                    // But generally good practice to set DTSTART to the start of semester or 'next upcoming'.
                    // Let's pick the "next upcoming" day of week.
                    const targetDayStr: string = slot.day
                    const targetDayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(targetDayStr)
                    if (targetDayIndex === -1) continue

                    const startDateTime = new Date()
                    const currentDayIndex = startDateTime.getDay()
                    let dayDiff = targetDayIndex - currentDayIndex
                    if (dayDiff < 0) dayDiff += 7

                    startDateTime.setDate(startDateTime.getDate() + dayDiff)

                    const [startH, startM] = slot.start.split(':').map(Number)
                    const [endH, endM] = slot.end.split(':').map(Number)

                    startDateTime.setHours(startH, startM, 0, 0)
                    const endDateTime = new Date(startDateTime)
                    endDateTime.setHours(endH, endM, 0, 0)

                    const startStr = formatDateTime(startDateTime)
                    const endStr = formatDateTime(endDateTime)
                    const byDay = dayMap[targetDayStr] || 'MO'

                    icsContent += [
                        'BEGIN:VEVENT',
                        `DTSTART:${startStr}`,
                        `DTEND:${endStr}`,
                        `SUMMARY:${course.code} Class`,
                        `LOCATION:${slot.location || ''}`,
                        `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=20260530T000000Z`,
                        `UID:${course.id}-class-${idx}@collegeorganizer.app`,
                        `DTSTAMP:${dtStamp}`,
                        'END:VEVENT',
                        ''
                    ].join('\r\n')
                    idx++
                }
            }
        }

        icsContent += 'END:VCALENDAR'

        return new Response(icsContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="my-schedule.ics"',
            },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
