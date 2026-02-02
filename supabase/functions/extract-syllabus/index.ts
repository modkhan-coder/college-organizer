import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
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
        console.log('=== Extract Syllabus Function Called ===')
        const body = await req.json()
        console.log('Request body:', JSON.stringify(body))

        const { pdf_id, course_id, user_id } = body

        console.log('Parameters:', { pdf_id, course_id, user_id })

        if (!pdf_id || !course_id || !user_id) {
            throw new Error(`Missing required parameters: pdf_id=${pdf_id}, course_id=${course_id}, user_id=${user_id}`)
        }

        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured')
        }

        const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

        // Get PDF file info
        const { data: pdfFile, error: pdfError } = await supabase
            .from('pdf_files')
            .select('file_path, file_name')
            .eq('id', pdf_id)
            .single()

        if (pdfError) throw new Error('PDF not found')

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

        // Convert PDF blob to base64 for OpenAI
        const arrayBuffer = await fileData.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        console.log('PDF converted to base64, length:', base64.length)

        // First, let's try getting text from course_docs if it exists
        const { data: docs, error: docsError } = await supabase
            .from('course_docs')
            .select('content')
            .eq('pdf_id', pdf_id)
            .order('page_number', { ascending: true })

        let fullText = ''

        if (docs && docs.length > 0) {
            // Use existing extracted text
            fullText = docs.map(d => d.content).join('\n\n')
            console.log('Using existing extracted text, length:', fullText.length)
        } else {
            // Extract text directly from the PDF  
            console.log('No pre-extracted text found, extracting from PDF...')

            // We'll use a simpler approach: download the PDF and send it to OpenAI
            // OpenAI can't process PDFs directly in this API, so we need text
            // For now, we'll just throw a helpful error
            throw new Error('Please upload your syllabus PDF to PDF Studio first, then mark it as a syllabus and try extraction again.')
        }

        if (!fullText || fullText.trim().length < 100) {
            throw new Error('Not enough text extracted from PDF. Please ensure the PDF contains readable text (not scanned images).')
        }

        // Call OpenAI with structured output
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-2024-08-06',
                messages: [
                    {
                        role: 'system',
                        content: `You are a syllabus extraction assistant. Extract structured information from course syllabi. 
                        
IMPORTANT RULES:
- If information is not found, return empty arrays or null values
- Include page citations for every extracted item
- For dates, use ISO format (YYYY-MM-DD) when possible
- If uncertain, mark confidence as "low"
- Extract ALL assignments and exams mentioned`
                    },
                    {
                        role: 'user',
                        content: `Extract course information from this syllabus:\n\n${fullText.substring(0, 30000)}`
                    }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'syllabus_extraction',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                course_info: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        instructor_name: { type: 'string' },
                                        instructor_email: { type: 'string' },
                                        location: { type: 'string' },
                                        meeting_times: { type: 'string' },
                                        citations: { type: 'array', items: { type: 'number' } }
                                    },
                                    required: ['title', 'instructor_name', 'instructor_email', 'location', 'meeting_times', 'citations'],
                                    additionalProperties: false
                                },
                                office_hours: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            day: { type: 'string' },
                                            time: { type: 'string' },
                                            location: { type: 'string' },
                                            citations: { type: 'array', items: { type: 'number' } }
                                        },
                                        required: ['day', 'time', 'location', 'citations'],
                                        additionalProperties: false
                                    }
                                },
                                grading_policy: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            category: { type: 'string' },
                                            weight: { type: 'number' },
                                            citations: { type: 'array', items: { type: 'number' } }
                                        },
                                        required: ['category', 'weight', 'citations'],
                                        additionalProperties: false
                                    }
                                },
                                key_dates: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            event: { type: 'string' },
                                            date: { type: 'string' },
                                            time: { type: 'string' },
                                            location: { type: 'string' },
                                            citations: { type: 'array', items: { type: 'number' } }
                                        },
                                        required: ['event', 'date', 'time', 'location', 'citations'],
                                        additionalProperties: false
                                    }
                                },
                                assignments: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            due_date: { type: 'string' },
                                            points: { type: 'number' },
                                            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                                            citations: { type: 'array', items: { type: 'number' } }
                                        },
                                        required: ['name', 'due_date', 'points', 'confidence', 'citations'],
                                        additionalProperties: false
                                    }
                                },
                                policies: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string' },
                                            description: { type: 'string' },
                                            citations: { type: 'array', items: { type: 'number' } }
                                        },
                                        required: ['type', 'description', 'citations'],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ['course_info', 'office_hours', 'grading_policy', 'key_dates', 'assignments', 'policies'],
                            additionalProperties: false
                        }
                    }
                }
            })
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`OpenAI API error: ${error}`)
        }

        const data = await response.json()
        const extracted = JSON.parse(data.choices[0].message.content)

        // Save extraction to database
        const { data: extraction, error: saveError } = await supabase
            .from('syllabus_extractions')
            .insert({
                user_id,
                course_id,
                pdf_id,
                extracted_json: extracted,
                status: 'success'
            })
            .select()
            .single()

        if (saveError) throw saveError

        return new Response(JSON.stringify({
            success: true,
            extraction_id: extraction.id,
            data: extracted
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Extraction error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
