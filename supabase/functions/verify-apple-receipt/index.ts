import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

        const { transactionId, receiptData, productId } = await req.json().catch(() => ({}))
        
        if (!receiptData) {
            throw new Error('Missing receiptData');
        }

        const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
        if (!sharedSecret) throw new Error('APPLE_SHARED_SECRET is missing');

        // Verify with Apple
        const requestBody = {
            'receipt-data': receiptData,
            'password': sharedSecret,
            'exclude-old-transactions': true
        };

        let verifyUrl = 'https://buy.itunes.apple.com/verifyReceipt';
        let verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
        let verifyData = await verifyRes.json();

        // Status 21007 means this is a sandbox receipt, but it was sent to the production service.
        if (verifyData.status === 21007) {
            verifyUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
            verifyRes = await fetch(verifyUrl, {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
            verifyData = await verifyRes.json();
        }

        if (verifyData.status !== 0) {
            throw new Error(`Receipt verification failed with status: ${verifyData.status}`);
        }

        // Determine plan from productId
        let planToFulfill = 'free';
        if (productId === 'college_org_pro_monthly' || productId === 'college_org_pro_yearly') {
            planToFulfill = 'pro';
        } else if (productId === 'college_org_premium_monthly' || productId === 'college_org_premium_yearly') {
            planToFulfill = 'premium';
        } else {
            // Try to find the latest active product in the receipt
            const latestInfo = verifyData.latest_receipt_info;
            if (latestInfo && latestInfo.length > 0) {
                // sort by expires_date_ms descending
                latestInfo.sort((a: any, b: any) => Number(b.expires_date_ms) - Number(a.expires_date_ms));
                const latestProduct = latestInfo[0].product_id;
                if (latestProduct === 'college_org_pro_monthly' || latestProduct === 'college_org_pro_yearly') {
                    planToFulfill = 'pro';
                } else if (latestProduct === 'college_org_premium_monthly' || latestProduct === 'college_org_premium_yearly') {
                    planToFulfill = 'premium';
                }
            }
        }

        if (planToFulfill === 'free') {
            throw new Error('Unknown product ID or no active subscription found');
        }

        // Get the original transaction id
        let originalTransactionId = transactionId;
        const latestInfo = verifyData.latest_receipt_info;
        if (latestInfo && latestInfo.length > 0) {
             originalTransactionId = latestInfo[0].original_transaction_id;
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabaseAdmin.from('profiles').update({
            plan: planToFulfill,
            subscription_status: 'active',
            payment_provider: 'apple',
            apple_original_transaction_id: originalTransactionId
        }).eq('id', user.id);

        return new Response(JSON.stringify({ success: true, plan: planToFulfill, status: 'active' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })

    } catch (error: any) {
        console.error('[VERIFY APPLE RECEIPT ERROR]', error.message)
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
        })
    }
})
