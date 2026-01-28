import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

Deno.serve(async (req) => {
    try {
        console.log('Starting Recurrence Generator...')

        // 1. Find active recurring tasks (parents)
        const { data: recurringTasks, error } = await supabase
            .from('tasks')
            .select('*')
            .not('recurrence_rule', 'is', null)
            .is('parent_task_id', null) // Only parents

        if (error) throw error
        console.log(`Found ${recurringTasks.length} recurring templates.`)

        const generatedTasks = []

        // 2. Process each template
        for (const task of recurringTasks) {
            const rule = task.recurrence_rule
            if (!rule || !rule.frequency) continue

            const today = new Date()
            // Look ahead 7 days
            const horizon = new Date()
            horizon.setDate(today.getDate() + 7)

            // Calculate next due date based on rule (Simple Weekly Logic for now)
            // NOTE: A robust library like 'rrule' is better for complex logic, 
            // but we'll implement simple weekly/daily logic here to keep it lightweight.

            let nextDate = new Date(task.due_date)
            // Advance nextDate until it's in the future (>= today)
            while (nextDate < today) {
                if (rule.frequency === 'daily') {
                    nextDate.setDate(nextDate.getDate() + (rule.interval || 1))
                } else if (rule.frequency === 'weekly') {
                    nextDate.setDate(nextDate.getDate() + (7 * (rule.interval || 1)))
                }
            }

            // If nextDate is within horizon, check if it already exists
            if (nextDate <= horizon) {
                // Check existance
                const checkDateStr = nextDate.toISOString().split('T')[0]

                const { data: existing } = await supabase
                    .from('tasks')
                    .select('id')
                    .eq('parent_task_id', task.id)
                    .eq('due_date', checkDateStr)
                    .maybeSingle()

                if (!existing) {
                    console.log(`Generating instance for ${task.title} on ${checkDateStr}`)
                    generatedTasks.push({
                        user_id: task.user_id,
                        title: task.title,
                        priority: task.priority,
                        est_minutes: task.est_minutes,
                        parent_task_id: task.id,
                        due_date: checkDateStr,
                        reminders: task.reminders,
                        recurrence_rule: null, // Children are not recurring templates themselves
                        completed: false
                    })
                }
            }
        }

        // 3. Bulk Insert
        if (generatedTasks.length > 0) {
            const { error: insertErr } = await supabase.from('tasks').insert(generatedTasks)
            if (insertErr) throw insertErr
        }

        return new Response(JSON.stringify({ message: `Generated ${generatedTasks.length} tasks` }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
