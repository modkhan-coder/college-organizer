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

        const { plan, interval = 'monthly', returnPath = '/profile' } = await req.json().catch(() => ({}))
        console.log(`[CHECKOUT START] Plan: ${plan}, Interval: ${interval}, ReturnPath: ${returnPath}`);

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
            // PLAN SWITCH LOGIC: Allow switching to a different plan, block true duplicates
            const activeSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 5
            });

            const trialingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'trialing',
                limit: 1
            });

            // Check if any active subscription is for the SAME plan (true duplicate)
            const existingSub = activeSubs.data[0] || trialingSubs.data[0];

            if (existingSub && !existingSub.cancel_at_period_end) {
                // Get the product name by retrieving the price's product
                let currentProdName = '';
                const subItem = existingSub.items?.data?.[0];
                if (subItem?.price?.product) {
                    const productId = typeof subItem.price.product === 'string'
                        ? subItem.price.product
                        : subItem.price.product.id;
                    try {
                        const product = await stripe.products.retrieve(productId);
                        currentProdName = product.name?.toLowerCase() || '';
                    } catch (e) {
                        console.error('[CHECKOUT] Failed to retrieve product:', e);
                    }
                }

                console.log(`[CHECKOUT] Subscription ${existingSub.id} product name: "${currentProdName}"`);

                // Determine current plan from Stripe product name
                let currentPlan = 'unknown';
                if (currentProdName.includes('premium')) currentPlan = 'premium';
                else if (currentProdName.includes('pro')) currentPlan = 'pro';

                // FALLBACK: If Stripe product name detection fails, use the profile's stored plan
                if (currentPlan === 'unknown') {
                    // Get profile plan from database as fallback
                    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
                    const { data: profileData } = await supabaseAdmin
                        .from('profiles')
                        .select('plan')
                        .eq('id', user.id)
                        .single();

                    if (profileData?.plan && ['pro', 'premium'].includes(profileData.plan)) {
                        currentPlan = profileData.plan;
                        console.log(`[CHECKOUT] Using profile plan as fallback: ${currentPlan}`);
                    }
                }

                console.log(`[CHECKOUT] Detected currentPlan: ${currentPlan}, requestedPlan: ${plan}`);

                // Plan hierarchy: premium (3) > pro (2) > free (1)
                const planRank: Record<string, number> = { premium: 3, pro: 2, free: 1, unknown: 0 };
                const currentRank = planRank[currentPlan];
                const targetRank = planRank[plan];

                // If requesting the SAME plan = duplicate, redirect to portal
                if (currentPlan === plan) {
                    console.log(`[CHECKOUT] Same plan (${plan}) already active for ${user.id}, redirecting to Portal.`);
                    const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org';
                    const portalSession = await stripe.billingPortal.sessions.create({
                        customer: customerId,
                        return_url: new URL(returnPath, origin).toString(),
                    });
                    return new Response(JSON.stringify({ url: portalSession.url, status: "duplicate_rescue" }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }

                // DOWNGRADE (e.g., Premium → Pro): Update subscription in-place, no new payment
                if (targetRank < currentRank && plan !== 'free') {
                    console.log(`[CHECKOUT] DOWNGRADE detected: ${currentPlan} → ${plan}. Updating subscription in-place.`);

                    // Get the price ID for the target plan
                    const targetPrices = {
                        pro: { monthly: 499, yearly: 4999 },
                        premium: { monthly: 999, yearly: 9999 }
                    };
                    const targetAmount = targetPrices[plan as keyof typeof targetPrices]?.[interval as 'monthly' | 'yearly'];

                    // Create a new price for the target plan
                    const newPrice = await stripe.prices.create({
                        currency: 'usd',
                        product_data: { name: `College Org ${plan.toUpperCase()}` },
                        unit_amount: targetAmount,
                        recurring: { interval: interval === 'monthly' ? 'month' : 'year' }
                    });

                    // Update the subscription to the new price with proration
                    const updatedSub = await stripe.subscriptions.update(existingSub.id, {
                        items: [{
                            id: existingSub.items.data[0].id,
                            price: newPrice.id,
                        }],
                        proration_behavior: 'create_prorations', // Apply prorated credit
                        metadata: { plan, userId: user.id }
                    });

                    // Update the profile immediately
                    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
                    await supabaseAdmin.from('profiles').update({
                        plan: plan,
                        subscription_status: 'active'
                    }).eq('id', user.id);

                    console.log(`[CHECKOUT] Subscription ${updatedSub.id} downgraded to ${plan} successfully.`);

                    // Return success without redirect - frontend will handle UI update
                    const origin = req.headers.get('origin') || 'https://www.collegeorganizer.org';
                    const successUrl = new URL(returnPath, origin);
                    successUrl.searchParams.set('plan_switched', plan);

                    return new Response(JSON.stringify({
                        url: successUrl.toString(),
                        status: "downgrade_complete",
                        newPlan: plan
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }

                // UPGRADE (e.g., Pro → Premium): Do NOT cancel yet! Pass old sub ID for webhook to handle
                console.log(`[CHECKOUT] UPGRADE detected: ${currentPlan} → ${plan}. Will cancel old sub AFTER payment succeeds.`);
                // Store the old subscription ID to cancel after successful payment
                // This will be passed in the checkout metadata
            }

            // If all active subs are scheduled to cancel, allow new checkout
            if (activeSubs.data.length > 0 && activeSubs.data.every(s => s.cancel_at_period_end)) {
                console.log(`[CHECKOUT] Existing subs are all scheduled to cancel. Allowing new checkout for plan: ${plan}`);
            }
        }

        // Track old subscription for cancellation after payment (upgrade flow)
        let oldSubscriptionId = null;
        if (customerId) {
            const existingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1
            });
            if (existingSubs.data.length > 0 && !existingSubs.data[0].cancel_at_period_end) {
                oldSubscriptionId = existingSubs.data[0].id;
            }
        }

        // Downgrade to Free: Cancel subscription and update profile
        if (plan === 'free') {
            console.log(`[CHECKOUT] Downgrade to FREE requested for ${user.id}`);

            const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

            try {
                // Only try to cancel subscriptions if user has a Stripe customer ID
                if (customerId) {
                    // Find and cancel active subscriptions
                    const existingSubs = await stripe.subscriptions.list({
                        customer: customerId,
                        status: 'active',
                        limit: 5
                    });

                    for (const sub of existingSubs.data) {
                        console.log(`[CHECKOUT] Canceling subscription ${sub.id}...`);
                        await stripe.subscriptions.cancel(sub.id);
                    }

                    // Also cancel any trialing subscriptions
                    const trialingSubs = await stripe.subscriptions.list({
                        customer: customerId,
                        status: 'trialing',
                        limit: 5
                    });

                    for (const sub of trialingSubs.data) {
                        console.log(`[CHECKOUT] Canceling trial subscription ${sub.id}...`);
                        await stripe.subscriptions.cancel(sub.id);
                    }
                } else {
                    console.log(`[CHECKOUT] No Stripe customer ID for user ${user.id}, skipping subscription cancellation.`);
                }

                // Update profile to free plan
                console.log(`[CHECKOUT] Updating profile for user ${user.id} to free plan...`);
                const { data: updateData, error: updateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        plan: 'free',
                        subscription_status: 'canceled'
                    })
                    .eq('id', user.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error(`[CHECKOUT] Profile update error:`, updateError);
                    throw new Error(`Database update failed: ${updateError.message}`);
                }

                console.log(`[CHECKOUT] User ${user.id} successfully downgraded to FREE. New plan:`, updateData?.plan);

                return new Response(JSON.stringify({
                    status: 'downgrade_complete',
                    newPlan: 'free'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error(`[CHECKOUT] Error downgrading to free:`, error);

                // Even if Stripe fails, try to update the profile
                try {
                    await supabaseAdmin.from('profiles').update({
                        plan: 'free',
                        subscription_status: 'canceled'
                    }).eq('id', user.id);

                    return new Response(JSON.stringify({
                        status: 'downgrade_complete',
                        newPlan: 'free',
                        warning: 'Stripe cancellation may have failed, but profile updated'
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } catch (dbError) {
                    return new Response(JSON.stringify({ error: 'Failed to cancel subscription' }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }
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
            metadata: { plan, userId: user.id, oldSubscriptionId: oldSubscriptionId || '' }
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
