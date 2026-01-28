import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const authHeader = req.headers.get('Authorization')

    // SECRETS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(supabaseUrl, serviceKey)

    try {
        console.log('LMS Sync Triggered...')

        // 1. Get all active connections
        const { data: connections, error: connErr } = await supabase
            .from('lms_connections')
            .select('*')

        if (connErr) throw connErr
        console.log(`Syncing ${connections.length} connections...`)

        const results = []

        for (const conn of connections) {
            try {
                console.log(`Processing ${conn.provider} for user ${conn.user_id}...`)

                // 2. Get courses for this user that are synced from this provider
                const { data: syncedCourses } = await supabase
                    .from('courses')
                    .select('*')
                    .eq('user_id', conn.user_id)
                    .eq('lms_provider', conn.provider)
                    .eq('sync_enabled', true)

                if (!syncedCourses || syncedCourses.length === 0) {
                    console.log(`No synced courses for user ${conn.user_id}`)
                    continue
                }

                // 3. Perform Sync per course
                const baseUrl = conn.instance_url.startsWith('http') ? conn.instance_url : `https://${conn.instance_url}`

                for (const course of syncedCourses) {
                    if (!course.lms_id) continue;

                    // FETCH FROM LMS API (Canvas example)
                    if (conn.provider === 'canvas') {
                        const apiUrl = `${baseUrl}/api/v1/courses/${course.lms_id}/assignments`
                        const response = await fetch(apiUrl, {
                            headers: { 'Authorization': `Bearer ${conn.access_token}` }
                        })

                        if (!response.ok) {
                            console.error(`Failed to fetch for course ${course.code}: ${response.statusText}`)
                            continue
                        }

                        const assignments = await response.json()

                        // 4. Map & Upsert
                        const upsertData = assignments.map((a: any) => ({
                            user_id: conn.user_id,
                            course_id: course.id,
                            title: a.name,
                            due_date: a.due_at,
                            points_possible: a.points_possible,
                            category_id: String(a.assignment_group_id), // Use professor's category
                            lms_id: String(a.id),
                            lms_source: true,
                            lms_status: a.has_submitted_submissions ? 'submitted' : 'missing'
                        }))

                        if (upsertData.length > 0) {
                            const { error: upsertErr } = await supabase
                                .from('assignments')
                                .upsert(upsertData, { onConflict: 'user_id,lms_id' })

                            if (upsertErr) console.error(`Upsert Error for ${course.code}:`, upsertErr)
                        }
                    }
                }

                // 5. Update Connection Status
                await supabase
                    .from('lms_connections')
                    .update({ last_sync: new Date().toISOString(), sync_status: 'success' })
                    .eq('id', conn.id)

                results.push({ user_id: conn.user_id, status: 'success' })

            } catch (err) {
                console.error(`Error syncing connection ${conn.id}:`, err)
                await supabase
                    .from('lms_connections')
                    .update({ sync_status: 'failed' })
                    .eq('id', conn.id)
                results.push({ user_id: conn.user_id, status: 'failed', error: err.message })
            }
        }

        return new Response(JSON.stringify({ message: 'Sync Complete', results }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
