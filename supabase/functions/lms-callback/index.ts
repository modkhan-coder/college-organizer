import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const stateStr = url.searchParams.get('state')

    if (!code || !stateStr) {
        return new Response("Missing OAuth parameters", { status: 400 })
    }

    try {
        const state = JSON.parse(atob(stateStr))
        const { userId, provider, instanceUrl } = state

        // Initialize Supabase Admin (we need service role to write to DB during callback)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get Secret (Assuming it's stored in Supabase Env)
        // In a real production setup, you'd fetch this securely.
        const clientSecret = Deno.env.get('CANVAS_CLIENT_SECRET')
        const clientId = Deno.env.get('CANVAS_CLIENT_ID')

        if (!clientSecret || !clientId) {
            throw new Error("LMS OAuth credentials not configured in Supabase")
        }

        // 2. Exchange code for token
        const baseUrl = instanceUrl.startsWith('http') ? instanceUrl : `https://${instanceUrl}`
        const tokenUrl = `${baseUrl}/login/oauth2/token`

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/lms-callback`,
                code: code
            })
        })

        const tokenData = await response.json()

        if (!tokenData.access_token) {
            throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`)
        }

        // 3. Upsert Connection
        const { error } = await supabase.from('lms_connections').upsert({
            user_id: userId,
            provider: provider,
            instance_url: instanceUrl,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            sync_status: 'pending'
        }, { onConflict: 'user_id,provider' })

        if (error) throw error

        // 4. Success Redirect
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://localhost:5173'
        return Response.redirect(`${frontendUrl}/integrations?success=true`, 303)

    } catch (error) {
        console.error('OAuth Callback Error:', error)
        return new Response(`OAuth Error: ${error.message}`, { status: 500 })
    }
})
