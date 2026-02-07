import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function V5: create-checkout starting (Compatible Mode)...");

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Not authenticated')

        const { plan, interval = 'monthly', returnPath = '/pricing' } = await req.json().catch(() => ({}))
        if (!plan) throw new Error('No plan provided')

        // Initialize Stripe
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
        if (!stripeKey) throw new Error('Stripe API key missing')

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // Fetch Profile
        const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
        let customerId = profile?.stripe_customer_id

        // Check customer validity
        if (customerId) {
            try {
                const customer = await stripe.customers.retrieve(customerId) as any;
                if (customer.deleted) customerId = null;
            } catch (e) {
                customerId = null;
            }
        }

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId: user.id }
            })
            customerId = customer.id
            const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
            await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
        } else {
            // DUPLICATE GUARDRAIL: Check if customer already has active subscriptions
            const activeSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1
            });

            const trialingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'trialing',
                limit: 1
            });

            if (activeSubs.data.length > 0 || trialingSubs.data.length > 0) {
                console.log(`[CHECKOUT] Active sub found for ${user.id}, redirecting to Portal to prevent duplicate.`);
                const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org';
                const portalSession = await stripe.billingPortal.sessions.create({
                    customer: customerId,
                    return_url: new URL(returnPath, origin).toString(),
                });

                return new Response(JSON.stringify({ url: portalSession.url, status: "duplicate_rescue" }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // Downgrade Safeguard: Rescue with Portal Session
        if (plan === 'free') {
            console.log(`[CHECKOUT] Downgrade requested for ${user.id}, redirecting to Portal...`);
            const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org';
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: new URL(returnPath, origin).toString(),
            });

            return new Response(JSON.stringify({ url: portalSession.url }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const prices = {
            pro: { monthly: 499, yearly: 4999 },
            premium: { monthly: 999, yearly: 9999 }
        }
        const amount = prices[plan as keyof typeof prices]?.[interval as 'monthly' | 'yearly']
        if (!amount) throw new Error(`Invalid plan ${plan}`)

        // Construct dynamic URLs
        const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org'
        const successUrl = new URL(returnPath, origin)
        successUrl.searchParams.set('success', 'true')
        successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}')

        const cancelUrl = new URL(returnPath, origin)

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customerId,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: `College Org ${plan.toUpperCase()}` },
                    unit_amount: amount,
                    recurring: { interval: interval === 'monthly' ? 'month' : 'year' }
                },
                quantity: 1,
            }],
            success_url: successUrl.toString(),
            cancel_url: cancelUrl.toString(),
            metadata: { plan, userId: user.id }
        })

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err: any) {
        console.error(`Checkout Error: ${err.message}`)
        return new Response(JSON.stringify({ error: err.message, status: "diagnosed" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
