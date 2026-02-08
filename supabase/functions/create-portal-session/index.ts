import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'https://esm.sh/stripe@13.10.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const debugInfo: any = { steps: [] }

    try {
        debugInfo.steps.push('Starting portal session...')

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        // 2. Auth Check
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization Header', debug: debugInfo }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }
        debugInfo.steps.push('Auth header present')

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: `Auth failed: ${authError?.message || 'No user'}`, debug: debugInfo }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }
        debugInfo.steps.push(`User authenticated: ${user.id}`)

        const { returnPath = '/profile' } = await req.json().catch(() => ({}))
        debugInfo.returnPath = returnPath

        // 3. Initialize Stripe
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
        if (!stripeKey) {
            return new Response(JSON.stringify({ error: 'Stripe API key missing', debug: debugInfo }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }
        debugInfo.steps.push('Stripe key present')

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // 4. Fetch Profile for Customer ID
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single()

        if (profileError) {
            return new Response(JSON.stringify({ error: `Profile fetch failed: ${profileError.message}`, debug: debugInfo }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        const customerId = profile?.stripe_customer_id
        debugInfo.customerId = customerId

        if (!customerId) {
            return new Response(JSON.stringify({ error: 'No Stripe customer found. Please upgrade first.', debug: debugInfo }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }
        debugInfo.steps.push(`Customer ID: ${customerId}`)

        // 5. Create Portal Session
        const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org'
        const returnUrl = new URL(returnPath, origin).toString()
        debugInfo.returnUrl = returnUrl

        debugInfo.steps.push('Creating billing portal session...')

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        })

        debugInfo.steps.push(`Portal session created: ${session.id}`)
        debugInfo.portalUrl = session.url

        return new Response(JSON.stringify({ url: session.url, debug: debugInfo }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('[PORTAL] Error:', error.message, error.stack)
        debugInfo.error = error.message
        debugInfo.stack = error.stack

        return new Response(JSON.stringify({
            error: error.message,
            debug: debugInfo
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
