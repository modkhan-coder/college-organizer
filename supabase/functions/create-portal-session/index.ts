import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function: create-portal-session V2 starting...");

// Helper to decode JWT and get user ID
function getUserIdFromJwt(token: string): string | null {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return null
        const payload = JSON.parse(atob(parts[1]))
        return payload.sub || null
    } catch {
        return null
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        // Extract user ID from JWT token directly
        const token = authHeader.replace('Bearer ', '')
        const userId = getUserIdFromJwt(token)

        if (!userId) {
            throw new Error('Invalid token - could not extract user ID')
        }

        console.log(`[PORTAL] User ID from JWT: ${userId}`)

        const { returnPath = '/profile' } = await req.json().catch(() => ({}))
        console.log(`[PORTAL START] ReturnPath: ${returnPath}`)

        // Initialize Stripe
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
        if (!stripeKey) throw new Error('Stripe API key missing')

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // Use SERVICE ROLE KEY to fetch profile (bypasses RLS)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        if (!serviceRoleKey) throw new Error('Service role key missing')

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

        // Fetch Profile for Customer ID
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single()

        if (profileError) {
            console.error('[PORTAL] Profile error:', profileError)
            throw new Error(`Profile fetch failed: ${profileError.message}`)
        }

        const customerId = profile?.stripe_customer_id
        if (!customerId) {
            throw new Error('No Stripe customer found. Please upgrade to a paid plan first.')
        }

        console.log(`[PORTAL] Customer ID: ${customerId}`)

        // Create Portal Session
        const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org'
        const returnUrl = new URL(returnPath, origin).toString()

        console.log(`[PORTAL] Creating portal session for ${customerId}, return to ${returnUrl}`)

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        })

        console.log(`[PORTAL] Session created: ${session.url}`)

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('[PORTAL] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
