import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Check, X, CreditCard, Star, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { isIAPAvailable, purchaseProduct, getProductPrice, restorePurchases, PRODUCTS, PRODUCT_TO_PLAN } from '../utils/iapService';

const PricingPage = ({ isModal = false, onClose }) => {
    const { user, saveUser, addNotification } = useApp();
    const navigate = useNavigate();
    const [processingPlan, setProcessingPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' | 'yearly'
    const [verifying, setVerifying] = useState(false);

    // Safety check for user.plan
    const currentPlan = user?.plan || 'free';

    const isIOS = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();

    const [applePrices, setApplePrices] = useState({
        proMonthly: null,
        proYearly: null,
        premiumMonthly: null,
        premiumYearly: null
    });

    useEffect(() => {
        if (isIOS) {
            setApplePrices({
                proMonthly: getProductPrice(PRODUCTS.PRO_MONTHLY),
                proYearly: getProductPrice(PRODUCTS.PRO_YEARLY),
                premiumMonthly: getProductPrice(PRODUCTS.PREMIUM_MONTHLY),
                premiumYearly: getProductPrice(PRODUCTS.PREMIUM_YEARLY)
            });
        }
    }, [isIOS]);

    // Payment verification is now handled globally by PaymentSync

    const handleManageBilling = async () => {
        setProcessingPlan('portal');
        try {
            // FORCE SESSION REFRESH: Ensure token is fresh before calling Edge Function
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                addNotification('Session expired. Please log in again.', 'error');
                navigate('/login');
                return;
            }

            // Determine return path based on current location
            const currentPath = window.location.pathname;
            const returnPath = currentPath === '/pricing' ? '/profile' : currentPath;

            console.log('[PORTAL] Requesting portal with returnPath:', returnPath);

            const { data, error } = await supabase.functions.invoke('create-portal-session', {
                body: { returnPath }
            });

            if (error) throw error;
            if (data?.url) {
                if (Capacitor.isNativePlatform()) {
                    await Browser.open({ url: data.url });
                } else {
                    window.location.href = data.url;
                }
            } else {
                throw new Error('No portal URL received');
            }
        } catch (error) {
            console.error('[PORTAL] Failed:', error);
            addNotification(`Billing management failed: ${error.message || 'Unknown error'}`, 'error');
            setProcessingPlan(null);
        }
    };

    const handleUpgrade = async (plan) => {
        // For downgrade to free, we use create-checkout which now handles cancellation
        if (plan === user?.plan) {
            addNotification(`You are already on the ${plan.toUpperCase()} plan`, 'info');
            return;
        }

        setProcessingPlan(plan);
        try {
            if (isIOS && plan !== 'free') {
                let productId = null;
                if (plan === 'pro') {
                    productId = billingCycle === 'monthly' ? PRODUCTS.PRO_MONTHLY : PRODUCTS.PRO_YEARLY;
                } else if (plan === 'premium') {
                    productId = billingCycle === 'monthly' ? PRODUCTS.PREMIUM_MONTHLY : PRODUCTS.PREMIUM_YEARLY;
                }

                if (productId) {
                    console.log('[UPGRADE] iOS IAP purchase for:', productId);
                    console.log('[UPGRADE] IAP Available:', isIAPAvailable());
                    console.log('[UPGRADE] CdvPurchase exists:', !!window.CdvPurchase);
                    
                    if (!isIAPAvailable()) {
                        // IAP store not ready — fall back to Stripe web checkout
                        console.warn('[UPGRADE] IAP not available, falling back to Stripe checkout');
                        // Don't return, let it fall through to Stripe flow below
                    } else {
                        await purchaseProduct(productId);
                        // Optimistic update: immediately reflect the new plan in UI
                        const newPlan = PRODUCT_TO_PLAN[productId] || plan;
                        saveUser({ ...user, plan: newPlan, payment_provider: 'apple', subscription_status: 'active' });
                        addNotification(`🎉 Upgraded to ${newPlan.toUpperCase()}!`, 'success');
                        setProcessingPlan(null);
                        // Navigate back to the feature they were trying to access
                        if (isModal && onClose) {
                            onClose();
                        } else {
                            navigate(-1);
                        }
                        return;
                    }
                }
            }

            // FORCE SESSION REFRESH: Ensure token is fresh before calling Edge Function
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                addNotification('Session expired. Please log in again.', 'error');
                navigate('/login');
                return;
            }

            // Determine return path based on current location
            const currentPath = window.location.pathname;
            const returnPath = currentPath === '/pricing' ? '/profile' : currentPath;

            console.log(`[UPGRADE] Initiating ${plan} (${billingCycle}) with returnPath:`, returnPath);

            const response = await supabase.functions.invoke('create-checkout', {
                body: {
                    plan,
                    interval: billingCycle,
                    returnPath
                }
            });

            const { data, error } = response;

            if (error) {
                console.error('[UPGRADE] Error:', error);
                let message = error.message;
                if (error.context && typeof error.context.json === 'function') {
                    try {
                        const errBody = await error.context.json();
                        if (errBody.error) message = errBody.error;
                    } catch (e) {
                        // Ignore parse failure
                    }
                }
                throw new Error(message);
            }

            if (data?.error) throw new Error(data.error);

            // Handle instant downgrade (no payment needed)
            if (data?.status === 'downgrade_complete') {
                console.log('[UPGRADE] Downgrade completed instantly:', data.newPlan);

                // Safety: Also update profile directly from frontend
                // This ensures the update happens even if Edge Function's update failed
                try {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({
                            plan: data.newPlan,
                            subscription_status: 'canceled'
                        })
                        .eq('id', user.id);

                    if (updateError) {
                        console.error('[UPGRADE] Frontend profile update failed:', updateError);
                    } else {
                        console.log('[UPGRADE] Frontend profile update succeeded');
                    }
                } catch (e) {
                    console.error('[UPGRADE] Frontend profile update error:', e);
                }

                addNotification(`Successfully switched to ${data.newPlan.toUpperCase()} plan!`, 'success');
                setProcessingPlan(null);

                // Refetch user data to update UI
                window.dispatchEvent(new Event('refetch-user'));

                // Close modal if open
                if (onClose) onClose();
                return;
            }

            if (data?.url) {
                if (Capacitor.isNativePlatform()) {
                    await Browser.open({ url: data.url });
                } else {
                    window.location.href = data.url;
                }
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error) {
            console.error('[UPGRADE] Failed:', error);
            console.error('[UPGRADE] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            addNotification(`Checkout failed: ${error.message || error.code || JSON.stringify(error) || 'Unknown error'}`, 'error');
            setProcessingPlan(null);
        }
    };

    if (verifying) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #eee', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }}></div>
                <h2 style={{ marginTop: '20px' }}>Verifying Payment...</h2>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const Feature = ({ included, text }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: included ? 'var(--text-main)' : 'var(--text-secondary)', opacity: included ? 1 : 0.6 }}>
            {included ? <Check size={16} color="var(--success)" /> : <X size={16} />}
            <span style={{ fontSize: '0.9rem' }}>{text}</span>
        </div>
    );

    const content = (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isModal ? '0' : '24px 0', position: 'relative' }}>
            {isModal ? (
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: window.innerWidth <= 768 ? '10px' : '-20px',
                        right: '0',
                        background: 'rgba(0,0,0,0.1)',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '10px',
                        borderRadius: '50%',
                        zIndex: 10
                    }}
                >
                    <X size={24} />
                </button>
            ) : (
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        cursor: 'pointer',
                        color: 'var(--text-main)',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                        marginBottom: '20px',
                        minHeight: '44px',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <ArrowLeft size={18} />
                    Back
                </button>
            )}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '16px' }}>Upgrade your College Life</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '24px' }}>Unlock unlimited courses, assignments, and advanced features. (v1.1.0-portal)</p>

                {/* Billing Toggle */}
                <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '4px', borderRadius: '30px', border: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        style={{
                            padding: '8px 24px',
                            borderRadius: '24px',
                            border: 'none',
                            background: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                            color: billingCycle === 'monthly' ? 'white' : 'var(--text-secondary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        style={{
                            padding: '8px 24px',
                            borderRadius: '24px',
                            border: 'none',
                            background: billingCycle === 'yearly' ? 'var(--primary)' : 'transparent',
                            color: billingCycle === 'yearly' ? 'white' : 'var(--text-secondary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        Yearly <span style={{ fontSize: '0.7rem', background: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>SAVE 20%</span>
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {/* Free Tier */}
                <div className="card" style={{ border: currentPlan === 'free' ? '2px solid var(--primary)' : '1px solid var(--border)', position: 'relative' }}>
                    {currentPlan === 'free' && <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>CURRENT</div>}
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Get Organized</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0' }}>$0<span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mo</span></div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Essential tools to track your assignments.</p>

                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%', marginBottom: '24px' }}
                        disabled={!user ? false : (currentPlan === 'free' || processingPlan === 'free')}
                        onClick={() => {
                            if (!user) {
                                navigate('/login');
                                return;
                            }
                            handleUpgrade('free');
                        }}
                    >
                        {!user ? 'Get Started' : processingPlan === 'free' ? 'Processing...' : currentPlan === 'free' ? 'Active Plan' : 'Downgrade'}
                    </button>

                    <Feature included={true} text="3 Courses Max" />
                    <Feature included={true} text="20 Active Assignments" />
                    <Feature included={true} text="Basic Grade Calculator" />
                    <Feature included={false} text="LMS Integration (Sync)" />
                    <Feature included={false} text="Unlimited History" />
                    <Feature included={false} text="Priority Support" />
                </div>

                {/* Pro Tier */}
                <div className="card" style={{ border: currentPlan === 'pro' ? '2px solid var(--accent)' : '1px solid var(--border)', position: 'relative', transform: 'scale(1.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', padding: '4px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>MOST POPULAR</div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={24} fill="var(--accent)" color="var(--accent)" /> Boost Your GPA
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: '600' }}>
                        {billingCycle === 'yearly' ? 'Pro Yearly Subscription' : 'Pro Monthly Subscription'}
                    </p>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0 4px 0' }}>
                        {isIOS ? (billingCycle === 'yearly' ? (applePrices.proYearly || '$49.99') : (applePrices.proMonthly || '$4.99')) : (billingCycle === 'yearly' ? '$49.99' : '$4.99')}
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                        {billingCycle === 'yearly' ? 'Billed annually at $49.99/year. Auto-renews every 12 months.' : 'Billed monthly at $4.99/month. Auto-renews every month.'}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Advanced tools to forecast and improve grades.</p>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginBottom: '24px', background: currentPlan === 'pro' ? 'var(--bg-surface)' : 'var(--accent)', color: currentPlan === 'pro' ? 'var(--text-main)' : 'white' }}
                        disabled={currentPlan === 'pro' || !!processingPlan}
                        onClick={() => {
                            if (!user) {
                                navigate('/login');
                                return;
                            }
                            handleUpgrade('pro');
                        }}
                    >
                        {!user ? 'Get Started' : processingPlan === 'pro' ? 'Processing...' : currentPlan === 'pro' ? 'Active Plan' : `Upgrade to Pro (${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})`}
                    </button>

                    <Feature included={true} text="Unlimited Courses" />
                    <Feature included={true} text="Unlimited Assignments" />
                    <Feature included={true} text="Advanced Grade Forecaster" />
                    <Feature included={true} text="LMS Integration (Sync)" />
                    <Feature included={true} text="Email Digests" />
                    <Feature included={false} text="Smart Study Plans (AI)" />
                    <Feature included={false} text="AI Study Schedule Generation" />
                    <Feature included={false} text="AI Quizzes" />
                    <Feature included={false} text="Chat with Documents (PDF)" />
                    <Feature included={false} text="Priority Support" />
                </div>

                {/* Premium Tier */}
                <div className="card" style={{ border: currentPlan === 'premium' ? '2px solid var(--warning)' : '1px solid var(--border)', position: 'relative' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Star size={24} fill="var(--warning)" color="var(--warning)" /> Automate Your Success
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: '600' }}>
                        {billingCycle === 'yearly' ? 'Premium Yearly Subscription' : 'Premium Monthly Subscription'}
                    </p>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0 4px 0' }}>
                        {isIOS ? (billingCycle === 'yearly' ? (applePrices.premiumYearly || '$99.99') : (applePrices.premiumMonthly || '$9.99')) : (billingCycle === 'yearly' ? '$99.99' : '$9.99')}
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                        {billingCycle === 'yearly' ? 'Billed annually at $99.99/year. Auto-renews every 12 months.' : 'Billed monthly at $9.99/month. Auto-renews every month.'}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Let AI build your perfect study schedule.</p>

                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%', marginBottom: '24px', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                        disabled={currentPlan === 'premium' || !!processingPlan}
                        onClick={() => {
                            if (!user) {
                                navigate('/login');
                                return;
                            }
                            handleUpgrade('premium');
                        }}
                    >
                        {!user ? 'Get Started' : processingPlan === 'premium' ? 'Processing...' : currentPlan === 'premium' ? 'Active Plan' : `Get Premium (${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})`}
                    </button>

                    <Feature included={true} text="Everything in Pro" />
                    <Feature included={true} text="50 AI Credits/mo" />
                    <Feature included={true} text="↳ 10 chat messages = 1 credit" />
                    <Feature included={true} text="↳ 1 quiz, notes, or schedule = 1 credit" />
                    <Feature included={true} text="PDF Studio (Chat with PDFs)" />
                    <Feature included={true} text="AI Notes & Quiz Generation" />
                    <Feature included={true} text="Smart Study Schedule Builder" />
                    <Feature included={true} text="Priority Support" />
                    <Feature included={true} text="Early Access Features" />
                    <Feature included={true} text="Custom Themes" />
                </div>
            </div>

            {/* Apple-Required Subscription Disclosures — 3.1.2 Compliance */}
            {isIOS && (
                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                    {/* Restore Purchases — prominent placement */}
                    <button
                        onClick={async () => {
                            try {
                                addNotification('Restoring purchases...', 'info');
                                await restorePurchases();
                                addNotification('Purchases restored successfully!', 'success');
                                const { data } = await supabase.from('profiles').select('plan').eq('id', user?.id).single();
                                if (data?.plan && data.plan !== 'free') {
                                    window.location.reload();
                                }
                            } catch (err) {
                                addNotification('No previous purchases found.', 'info');
                            }
                        }}
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            marginBottom: '20px',
                            minHeight: '44px',
                        }}
                    >
                        Restore Purchases
                    </button>
                </div>
            )}

            <div style={{ marginTop: isIOS ? '0' : '32px', padding: '20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.6' }}>
                {isIOS ? (
                    <>
                        <p style={{ marginBottom: '8px' }}>
                            Payment will be charged to iTunes Account at confirmation of purchase. Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period. Account will be charged for renewal within 24-hours prior to the end of the current period. Subscriptions may be managed by the user and auto-renewal may be turned off by going to the user's Account Settings after purchase.
                        </p>
                    </>
                ) : (
                    <p style={{ marginBottom: '8px' }}>
                        Secure payment processing via Stripe. You can cancel your subscription anytime from your profile settings.
                    </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '0.8rem' }}>
                    <a
                        href="/privacy"
                        onClick={(e) => { e.preventDefault(); navigate('/privacy'); if (onClose) onClose(); }}
                        style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                    >
                        Privacy Policy
                    </a>
                    <a
                        href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                    >
                        Terms of Use (EULA)
                    </a>
                </div>
            </div>
        </div>
    );

    if (isModal) {
        const isMobile = window.innerWidth <= 768;
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: isMobile ? 'flex-end' : 'center',
                    justifyContent: 'center',
                    zIndex: 3000,
                    backdropFilter: 'blur(8px)',
                    padding: isMobile ? '0' : '24px'
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget && onClose) onClose();
                }}
            >
                <div
                    style={{
                        background: 'var(--bg-app)',
                        width: '100%',
                        maxWidth: isMobile ? '100%' : '1100px',
                        height: isMobile ? '100%' : 'auto',
                        maxHeight: isMobile ? '100%' : '90vh',
                        overflowY: 'auto',
                        borderRadius: isMobile ? '0' : 'var(--radius-lg)',
                        padding: isMobile ? `calc(40px + env(safe-area-inset-top)) 24px 80px` : '40px 24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                        position: 'relative',
                        WebkitOverflowScrolling: 'touch'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {content}
                </div>
            </div>
        );
    }

    return content;
};

export default PricingPage;
