import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StudySuggestion {
    text: string;
    priority: 'high' | 'medium' | 'low';
    estimated_time_minutes: number;
    related_resource_id?: string;
    related_assignment_id?: string;
    reasoning: string;
}

interface SuggestionResponse {
    suggestions: StudySuggestion[];
    generated_at: string;
    context_summary: string;
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get authorization header
        const authHeader = req.headers.get('Authorization')!
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // Create Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        })

        // Get user from JWT
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

        if (userError || !user) {
            throw new Error('Unauthorized')
        }

        // Parse request body
        const { courseId } = await req.json()

        if (!courseId) {
            throw new Error('courseId is required')
        }

        // Check rate limiting (max 5 requests per day per user per course)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recentRequests, error: rateLimitError } = await supabase
            .from('course_checklist_items')
            .select('id')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .eq('source', 'ai')
            .gte('generated_at', oneDayAgo)

        if (rateLimitError) {
            console.error('Rate limit check error:', rateLimitError)
        }

        // Count distinct generation times (not individual suggestions)
        const generationTimes = new Set(
            (recentRequests || []).map(r => r.generated_at)
        )

        if (generationTimes.size >= 5) {
            return new Response(
                JSON.stringify({
                    error: 'Rate limit exceeded. Maximum 5 AI suggestion requests per day.',
                    retry_after: '24 hours',
                }),
                {
                    status: 429,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Fetch course context
        console.log('Fetching course context for:', courseId)

        // Get course details
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', courseId)
            .single()

        if (courseError || !course) {
            throw new Error('Course not found')
        }

        // Get upcoming assignments (next 30 days)
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: assignments } = await supabase
            .from('assignments')
            .select('*')
            .eq('course_id', courseId)
            .lte('due_date', thirtyDaysFromNow)
            .order('due_date', { ascending: true })
            .limit(10)

        // Get course resources
        const { data: resources } = await supabase
            .from('course_resources')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })
            .limit(20)

        // Get current checklist
        const { data: checklist } = await supabase
            .from('course_checklist_items')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .is('completed_at', null)
            .order('created_at', { ascending: false })
            .limit(20)

        // Build AI prompt
        const currentDate = new Date().toISOString().split('T')[0]

        const assignmentsText = assignments && assignments.length > 0
            ? assignments.map(a => `- ${a.name} (Due: ${a.due_date}, Type: ${a.category_name || 'Assignment'})`).join('\n')
            : 'No upcoming assignments in the next 30 days.'

        const resourcesText = resources && resources.length > 0
            ? resources.map(r => `- ${r.type}: ${r.title}${r.tags?.length ? ` [Tags: ${r.tags.join(', ')}]` : ''}`).join('\n')
            : 'No resources added yet.'

        const checklistText = checklist && checklist.length > 0
            ? checklist.map(c => `- ${c.text}`).join('\n')
            : 'No current checklist items.'

        const prompt = `You are a study planning assistant for college students. Based on the following course context, generate 5-8 specific, actionable study tasks.

Course: ${course.name}
Current Date: ${currentDate}

UPCOMING ASSIGNMENTS:
${assignmentsText}

AVAILABLE RESOURCES:
${resourcesText}

CURRENT CHECKLIST:
${checklistText}

Generate study tasks that:
1. Prioritize urgent assignments (due within 7 days = high priority, within 14 days = medium, beyond = low)
2. Reference specific resources when relevant
3. Include realistic time estimates (15-120 minutes per task)
4. Are specific and actionable (not vague like "study for exam")
5. Don't duplicate existing checklist items
6. Break down large tasks into manageable chunks

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "suggestions": [
    {
      "text": "Review lecture slides 5-7 for Quiz 2",
      "priority": "high",
      "estimated_time_minutes": 30,
      "reasoning": "Quiz 2 is in 3 days, these slides cover 40% of quiz material"
    }
  ],
  "context_summary": "Found 3 upcoming assignments, 5 resources available"
}`

        // Call OpenAI API
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) {
            throw new Error('OPENAI_API_KEY not configured. Please set it in Supabase secrets.')
        }

        console.log('Calling OpenAI API...')
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful study planning assistant. Always respond with valid JSON only, no markdown formatting.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: 1500,
            }),
        })

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text()
            console.error('OpenAI API error:', errorText)
            throw new Error(`OpenAI API error: ${openaiResponse.status}`)
        }

        const openaiData = await openaiResponse.json()
        console.log('OpenAI response received')

        // Parse AI response
        let aiContent = openaiData.choices[0].message.content.trim()

        // Remove markdown code blocks if present
        aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        const aiResponse: SuggestionResponse = JSON.parse(aiContent)

        // Validate and sanitize suggestions
        const validSuggestions = aiResponse.suggestions
            .filter(s => s.text && s.text.length > 0 && s.text.length <= 500)
            .filter(s => ['high', 'medium', 'low'].includes(s.priority))
            .filter(s => s.estimated_time_minutes > 0 && s.estimated_time_minutes <= 240)
            .slice(0, 10) // Max 10 suggestions

        if (validSuggestions.length === 0) {
            throw new Error('No valid suggestions generated')
        }

        // Return suggestions
        const response: SuggestionResponse = {
            suggestions: validSuggestions,
            generated_at: new Date().toISOString(),
            context_summary: aiResponse.context_summary || `Generated ${validSuggestions.length} suggestions`,
        }

        console.log(`Generated ${validSuggestions.length} suggestions successfully`)

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.toString(),
            }),
            {
                status: error.message === 'Unauthorized' ? 401 : 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
