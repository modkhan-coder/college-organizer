import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'https://esm.sh/stripe@12.4.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization Header');
        }

        const token = authHeader.replace('Bearer ', '');

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // 1. Authenticate User
        const {
            data: { user },
            error: authError
        } = await supabaseClient.auth.getUser(token)

        if (authError) {
            console.error("Auth Error:", authError);
            throw new Error(`Auth Error: ${authError.message}`);
        }

        if (!user) {
            console.error("No user found");
            throw new Error('Unauthorized: User is null');
        }

        const { plan, interval } = await req.json() // plan: 'pro' | 'premium', interval: 'monthly' | 'yearly'

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
            apiVersion: '2026-01-28.clover' as any,
            httpClient: Stripe.createFetchHttpClient(),
        })

        // 2. Get User Profile for Stripe Customer ID
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        let customerId = profile?.stripe_customer_id

        // 3. Create Stripe Customer if not exists
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_uuid: user.id
                }
            })
            customerId = customer.id

            // Save to DB
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )
            await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
        }

        // 4. Check & Cancel existing subscription - AGGRESSIVE CLEANUP
        // We cancel ANY existing subscription to ensure a clean state
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            limit: 10
        })

        for (const sub of subscriptions.data) {
            if (sub.status !== 'canceled') {
                console.log('Cancelling sub:', sub.id);
                await stripe.subscriptions.del(sub.id);
            }
        }

        const frontendUrl = req.headers.get('origin') || 'http://localhost:5173'

        // HANDLE FREE PLAN (Downgrade complete)
        if (plan === 'free') {
            // DIRECT DB UPDATE (Bypass Webhook for speed/reliability)
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )
            await supabaseAdmin.from('profiles').update({ plan: 'free', stripe_subscription_id: null }).eq('id', user.id)

            return new Response(
                JSON.stringify({ url: `${frontendUrl}/pricing?downgrade=true` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // HANDLE PAID PLANS (Create New Subscription)
        const currency = 'usd'
        const prices = {
            pro: { monthly: 499, yearly: 4999 },
            premium: { monthly: 999, yearly: 9999 }
        }

        const amount = prices[plan]?.[interval]
        if (!amount) throw new Error('Invalid plan or interval')

        const priceData = {
            currency,
            product_data: {
                name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan (${interval})`,
                description: `Subscription to College Org ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            },
            unit_amount: amount,
            recurring: {
                interval: interval === 'monthly' ? 'month' : 'year'
            }
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customerId,
            line_items: [
                {
                    price_data: priceData,
                    quantity: 1,
                },
            ],
            success_url: `${frontendUrl}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/pricing`,
            metadata: {
                plan,
                userId: user.id
            }
        })

        return new Response(
            JSON.stringify({ url: session.url }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
