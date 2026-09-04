import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    try {
        const { signedPayload } = await req.json().catch(() => ({}));
        if (!signedPayload) {
            return new Response('OK', { status: 200 });
        }

        // Decode JWS (split by '.', get index 1, base64url decode)
        const parts = signedPayload.split('.');
        if (parts.length !== 3) {
            console.error('Invalid JWS format');
            return new Response('OK', { status: 200 });
        }
        
        // Use a function to properly decode base64url
        const decodeBase64Url = (str: string) => {
            const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
            const pad = base64.length % 4;
            const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
            return JSON.parse(atob(padded));
        };

        const payload = decodeBase64Url(parts[1]);
        const notificationType = payload.notificationType;
        const subtype = payload.subtype;
        
        const dataSigned = payload.data?.signedTransactionInfo;
        let originalTransactionId = null;
        
        if (dataSigned) {
            const dataParts = dataSigned.split('.');
            if (dataParts.length === 3) {
                const dataPayload = decodeBase64Url(dataParts[1]);
                originalTransactionId = dataPayload.originalTransactionId;
            }
        }

        let autoRenewStatus = null;
        if (payload.data?.signedRenewalInfo) {
            const renewalParts = payload.data.signedRenewalInfo.split('.');
            if (renewalParts.length === 3) {
                const renewalPayload = decodeBase64Url(renewalParts[1]);
                autoRenewStatus = renewalPayload.autoRenewStatus; // 1 for true, 0 for false in Apple API, or boolean
            }
        }

        if (!originalTransactionId) {
            console.log('No originalTransactionId found in payload, ignoring.');
            return new Response('OK', { status: 200 });
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let updateData: any = null;

        if (notificationType === 'DID_RENEW') {
            updateData = { subscription_status: 'active' };
        } else if (notificationType === 'DID_CHANGE_RENEWAL_STATUS') {
            // autoRenewStatus: 0 means false (turned off)
            if (autoRenewStatus === 0 || autoRenewStatus === false) {
                updateData = { subscription_status: 'canceling' };
            }
        } else if (notificationType === 'EXPIRED') {
            updateData = { plan: 'free', subscription_status: 'expired' };
        } else if (notificationType === 'REFUND') {
            updateData = { plan: 'free' };
        } else if (notificationType === 'DID_FAIL_TO_RENEW') {
            updateData = { subscription_status: 'billing_retry' };
        }

        if (updateData) {
            console.log(`Updating profile for transaction ${originalTransactionId} with`, updateData);
            const { error } = await supabaseAdmin
                .from('profiles')
                .update(updateData)
                .eq('apple_original_transaction_id', originalTransactionId);
                
            if (error) {
                console.error('Error updating profile:', error);
            }
        }

        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error('[APPLE WEBHOOK ERROR]', error.message)
        // Always return 200 to Apple to prevent retries if it's a non-recoverable error we don't care about
        return new Response('OK', { status: 200 })
    }
})
