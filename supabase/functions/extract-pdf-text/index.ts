import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

        // Convert blob to ArrayBuffer for pdf.js
        const arrayBuffer = await fileData.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        console.log('Loading PDF document...')

        // Load PDF with pdf.js
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
        const pdf = await loadingTask.promise

        console.log(`PDF loaded, ${pdf.numPages} pages`)

        // Extract text from all pages
        const pages = []
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(' ')

            console.log(`Page ${pageNum}: ${pageText.substring(0, 100)}...`)

            pages.push({
                page_number: pageNum,
                content: pageText
            })
        }

        // Save to course_docs table
        console.log('Saving extracted text to database...')

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
            pages: pdf.numPages,
            total_chars: pages.reduce((sum, p) => sum + p.content.length, 0)
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
