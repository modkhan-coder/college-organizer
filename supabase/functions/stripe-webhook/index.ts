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
                const isCancelled = subscription.status === 'canceled' || subscription.cancel_at_period_end === true

                if (isCancelled) {
                    console.log(`[WEBHOOK] Cancellation detected for sub ${subscription.id}. Checking for other active limits...`)

                    // Check if customer has ANY other active subscription (e.g. they just switched plans)
                    const activeSubs = await stripe.subscriptions.list({
                        customer: customerId,
                        status: 'active',
                        limit: 5
                    })

                    const trialingSubs = await stripe.subscriptions.list({
                        customer: customerId,
                        status: 'trialing',
                        limit: 5
                    })

                    // Filter out the subscription that just got cancelled/updated from the "active" list if it's there
                    const validActiveSubs = activeSubs.data.filter(s => s.id !== subscription.id && !s.cancel_at_period_end)
                    const validTrialingSubs = trialingSubs.data.filter(s => s.id !== subscription.id && !s.cancel_at_period_end)

                    if (validActiveSubs.length > 0 || validTrialingSubs.length > 0) {
                        console.log(`[WEBHOOK] Customer ${customerId} has other active subscriptions. NOT downgrading to FREE.`)
                        // Ideally we could update the profile to match the new active plan here, 
                        // but usually the checkout.session.completed event handles that.
                        // We just need to ensure we don't OVERWRITE it with 'free'.
                    } else {
                        console.log(`[WEBHOOK] No other active subscriptions found for ${customerId}. Resetting to FREE.`)
                        await supabaseAdmin.from('profiles').update({
                            plan: 'free',
                            subscription_status: 'canceled'
                        }).eq('stripe_customer_id', customerId)
                    }
                } else {
                    // It's NOT cancelled, meaning it might be an upgrade or reactivation from the Portal
                    console.log(`[WEBHOOK] Subscription ${subscription.id} updated (Active). Syncing plan details...`)

                    const priceId = subscription.items.data[0].price.id;
                    const productId = subscription.items.data[0].price.product;

                    // Fetch product details to know which plan it is
                    const product = await stripe.products.retrieve(productId);
                    const productName = product.name.toLowerCase();

                    let newPlan = 'free';
                    if (productName.includes('premium')) newPlan = 'premium';
                    else if (productName.includes('pro')) newPlan = 'pro';

                    if (newPlan !== 'free') {
                        console.log(`[WEBHOOK] Syncing Portal Upgrade: ${newPlan.toUpperCase()} for ${customerId}`);
                        await supabaseAdmin.from('profiles').update({
                            plan: newPlan,
                            subscription_status: 'active',
                            stripe_subscription_id: subscription.id
                        }).eq('stripe_customer_id', customerId)
                    }
                }
            }
                break
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (err) {
        console.error(err)
        return new Response(err.message, { status: 400 })
    }
})
