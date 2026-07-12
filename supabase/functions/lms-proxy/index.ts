import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Maximum allowed token length to prevent abuse
const MAX_TOKEN_LENGTH = 4096;

// Request timeout in milliseconds
const FETCH_TIMEOUT_MS = 10000;

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { provider, apiUrl, token } = await req.json()

        // Validate required fields
        if (!provider || !apiUrl || !token) {
            return new Response(JSON.stringify({ error: 'Missing required parameters: provider, apiUrl, token' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        // Validate token length (guard against oversized/malformed tokens)
        if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) {
            return new Response(JSON.stringify({ error: 'Invalid token format' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        // Validate apiUrl is an actual https URL (prevent SSRF to internal services)
        if (!apiUrl.startsWith('https://')) {
            return new Response(JSON.stringify({ error: 'apiUrl must use HTTPS' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        console.log(`LMS Proxy [${provider}]: Fetching ${apiUrl.substring(0, 80)}...`)

        // Fetch with a timeout so slow LMS endpoints don't hang the function
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

        let response: Response
        try {
            response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            })
        } finally {
            clearTimeout(timeoutId)
        }

        const data = await response.json()

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status,
        })

    } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError'
        const message = isTimeout ? 'LMS request timed out after 10 seconds' : error.message

        console.error(`LMS Proxy error: ${message}`)

        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: isTimeout ? 504 : 500,
        })
    }
})

