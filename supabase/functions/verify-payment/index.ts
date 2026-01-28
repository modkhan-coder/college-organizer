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

        if (authError || !user) {
            throw new Error('Unauthorized');
        }

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
            apiVersion: '2022-11-15',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // 2. Retrieve Session (Specific ID or Latest)
        let session;
        const { session_id } = await req.json().catch(() => ({}))

        // Get Customer ID from Profile
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single()
        const customerId = profile?.stripe_customer_id

        if (session_id) {
            session = await stripe.checkout.sessions.retrieve(session_id);
        } else if (customerId) {
            // Auto-scan: Get latest successful checkout for subscription
            const sessions = await stripe.checkout.sessions.list({
                customer: customerId,
                limit: 1,
                status: 'complete'
            })
            // Filter only valid subscription ones if needed? 
            // Usually the latest completed session is the one that matters.
            session = sessions.data[0]
        }

        if (!session) throw new Error('No payment session found');

        // Check if Paid
        if (session.payment_status !== 'paid' && session.status !== 'complete') {
            throw new Error('Payment not completed');
        }

        // Verify Subscription Status
        if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            if (sub.status !== 'active' && sub.status !== 'trialing') {
                throw new Error('Subscription not active');
            }
        }

        // 3. Get Plan from Metadata
        let plan = session.metadata?.plan;
        // Logic to infer from amount if metadata is missing (backup)
        if (!plan && session.amount_total) {
            if (session.amount_total === 499 || session.amount_total === 4999) plan = 'pro';
            if (session.amount_total === 999 || session.amount_total === 9999) plan = 'premium';
        }
        if (!plan) throw new Error('No plan metadata found');

        // 4. Update Profile (Bypassing Webhook)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Security Check: Verify the session belongs to this user
        if (session.metadata?.userId && session.metadata?.userId !== user.id) {
            throw new Error('Session user mismatch');
        }

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ plan: plan, stripe_subscription_id: session.subscription })
            .eq('id', user.id)

        if (updateError) throw updateError;

        // DEBUG SUBS
        const subs = await stripe.subscriptions.list({ customer: customerId, limit: 10 });

        return new Response(
            JSON.stringify({
                success: true,
                plan,
                debug_customer: customerId,
                debug_sub_count: subs.data.length,
            }),
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
