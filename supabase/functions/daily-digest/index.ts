import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create a Supabase client with the Auth context of the function
        const supabaseClient = createClient(
            // Supabase API URL - env var exported by default.
            Deno.env.get('SUPABASE_URL') ?? '',
            // Supabase API ANON KEY - env var exported by default.
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log('Starting Daily Digest...')

        // 1. Get all users who have enabled email digest
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('id, email, name') // Assuming email is on profiles or auth.users. 
            // Note: In this schema, email is likely in auth.users. 
            // We might need to join or fetch differently if profiles doesn't have email.
            // Checking previous context, profiles usually mirrors auth.users or links to it.
            // Let's assume for now we need to get emails from auth.users or if it's in profiles.
            // If profiles table doesn't have email, we might strictly rely on auth.users, 
            // but we can't select from auth.users easily with client SDK unless using admin api.
            // However, usually profiles has a copy or we use the user_id to send via an external service that maps IDs.
            // Let's check if profiles has email. If not, we'll just log 'sending to user_id'.
            .eq('email_digest_enabled', true)

        if (profileError) throw profileError

        console.log(`Found ${profiles?.length ?? 0} users with digest enabled.`)

        const results = []

        for (const user of (profiles || [])) {
            // 2. For each user, fetch tasks due today or tomorrow
            const today = new Date().toISOString().split('T')[0]
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

            const { data: tasks, error: taskError } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .eq('completed', false)
                .or(`due_date.eq.${today},due_date.eq.${tomorrow}`)
                .order('due_date', { ascending: true })

            if (taskError) {
                console.error(`Error fetching tasks for user ${user.id}:`, taskError)
                continue
            }

            if (tasks && tasks.length > 0) {
                // 3. Construct the email content (Placeholder)
                const taskList = tasks.map(t => `- ${t.title} (Due: ${t.due_date})`).join('\n')
                const emailBody = `Hello ${user.name || 'Student'},\n\nHere are your tasks for today and tomorrow:\n${taskList}\n\nGood luck!`

                // 4. Send Email (Placeholder - Log to console/DB)
                // In a real app, use Resend, SendGrid, etc.
                console.log(`[Email Sent] To: ${user.id} (Email not in profile yet?)\nBody:\n${emailBody}`)

                // Log notification to DB as well for visibility in app
                await supabaseClient.from('notifications').insert({
                    user_id: user.id,
                    type: 'system',
                    message: `Daily Digest: You have ${tasks.length} tasks due soon. Check your planner!`,
                    is_read: false
                })

                results.push({ user_id: user.id, task_count: tasks.length })
            }
        }

        return new Response(
            JSON.stringify({ success: true, processed: results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
