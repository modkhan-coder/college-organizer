import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        console.log('=== Extract PDF Text Function Called ===')
        const body = await req.json()
        console.log('Request body:', JSON.stringify(body))

        const { pdf_id, user_id, course_id } = body

        if (!pdf_id || !user_id || !course_id) {
            throw new Error(`Missing required parameters: pdf_id=${pdf_id}, user_id=${user_id}, course_id=${course_id}`)
        }

        const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

        // Get PDF file info
        const { data: pdfFile, error: pdfError } = await supabase
            .from('pdf_files')
            .select('file_path, file_name')
            .eq('id', pdf_id)
            .single()

        if (pdfError || !pdfFile) {
            throw new Error('PDF file not found')
        }

        console.log('PDF file:', pdfFile)

        // Download the PDF from storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('course_materials')
            .download(pdfFile.file_path)

        if (downloadError) {
            console.error('Download error:', downloadError)
            throw new Error(`Failed to download PDF: ${downloadError.message}`)
        }

        console.log('PDF downloaded, size:', fileData.size)

        // Convert PDF to base64
        const arrayBuffer = await fileData.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        console.log('PDF converted to base64, calling OpenAI for extraction...')

        // Use OpenAI's API to extract text from PDF
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: `Please extract ALL text from this PDF document. Return ONLY the extracted text, maintaining the original structure and formatting as much as possible. Do not add any commentary or analysis.\n\nPDF Base64:\n${base64.substring(0, 100000)}` // Limit to ~100KB
                    }
                ],
                max_tokens: 16000
            })
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`OpenAI API error: ${error}`)
        }

        const data = await response.json()
        const extractedText = data.choices[0].message.content

        console.log(`Extracted ${extractedText.length} characters of text`)

        // Split into pages (approximate - we'll treat every ~3000 chars as a page)
        const charsPerPage = 3000
        const numPages = Math.ceil(extractedText.length / charsPerPage)

        const pages = []
        for (let i = 0; i < numPages; i++) {
            const start = i * charsPerPage
            const end = Math.min((i + 1) * charsPerPage, extractedText.length)
            const pageText = extractedText.substring(start, end)
            pages.push({
                page_number: i + 1,
                content: pageText
            })
        }


        // Save to course_docs table
        console.log(`Saving ${pages.length} pages to database...`)

        // First, delete any existing entries for this PDF
        await supabase
            .from('course_docs')
            .delete()
            .eq('pdf_id', pdf_id)

        // Insert new entries
        const docsToInsert = pages.map(p => ({
            user_id,
            course_id,
            pdf_id,
            page_number: p.page_number,
            content: p.content
        }))

        const { error: insertError } = await supabase
            .from('course_docs')
            .insert(docsToInsert)

        if (insertError) {
            console.error('Insert error:', insertError)
            throw new Error(`Failed to save extracted text: ${insertError.message}`)
        }

        console.log('✅ Text extraction complete!')

        return new Response(JSON.stringify({
            success: true,
            pages: pages.length,
            total_chars: extractedText.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('=== Text Extraction Error ===')
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)

        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Unknown error occurred'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
