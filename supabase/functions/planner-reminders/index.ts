import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

Deno.serve(async (req) => {
    try {
        console.log('Checking for Reminders...')
        const now = new Date()
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000)

        // 1. Check Tasks with reminders
        // We want tasks where: (due_date - reminder_offset) is between NOW and NOW+1h
        // Since SQL json querying is enabling, we'll fetch candidate tasks and filter in JS for flexibility.
        // Fetch pending tasks due in the next 24 hours (optimization)
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('completed', false)
            .gte('due_date', now.toISOString().split('T')[0])
            .not('reminders', 'is', null)

        const notifications = []

        for (const task of (tasks || [])) {
            if (!task.reminders || !Array.isArray(task.reminders)) continue

            for (const rem of task.reminders) {
                // Assume reminder is { val: 60, unit: 'minutes' } -> stored as minutes offset
                // Actually implementation plan used { offset: 60 }. Let's stick to simple minutes.
                const offsetMinutes = Number(rem.offset || 60)

                // Calculate Trigger Time
                // Task due_date is usually just YYYY-MM-DD. Let's assume due at 11:59 PM if no time?
                // Or better, let's assume 9 AM for "Day of" reminders?
                // For MVP: Let's assume if due_date is TODAY, and we want a reminder, we send it.
                // But strict time-based reminders need a timestamp. 
                // Current App 'due_date' is Date only.

                // LOGIC ADJUSTMENT:
                // Since we only have Dates, "1 hour before" is hard.
                // Let's interpret reminders as "Day Before" or "Morning Of".
                // offset = 1440 (24h) -> Day Before.
                // offset = 0 -> Morning of (e.g. 8 AM check).

                const taskDue = new Date(task.due_date) // This is UTC midnight
                // If we want to alert at 9 AM local time... user timezones are hard.
                // Let's simplify:
                // If reminder is "1 day before", we alert if today == (due - 1 day).

                const diffDays = Math.ceil((taskDue.getTime() - now.getTime()) / (1000 * 3600 * 24))

                let shouldNotify = false
                let msg = ''

                if (offsetMinutes >= 1440 && diffDays === 1) { // ~24 hours
                    shouldNotify = true
                    msg = `Reminder: "${task.title}" is due tomorrow.`
                } else if (offsetMinutes < 1440 && diffDays === 0) { // Same day
                    shouldNotify = true
                    msg = `Reminder: "${task.title}" is due today.`
                }

                if (shouldNotify) {
                    // Check if already notified today
                    // Requires a `sent_reminders` log or similar.
                    // For now, to prevent spam, we can check existing notifications for this item.
                    const { data: existing } = await supabase
                        .from('notifications')
                        .select('id')
                        .eq('user_id', task.user_id)
                        .like('message', `%${task.title}%`)
                        .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString()) // Sent today?
                        .maybeSingle()

                    if (!existing) {
                        notifications.push({
                            user_id: task.user_id,
                            title: 'Task Reminder',
                            message: msg,
                            type: 'reminder'
                        })
                    }
                }
            }
        }

        // 2. Insert Notifications
        if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications)
            console.log(`Sent ${notifications.length} reminders.`)
        }

        return new Response(JSON.stringify({ message: `Processed reminders. Sent: ${notifications.length}` }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
