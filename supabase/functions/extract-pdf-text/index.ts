import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const log = (msg: string) => {
    console.log(`[PDF-Text-V7-InfiniteScale] ${msg}`)
}

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

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

        if (!openaiApiKey) throw new Error('Missing OPENAI_API_KEY')

        const body = await req.json()
        const { pdf_id, user_id, course_id, action = 'start', assistant_id: provAsstId, thread_id: provThId, run_id: provRunId } = body
        const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

        // --- POLL ACTION ---
        if (action === 'poll') {
            log(`Polling Run: ${provRunId}`)
            const pollResp = await fetchWithTimeout(`https://api.openai.com/v1/threads/${provThId}/runs/${provRunId}`, {
                headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'OpenAI-Beta': 'assistants=v2' }
            })
            if (!pollResp.ok) throw new Error(`OpenAI Poll API error: ${pollResp.status}`)

            const pollData = await pollResp.json()
            const status = pollData.status

            if (status === 'completed') {
                log('Run completed! Fetching text...')
                const msgResp = await fetchWithTimeout(`https://api.openai.com/v1/threads/${provThId}/messages`, {
                    headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'OpenAI-Beta': 'assistants=v2' }
                })
                const msgData = await msgResp.json()
                const extractedText = msgData.data.find((m: any) => m.role === 'assistant')?.content?.[0]?.text?.value

                if (!extractedText) throw new Error('AI returned no text.')

                // Robust DB Save: Delete then Insert
                log(`[POLL] Saving text for pdf_id: ${pdf_id}`)
                await supabase.from('course_docs').delete().eq('pdf_id', pdf_id)

                const { data: pdfFile, error: fetchErr } = await supabase.from('pdf_files').select('file_name').eq('id', pdf_id).single()
                if (fetchErr) log(`⚠️ Could not fetch file_name for doc save: ${fetchErr.message}`)
                const { error: insError } = await supabase.from('course_docs').insert({
                    user_id, course_id, pdf_id,
                    file_name: pdfFile?.file_name || 'syllabus.pdf',
                    page_number: 1, content: extractedText,
                    metadata: { source: 'openai_v7_infinite', extracted_at: new Date().toISOString() }
                })

                if (insError) throw new Error(`Database Save Failed: ${insError.message}`)

                log('Cleanup OpenAI Resources (keeping file for Step 3)...')
                try {
                    await fetch(`https://api.openai.com/v1/assistants/${provAsstId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'OpenAI-Beta': 'assistants=v2' }
                    })
                } catch (e) { log(`Cleanup Warning: ${e.message}`) }

                return new Response(JSON.stringify({ success: true, status: 'completed' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            if (['failed', 'expired', 'cancelled'].includes(status)) {
                throw new Error(`AI Job failed with status: ${status}`)
            }

            return new Response(JSON.stringify({ success: true, status }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // --- START ACTION ---
        log(`[START] Querying pdf_id: ${pdf_id}`)
        const { data: pdfFile, error: pdfError } = await supabase
            .from('pdf_files')
            .select('file_path, file_name, openai_file_id')
            .eq('id', pdf_id)
            .single()

        if (pdfError) {
            log(`❌ DB Error: ${pdfError.message} (Code: ${pdfError.code})`)
            throw new Error(`PDF Registry Error: ${pdfError.message}`)
        }
        if (!pdfFile) {
            log(`❌ PDF Fail: ID ${pdf_id} not found.`)
            throw new Error(`PDF not found in database (ID: ${pdf_id})`)
        }
        log(`✅ PDF Found: ${pdfFile.file_name}`)

        let fileId = pdfFile.openai_file_id;

        if (!fileId) {
            log('Uploading new file to OpenAI...')
            const { data: fileData, error: dlError } = await supabase.storage.from('course_materials').download(pdfFile.file_path)
            if (dlError || !fileData) throw new Error(`Download failed: ${dlError?.message}`)

            const formData = new FormData()
            formData.append('file', fileData, pdfFile.file_name)
            formData.append('purpose', 'assistants')

            const upResp = await fetchWithTimeout('https://api.openai.com/v1/files', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openaiApiKey}` },
                body: formData
            }, 30000)
            const upData = await upResp.json()
            fileId = upData.id

            // Save for future use
            await supabase.from('pdf_files').update({ openai_file_id: fileId }).eq('id', pdf_id)
            log(`File uploaded and saved: ${fileId}`)
        } else {
            log(`Reusing existing file: ${fileId}`)
        }

        // 1. Create Assistant
        log('Creating Assistant...')
        const asstResp = await fetchWithTimeout('https://api.openai.com/v1/assistants', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                instructions: "Extract all text from the attached PDF. RAW TEXT ONLY. NO MARKDOWN.",
                model: "gpt-4o-mini",
                tools: [{ type: "file_search" }]
            })
        }, 15000)
        if (!asstResp.ok) throw new Error(`Assistant creation failed: ${asstResp.status}`)
        const { id: assistantId } = await asstResp.json()

        // 2. Combined Create Thread and Run
        log('Starting Run...')
        const runResp = await fetchWithTimeout('https://api.openai.com/v1/threads/runs', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                assistant_id: assistantId,
                thread: {
                    messages: [{
                        role: 'user', content: 'Extract text.',
                        attachments: [{ file_id: fileId, tools: [{ type: 'file_search' }] }]
                    }]
                }
            })
        }, 20000)

        if (!runResp.ok) throw new Error(`OpenAI Run Start Error: ${runResp.status}`)
        const run = await runResp.json()

        return new Response(JSON.stringify({
            success: true, status: 'queued',
            assistant_id: assistantId,
            thread_id: run.thread_id,
            run_id: run.id
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
