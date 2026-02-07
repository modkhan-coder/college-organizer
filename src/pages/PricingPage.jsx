import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Check, X, CreditCard, Star, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PricingPage = ({ isModal = false, onClose }) => {
    const { user, saveUser, addNotification } = useApp();
    const navigate = useNavigate();
    const [processingPlan, setProcessingPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' | 'yearly'
    const [verifying, setVerifying] = useState(false);

    // Safety check for user.plan
    const currentPlan = user?.plan || 'free';

    // Payment verification is now handled globally by PaymentSync

    const handleManageBilling = async () => {
        setProcessingPlan('portal');
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session', {
                body: { returnPath: window.location.pathname }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
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
        if (plan === 'free') {
            await handleManageBilling();
            return;
        }

        if (plan === user?.plan) {
            addNotification(`You are already on the ${plan.toUpperCase()} plan`, 'info');
            return;
        }

        setProcessingPlan(plan);
        try {
            console.log(`[UPGRADE] Initiating ${plan} (${billingCycle})`);
            const response = await supabase.functions.invoke('create-checkout', {
                body: {
                    plan,
                    interval: billingCycle,
                    returnPath: window.location.pathname
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

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error) {
            console.error('[UPGRADE] Failed:', error);
            addNotification(`Checkout failed: ${error.message || 'Unknown error'}`, 'error');
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
            {isModal && (
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '10px'
                    }}
                >
                    <X size={24} />
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
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0' }}>
                        {billingCycle === 'yearly' ? '$49.99' : '$4.99'}
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
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
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0' }}>
                        {billingCycle === 'yearly' ? '$99.99' : '$9.99'}
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
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

    if (isModal) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '24px',
                    backdropFilter: 'blur(4px)'
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget && onClose) onClose();
                }}
            >
                <div
                    style={{
                        background: 'var(--bg-app)',
                        width: '100%',
                        maxWidth: '1100px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        borderRadius: 'var(--radius-lg)',
                        padding: '40px 24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                        position: 'relative'
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
