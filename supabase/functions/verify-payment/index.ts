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

        // 2. FALLBACK: Intelligent Active Plan Search
        if (!planToFulfill && stripeCustomerId) {
            console.log('Searching for active subscriptions for customer:', stripeCustomerId);
            const subscriptions = await stripe.subscriptions.list({
                customer: stripeCustomerId,
                status: 'all', // Fetch all to see overlapping states if needed, but we filter below
                expand: ['data.plan.product'],
                limit: 10
            });

            // Filter for valid active/trialing subs
            const validSubs = subscriptions.data.filter(s =>
                (s.status === 'active' || s.status === 'trialing')
            );

            // Sort/Prioritize: 
            // 1. Prefer NOT cancelled (cancel_at_period_end === false)
            // 2. Prefer Higher Tier (Premium > Pro) if multiple exist
            validSubs.sort((a, b) => {
                // Priority 1: Non-cancelled first
                if (a.cancel_at_period_end !== b.cancel_at_period_end) {
                    return a.cancel_at_period_end ? 1 : -1; // false comes before true
                }
                // Priority 2: Premium over Pro
                const prodA = (a as any).plan?.product?.name?.toLowerCase() || '';
                const prodB = (b as any).plan?.product?.name?.toLowerCase() || '';
                const isPremA = prodA.includes('premium');
                const isPremB = prodB.includes('premium');
                if (isPremA && !isPremB) return -1;
                if (!isPremA && isPremB) return 1;
                return 0;
            });

            const bestSub = validSubs[0]; // The winner

            if (bestSub) {
                // Map Stripe Product back to our plan names
                const prodName = (bestSub as any).plan?.product?.name?.toLowerCase() || '';
                if (prodName.includes('premium')) planToFulfill = 'premium';
                else if (prodName.includes('pro')) planToFulfill = 'pro';

                // If the "best" sub is actually scheduled to cancel AND there are no other active subs,
                // we might want to respect the cancellation if we are in "Immediate Downgrade" mode.
                // BUT, if we found it here, it means it's still 'active' status.
                // The previous logic forced 'free' if cancel_at_period_end was true.
                // We should only force 'free' if ALL valid subs are cancelling.
                const allCancelling = validSubs.every(s => s.cancel_at_period_end);

                if (allCancelling) {
                    console.log('All active subscriptions are cancelling. Treating as FREE for immediate downgrade.');
                    planToFulfill = null; // Fall through to reset logic
                } else {
                    subscriptionId = bestSub.id;
                    console.log('Found best active subscription:', planToFulfill);
                }
            } else {
                console.log('No eligible active subscriptions found.');
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
        } else {
            // No active plan found - Ensure profile is reset to free
            if (profile?.plan !== 'free') {
                const supabaseAdmin = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                )
                await supabaseAdmin.from('profiles').update({
                    plan: 'free',
                    subscription_status: 'canceled'
                }).eq('id', user.id)
            }
            return new Response(JSON.stringify({ success: true, plan: 'free' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

    } catch (error) {
        console.error('[VERIFY ERROR]', error.message)
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})

