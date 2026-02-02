import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

        // Use pdf.co free API for PDF to text conversion
        const formData = new FormData()
        formData.append('file', fileData, pdfFile.file_name)

        console.log('Calling PDF.co API for text extraction...')

        const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
            method: 'POST',
            headers: {
                'x-api-key': 'demo' // Using demo key - you can get a free key at pdf.co
            },
            body: formData
        })

        if (!response.ok) {
            throw new Error(`PDF.co API error: ${response.statusText}`)
        }

        const result = await response.json()

        if (!result.url) {
            throw new Error('Failed to extract text from PDF')
        }

        // Download the extracted text
        const textResponse = await fetch(result.url)
        const extractedText = await textResponse.text()

        console.log(`Extracted ${extractedText.length} characters of text`)

        if (!extractedText || extractedText.length < 50) {
            throw new Error('Insufficient text extracted from PDF. Please ensure the PDF contains readable text.')
        }

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
