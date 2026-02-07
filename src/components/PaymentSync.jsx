import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

/**
 * Global component that listens for Stripe redirect parameters (success, session_id, downgrade, updated)
 * and triggers verification/notifications globally.
 */
const PaymentSync = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, saveUser, addNotification } = useApp();

    useEffect(() => {
        if (!user?.id) return;

        const verifyPayment = async (sessionId) => {
            try {
                // We use supabase.functions.invoke directly to avoid cyclic dependencies 
                // if we were to put this in AppContext
                const { data, error } = await supabase.functions.invoke('verify-payment', {
                    body: { session_id: sessionId }
                });

                if (error) {
                    console.error('[PaymentSync] Verification Error:', error);
                    return;
                }

                if (data?.success && data?.plan) {
                    if (data.plan !== user.plan) {
                        console.log('[PaymentSync] Plan mismatch, syncing to:', data.plan);
                        saveUser({ ...user, plan: data.plan });
                        addNotification(`Successfully upgraded to ${data.plan.toUpperCase()}! 🚀`, 'success');
                    }
                }
            } catch (e) {
                console.error('[PaymentSync] Critical caught error:', e);
            } finally {
                // Clear the params so they don't trigger again on refresh
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('success');
                newParams.delete('session_id');
                setSearchParams(newParams, { replace: true });
            }
        };

        const isSuccess = searchParams.get('success') === 'true';
        const sessionId = searchParams.get('session_id');
        const isDowngrade = searchParams.get('downgrade') === 'true';
        const isUpdated = searchParams.get('updated') === 'true';

        if (isSuccess && sessionId) {
            verifyPayment(sessionId);
        } else if (isDowngrade) {
            addNotification('Subscription downgraded to Free.', 'info');
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('downgrade');
            setSearchParams(newParams, { replace: true });
        } else if (isUpdated) {
            addNotification('Subscription updated successfully!', 'success');
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('updated');
            setSearchParams(newParams, { replace: true });
        }
    }, [user?.id, searchParams]);

    return null; // Invisible global listener
};

export default PaymentSync;
