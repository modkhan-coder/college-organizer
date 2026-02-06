import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import OpenAI from 'https://esm.sh/openai@4.28.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Auth & Premium Check
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization Header')
        const token = authHeader.replace('Bearer ', '')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
        if (authError || !user) throw new Error('Unauthorized: ' + (authError?.message || 'No user'))

        // Check Plan
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('plan')
            .eq('id', user.id)
            .single()

        // Strict Premium Check
        if (profile?.plan !== 'premium') {
            throw new Error("Upgrade to Premium to use AI features!");
        }

        // Usage Check (Cost = 10)
        const { data: stats } = await supabaseClient.from('user_stats').select('ai_usage_count').eq('user_id', user.id).single()
        const usage = stats?.ai_usage_count || 0
        const limit = 500
        const COST = 10

        if (usage + COST > limit) {
            throw new Error(`AI Limit Reached (${usage}/${limit}). Please upgrade.`);
        }

        // Increment Usage
        await supabaseClient.from('user_stats').update({ ai_usage_count: usage + COST }).eq('user_id', user.id)

        // 2. Parse Input
        const { assignments, hoursPerDay } = await req.json()
        console.log(`Generating plan for user ${user.id} with ${assignments?.length} assignments, ${hoursPerDay} hours/day`)

        if (!assignments || assignments.length === 0) {
            throw new Error("No assignments provided")
        }

        // 3. Call OpenAI
        const apiKey = Deno.env.get('OPENAI_API_KEY')
        if (!apiKey) {
            throw new Error('Server misconfiguration: OPENAI_API_KEY not set')
        }

        const openai = new OpenAI({ apiKey })

        const prompt = `
    You are a study planner. I have these assignments:
    ${JSON.stringify(assignments)}

    I can study ${hoursPerDay} hours per day.
    Today is ${new Date().toDateString()}.

    Generate a study plan. Break big assignments into smaller tasks (45-60 mins).
    Prioritize overdue or soon-due items.
    
    Return STRICT JSON in this format:
    {
      "schedule": [
        {
          "title": "Task Name (e.g. Read Ch 1 for History)",
          "date": "YYYY-MM-DD",
          "duration_minutes": 60,
          "notes": "Focus on key terms."
        }
      ]
    }
    `

        console.log("Calling OpenAI...")
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are a helpful assistant that outputs JSON." }, { role: "user", content: prompt }],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }
        })

        if (!completion.choices[0].message.content) {
            throw new Error("OpenAI returned empty response")
        }

        console.log("OpenAI Response received")
        const result = JSON.parse(completion.choices[0].message.content)

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error("Error in generate-study-plan:", error)
        // Return 200 with error property so frontend can read the body easily without catching 400 immediately
        return new Response(
            JSON.stringify({ error: error.message || 'Unknown server error', stack: error.stack }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }
})
