import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Check, X, CreditCard, Star, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PricingPage = () => {
    const { user, saveUser, addNotification } = useApp();
    const navigate = useNavigate();
    const [processingPlan, setProcessingPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' | 'yearly'
    const [verifying, setVerifying] = useState(false);

    // Safety check for user.plan
    const currentPlan = user?.plan || 'free';

    // Auto-Sync Payment Check
    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const isSuccess = queryParams.get('success') === 'true';
        const isDowngrade = queryParams.get('downgrade') === 'true';

        if (user?.id) {
            if (isSuccess || isDowngrade) setVerifying(true);

            supabase.functions.invoke('verify-payment', { body: {} })
                .then(({ data }) => {
                    if (data?.success) {
                        // If plan mismatch, update LOCAL state immediately (no reload)
                        if (data?.plan && data.plan !== user.plan) {
                            console.log('Plan mismatch, syncing local state to:', data.plan);
                            saveUser({ ...user, plan: data.plan });

                            if (isSuccess) {
                                addNotification(`Successfully upgraded to ${data.plan.toUpperCase()}!`, 'success');
                            }
                        }

                        // Clean URL if we had params
                        if (isSuccess || isDowngrade) {
                            navigate('/pricing', { replace: true });
                        }
                    }
                })
                .catch(e => console.error('Sync Error:', e))
                .finally(() => setVerifying(false));
        }
    }, [user?.id]);

    const handleUpgrade = async (plan) => {
        setProcessingPlan(plan);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                throw new Error("No active session. Please log out and log in again.");
            }

            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    plan,
                    interval: billingCycle
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (error) throw error;

            if (data?.error) {
                throw new Error(data.error);
            }

            if (data?.url) {
                window.location.href = data.url;
            } else {
                addNotification('Failed to start checkout session', 'error');
                setProcessingPlan(null);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            const errMsg = error?.message || JSON.stringify(error) || 'Unknown error';
            addNotification(`Checkout failed: ${errMsg}`, 'error');
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

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '16px' }}>Upgrade your College Life</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '24px' }}>Unlock unlimited courses, assignments, and advanced features.</p>

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
                        disabled={currentPlan === 'free' || processingPlan === 'free'}
                        onClick={() => handleUpgrade('free')}
                    >
                        {processingPlan === 'free' ? 'Processing...' : currentPlan === 'free' ? 'Active Plan' : 'Downgrade'}
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
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0' }}>
                        {billingCycle === 'yearly' ? '$49.99' : '$4.99'}
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Advanced tools to forecast and improve grades.</p>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginBottom: '24px', background: currentPlan === 'pro' ? 'var(--bg-surface)' : 'var(--accent)', color: currentPlan === 'pro' ? 'var(--text-main)' : 'white' }}
                        disabled={currentPlan === 'pro' || !!processingPlan}
                        onClick={() => handleUpgrade('pro')}
                    >
                        {processingPlan === 'pro' ? 'Processing...' : currentPlan === 'pro' ? 'Active Plan' : `Upgrade to Pro (${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})`}
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
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0' }}>
                        {billingCycle === 'yearly' ? '$99.99' : '$9.99'}
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Let AI build your perfect study schedule.</p>

                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%', marginBottom: '24px', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                        disabled={currentPlan === 'premium' || !!processingPlan}
                        onClick={() => handleUpgrade('premium')}
                    >
                        {processingPlan === 'premium' ? 'Processing...' : currentPlan === 'premium' ? 'Active Plan' : `Get Premium (${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})`}
                    </button>

                    <Feature included={true} text="Everything in Pro" />
                    <Feature included={true} text="50 AI Credits / mo (Plans, Quizzes, Chat)" />
                    <Feature included={true} text="Smart Study Plans (AI)" />
                    <Feature included={true} text="AI Study Schedule Generation" />
                    <Feature included={true} text="AI Quizzes" />
                    <Feature included={true} text="Chat with Documents (PDF)" />
                    <Feature included={true} text="Priority Support" />
                    <Feature included={true} text="Early Access Features" />
                    <Feature included={true} text="Custom Themes" />
                </div>
            </div>

            <div style={{ marginTop: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>Secure payment processing via Stripe. Cancel anytime.</p>
            </div>
        </div>
    );
};

export default PricingPage;
