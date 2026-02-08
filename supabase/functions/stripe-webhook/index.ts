import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature')

    if (!signature) {
        return new Response('No signature', { status: 400 })
    }

    try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        const body = await req.text()
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')

        let event
        try {
            event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret!)
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
                const newSubscriptionId = session.subscription

                if (userId && plan) {
                    await supabaseAdmin.from('profiles').update({
                        plan: plan,
                        subscription_status: 'active',
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: newSubscriptionId
                    }).eq('id', userId)

                    // CLEANUP: Cancel any OTHER active subscriptions for this customer
                    // This ensures we don't have double billing, but only AFTER success.
                    if (session.customer && newSubscriptionId) {
                        try {
                            const subscriptions = await stripe.subscriptions.list({
                                customer: session.customer,
                                status: 'active',
                                limit: 10
                            })

                            for (const sub of subscriptions.data) {
                                if (sub.id !== newSubscriptionId) {
                                    console.log(`Cancelling old subscription: ${sub.id} (New: ${newSubscriptionId})`)
                                    await stripe.subscriptions.cancel(sub.id)
                                }
                            }
                        } catch (cleanupError) {
                            console.error('Error cleaning up old subscriptions:', cleanupError)
                            // We don't want to fail the webhook for this, but we should log it.
                        }
                    }
                }
                break
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                const customerId = subscription.customer

                // Only reset to FREE if the subscription is ACTUALLY canceled, not just scheduled to cancel
                // cancel_at_period_end=true means the user might be upgrading/switching plans
                const isActuallyCanceled = subscription.status === 'canceled'

                if (isActuallyCanceled) {
                    console.log(`[WEBHOOK] Subscription ${subscription.id} cancelled. Checking for other active subs...`)

                    // Check if user has ANY other active subscription before resetting to free
                    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
                        apiVersion: '2023-10-16',
                        httpClient: Stripe.createFetchHttpClient(),
                    })

                    try {
                        const activeSubs = await stripe.subscriptions.list({
                            customer: customerId as string,
                            status: 'active',
                            limit: 1
                        })

                        if (activeSubs.data.length === 0) {
                            console.log(`[WEBHOOK] No other active subs for ${customerId}. Resetting to FREE.`)
                            await supabaseAdmin.from('profiles').update({
                                plan: 'free',
                                subscription_status: 'canceled'
                            }).eq('stripe_customer_id', customerId)
                        } else {
                            console.log(`[WEBHOOK] User still has active sub ${activeSubs.data[0].id}. Keeping plan.`)
                        }
                    } catch (checkError) {
                        console.error('[WEBHOOK] Error checking active subs:', checkError)
                        // Don't reset on error - better to leave user on current plan
                    }
                }
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
