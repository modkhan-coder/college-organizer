
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { filePath } = await req.json()

        if (!filePath) {
            throw new Error('Missing filePath')
        }

        // Initialize Supabase Client (Service Role to bypass storage policy if needed, 
        // BUT better to use user's auth context for security)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Download file from storage
        // using 'course_materials' bucket
        const { data, error } = await supabaseClient.storage
            .from('course_materials')
            .download(filePath)

        if (error) {
            console.error('Storage download error:', error)
            throw error
        }

        // Convert Blob/File to Response
        // We stream it back with correct content type and CORS
        return new Response(data, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
                // Cache control for performance
                'Cache-Control': 'public, max-age=3600'
            }
        })

    } catch (error) {
        console.error('Download Proxy Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
