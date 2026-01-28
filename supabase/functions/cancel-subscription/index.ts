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
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization Header')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
            apiVersion: '2022-11-15',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // Get Profile
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single()

        const customerId = profile?.stripe_customer_id
        if (!customerId) throw new Error('No Customer ID found')

        // List Subs
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            limit: 10
        })

        const logs = []
        let cancelledCount = 0

        for (const sub of subscriptions.data) {
            logs.push(`Found sub: ${sub.id} status: ${sub.status}`)
            if (sub.status !== 'canceled') {
                try {
                    await stripe.subscriptions.del(sub.id)
                    logs.push(`Deleted ${sub.id}`)
                    cancelledCount++
                } catch (e) {
                    logs.push(`Error deleting ${sub.id}: ${e.message}`)
                }
            }
        }

        // Update DB to free as verification
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        await supabaseAdmin.from('profiles').update({ plan: 'free', stripe_subscription_id: null }).eq('id', user.id)


        return new Response(
            JSON.stringify({
                success: true,
                customer: customerId,
                found: subscriptions.data.length,
                cancelled: cancelledCount,
                logs
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
