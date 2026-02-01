import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
    try {
        // Handle CORS
        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders })
        }

        // Get audio file from form data
        const formData = await req.formData()
        const audioFile = formData.get('audio')

        if (!audioFile) {
            throw new Error('No audio file provided')
        }

        // Convert to blob for OpenAI
        const audioBlob = await audioFile.arrayBuffer()

        // Call OpenAI Whisper API
        const whisperFormData = new FormData()
        whisperFormData.append('file', new Blob([audioBlob], { type: 'audio/webm' }), 'recording.webm')
        whisperFormData.append('model', 'whisper-1')

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: whisperFormData
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Whisper API error: ${error}`)
        }

        const data = await response.json()

        return new Response(JSON.stringify({ text: data.text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Transcription error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
