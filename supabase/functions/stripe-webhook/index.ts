import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import Stripe from 'https://esm.sh/stripe@12.4.0?target=deno'

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature')

    if (!signature) {
        return new Response('No signature', { status: 400 })
    }

    try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
            apiVersion: '2022-11-15',
            httpClient: Stripe.createFetchHttpClient(),
        })

        const body = await req.text()
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')

        let event
        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret!)
        } catch (err) {
            console.error(`Webhook signature verification failed.`, err.message)
            return new Response(err.message, { status: 400 })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const userId = session.metadata?.userId
                const plan = session.metadata?.plan

                if (userId && plan) {
                    await supabaseAdmin.from('profiles').update({
                        plan: plan,
                        subscription_status: 'active',
                        stripe_customer_id: session.customer
                    }).eq('id', userId)
                }
                break
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                const customerId = subscription.customer

                await supabaseAdmin.from('profiles').update({
                    plan: 'free',
                    subscription_status: 'canceled'
                }).eq('stripe_customer_id', customerId)
                break
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (err) {
        console.error(err)
        return new Response(err.message, { status: 400 })
    }
})
