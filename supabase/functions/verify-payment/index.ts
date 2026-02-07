import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

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
        if (!authHeader) throw new Error('Missing Authorization Header');

        const token = authHeader.replace('Bearer ', '');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
        if (authError || !user) throw new Error('Unauthorized');

        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is missing');

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // Get logic from body
        const { session_id } = await req.json().catch(() => ({}))
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('stripe_customer_id, plan')
            .eq('id', user.id)
            .single()

        let planToFulfill = null;
        let subscriptionId = null;
        let stripeCustomerId = profile?.stripe_customer_id;

        // 1. Try Session ID first
        if (session_id) {
            try {
                const session = await stripe.checkout.sessions.retrieve(session_id);
                if (session.payment_status === 'paid' && session.metadata?.plan) {
                    planToFulfill = session.metadata.plan;
                    subscriptionId = session.subscription as string;
                    stripeCustomerId = session.customer as string;
                }
            } catch (e) {
                console.error('Session retrieval failed:', e.message);
            }
        }

        // 2. FALLBACK: If no plan yet, search active subscriptions for this customer
        if (!planToFulfill && stripeCustomerId) {
            console.log('Searching for active subscriptions for customer:', stripeCustomerId);
            const subscriptions = await stripe.subscriptions.list({
                customer: stripeCustomerId,
                status: 'active',
                expand: ['data.plan.product'],
                limit: 10
            });

            const activeSub = subscriptions.data.find(s => s.status === 'active' || s.status === 'trialing');
            if (activeSub) {
                // Map Stripe Product back to our plan names
                // We'll use metadata from the subscription if available, or name mapping
                const prodName = (activeSub as any).plan?.product?.name?.toLowerCase() || '';
                if (prodName.includes('premium')) planToFulfill = 'premium';
                else if (prodName.includes('pro')) planToFulfill = 'pro';

                subscriptionId = activeSub.id;
                console.log('Found active subscription via fallback:', planToFulfill);
            }
        }

        if (planToFulfill) {
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            await supabaseAdmin.from('profiles').update({
                plan: planToFulfill,
                subscription_status: 'active',
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: subscriptionId
            }).eq('id', user.id)

            return new Response(JSON.stringify({ success: true, plan: planToFulfill }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ success: true, plan: profile?.plan || 'free' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error) {
        console.error('[VERIFY ERROR]', error.message)
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})

