import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const log = (msg: string) => console.log(`[Analysis-V8-InfiniteScale] ${msg}`)

async function fetchWithTimeout(url: string, options: any = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

const SYSTEM_PROMPT = `You are a precision course syllabus parser. 
Search through the provided PDF and extract structured data into JSON.

JSON STRUCTURE:
{
  "course_info": { "title": "", "instructor_name": "", "instructor_email": "", "location": "", "meeting_times": "" },
  "grading_policy": [{ "category": "", "weight": 0 }],
  "office_hours": [], "key_dates": [], "assignments": [], "policies": []
}

Rules:
1. Weights must be numbers (e.g., 25).
2. Use tool 'file_search' to find the instructor, grading weights, and schedule.
3. Return ONLY valid JSON.`

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json()
        const { pdf_id, course_id, user_id, action = 'start', assistant_id: provAsstId, thread_id: provThId, run_id: provRunId } = body
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

        if (!openaiApiKey) throw new Error('Missing API Key')

        // --- POLL ACTION ---
        if (action === 'poll') {
            log(`Polling Analysis Run: ${provRunId}`)
            const pollResp = await fetchWithTimeout(`https://api.openai.com/v1/threads/${provThId}/runs/${provRunId}`, {
                headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'OpenAI-Beta': 'assistants=v2' }
            })
            if (!pollResp.ok) throw new Error(`OpenAI Poll Error: ${pollResp.status}`)

            const pollData = await pollResp.json()
            const status = pollData.status

            if (status === 'completed') {
                log('Analysis completed! Fetching JSON...')
                const msgResp = await fetchWithTimeout(`https://api.openai.com/v1/threads/${provThId}/messages`, {
                    headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'OpenAI-Beta': 'assistants=v2' }
                })
                const msgData = await msgResp.json()
                const jsonStr = msgData.data.find((m: any) => m.role === 'assistant')?.content?.[0]?.text?.value
                if (!jsonStr) throw new Error('AI returned no analysis data.')

                const cleanJson = JSON.parse(jsonStr.replace(/```json|```/g, '').trim())

                log(`[POLL] Saving analysis for pdf_id: ${pdf_id}`)
                await supabase.from('syllabus_extractions').delete().eq('pdf_id', pdf_id)
                const { error: insError } = await supabase.from('syllabus_extractions').insert({
                    user_id, course_id, pdf_id, extracted_json: cleanJson, status: 'success'
                })
                if (insError) log(`❌ DB Save Error: ${insError.message}`)

                // Cleanup
                try {
                    await fetch(`https://api.openai.com/v1/assistants/${provAsstId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'OpenAI-Beta': 'assistants=v2' }
                    })
                } catch (e: any) { log(`Cleanup Warning: ${e.message}`) }

                return new Response(JSON.stringify({ success: true, status: 'completed', data: cleanJson }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            if (['failed', 'expired', 'cancelled'].includes(status)) throw new Error(`Analysis failed: ${status}`)

            return new Response(JSON.stringify({ success: true, status }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // --- START ACTION ---
        log(`[START] Scaling Analysis for pdf_id: ${pdf_id}`)
        const { data: pdfFile, error: pdfError } = await supabase
            .from('pdf_files')
            .select('openai_file_id')
            .eq('id', pdf_id)
            .single()

        if (pdfError) {
            log(`❌ DB Error: ${pdfError.message} (Code: ${pdfError.code})`)
            throw new Error(`PDF Registry Error: ${pdfError.message}`)
        }
        if (!pdfFile) {
            log(`❌ PDF Fail: ID ${pdf_id} not found.`)
            throw new Error(`PDF data not found (ID: ${pdf_id})`)
        }
        if (!pdfFile.openai_file_id) {
            log(`❌ File not indexed: ${pdf_id}`)
            throw new Error('PDF file not yet indexed by OpenAI. Ensure Step 2 finished.')
        }

        // 1. Create Analysis Assistant
        const asstResp = await fetchWithTimeout('https://api.openai.com/v1/assistants', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json', 'OpenAI-Beta': 'assistants=v2' },
            body: JSON.stringify({
                name: 'Syllabus Analyst', instructions: SYSTEM_PROMPT, model: 'gpt-4o-mini',
                tools: [{ type: 'file_search' }], response_format: { type: 'json_object' }
            })
        })
        const assistant = await asstResp.json()

        // 2. Create Thread and Run
        const runResp = await fetchWithTimeout('https://api.openai.com/v1/threads/runs', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json', 'OpenAI-Beta': 'assistants=v2' },
            body: JSON.stringify({
                assistant_id: assistant.id,
                thread: {
                    messages: [{
                        role: 'user', content: 'Extract details from this syllabus PDF.',
                        attachments: [{ file_id: pdfFile.openai_file_id, tools: [{ type: 'file_search' }] }]
                    }]
                }
            })
        })
        const run = await runResp.json()

        return new Response(JSON.stringify({
            success: true, status: 'processing',
            assistant_id: assistant.id, thread_id: run.thread_id, run_id: run.id
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        log(`❌ FATAL: ${error.message}`)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
