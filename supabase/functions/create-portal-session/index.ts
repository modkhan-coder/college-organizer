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

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        // 2. Auth Check
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization Header')

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Not authenticated')

        const { returnPath = '/profile' } = await req.json().catch(() => ({}))
        console.log(`[PORTAL START] ReturnPath: ${returnPath}`);

        // 3. Initialize Stripe
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
        if (!stripeKey) throw new Error('Stripe API key missing')

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // 4. Fetch Profile for Customer ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single()

        const customerId = profile?.stripe_customer_id
        if (!customerId) {
            throw new Error('No Stripe customer found. Please upgrade to a paid plan first.')
        }

        // 5. Create Portal Session
        const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org'
        const returnUrl = new URL(returnPath, origin).toString()

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        })

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('[PORTAL] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
