import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verify User
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Parse Body - now includes feature_type
        const { messages, response_format, model, feature_type } = await req.json()

        // Check Limits
        const { data: profile } = await supabaseClient.from('profiles').select('plan').eq('id', user.id).single()
        const { data: stats } = await supabaseClient.from('user_stats').select('ai_usage_count, ai_last_reset, ai_chat_count').eq('user_id', user.id).single()

        const plan = profile?.plan || 'free'
        let usage = stats?.ai_usage_count || 0
        let chatCount = stats?.ai_chat_count || 0
        const lastResetStr = stats?.ai_last_reset
        const limit = plan === 'premium' ? 50 : 0 // Only premium users get AI credits

        // Auto-Reset logic
        const now = new Date()
        const lastResetDate = lastResetStr ? new Date(lastResetStr) : new Date()

        // If stored date is in a different month/year than today, reset usage
        if (lastResetStr && (lastResetDate.getMonth() !== now.getMonth() || lastResetDate.getFullYear() !== now.getFullYear())) {
            console.log(`Resetting AI usage for user ${user.id} (New Month)`)
            const todayStr = now.toISOString().split('T')[0]
            try {
                await supabaseClient.from('user_stats').update({
                    ai_usage_count: 0,
                    ai_chat_count: 0,  // Also reset chat count
                    ai_last_reset: todayStr
                }).eq('user_id', user.id)
                usage = 0
                chatCount = 0
            } catch (e) {
                console.error("Failed to reset usage stats", e)
            }
        }

        if (usage >= limit) {
            return new Response(JSON.stringify({ error: `AI Limit Reached (${usage}/${limit}). Please upgrade or wait for next month.` }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Call OpenAI
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4o',
                messages: messages,
                response_format: response_format || undefined
            })
        })

        const data = await res.json()

        if (data.error) {
            console.error("OpenAI Error:", data.error)
            throw new Error(data.error.message)
        }

        // Increment Usage based on feature type
        // Chat: 10 messages = 1 credit
        // Notes/Quiz: 1 generation = 1 credit
        try {
            if (feature_type === 'chat') {
                // Chat: increment chat count, only deduct credit every 10 messages
                const newChatCount = chatCount + 1
                if (newChatCount >= 10) {
                    // Deduct 1 credit and reset chat count
                    await supabaseClient.from('user_stats').update({
                        ai_usage_count: usage + 1,
                        ai_chat_count: 0  // Reset after 10 messages
                    }).eq('user_id', user.id)
                    console.log(`[AI-PROXY] User ${user.id}: 10 chat messages reached, 1 credit deducted`)
                } else {
                    // Just increment chat count, no credit deduction yet
                    await supabaseClient.from('user_stats').update({
                        ai_chat_count: newChatCount
                    }).eq('user_id', user.id)
                    console.log(`[AI-PROXY] User ${user.id}: Chat message ${newChatCount}/10`)
                }
            } else {
                // Notes, Quiz, or other: 1 credit per generation
                await supabaseClient.from('user_stats').update({
                    ai_usage_count: usage + 1
                }).eq('user_id', user.id)
                console.log(`[AI-PROXY] User ${user.id}: ${feature_type || 'unknown'} generated, 1 credit deducted`)
            }
        } catch (e) {
            console.error("Failed to increment usage", e)
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
