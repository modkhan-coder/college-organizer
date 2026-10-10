import { FileText, Shield, CreditCard, AlertCircle, ExternalLink, ArrowLeft, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

const Terms = () => {
    const navigate = useNavigate();

    const openAppleEula = (e) => {
        e.preventDefault();
        const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
        if (Capacitor.isNativePlatform()) {
            Browser.open({ url });
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: '40px', paddingLeft: '16px', paddingRight: '16px' }}>
            {/* Header with back button */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border)'
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-main)'
                    }}
                    aria-label="Go back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>Terms of Use (EULA)</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Last Updated: October 10, 2026
                    </p>
                </div>
            </div>

            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
                Welcome to College Organizer. By accessing or using our application, you agree to be bound by these Terms of Use and End User License Agreement ("EULA").
            </p>

            <div style={{ display: 'grid', gap: '24px' }}>

                {/* Section 1: Apple Standard EULA */}
                <div className="card" style={{ padding: '28px', border: '1px solid var(--primary)', background: 'rgba(99, 102, 241, 0.04)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--primary)', flexShrink: 0 }}>
                            <FileText size={28} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.25rem' }}>Apple Licensed Application End User License Agreement</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
                                For users accessing College Organizer on iOS devices through the Apple App Store, this application is licensed, not sold, to you. Your license to use this app is subject to your prior acceptance of the Apple Standard End User License Agreement (EULA).
                            </p>
                            <a
                                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                                onClick={openAppleEula}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: 'var(--primary)',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    textDecoration: 'underline'
                                }}
                            >
                                Read Apple's Standard EULA <ExternalLink size={16} />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Section 2: Subscriptions & In-App Purchases */}
                <div className="card" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--warning)', flexShrink: 0 }}>
                            <CreditCard size={28} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.25rem' }}>Auto-Renewable Subscriptions</h2>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8', fontSize: '0.9rem', margin: 0 }}>
                                <li><strong>Payment:</strong> Payment will be charged to your Apple ID / iTunes Account at confirmation of purchase.</li>
                                <li><strong>Auto-Renewal:</strong> Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current billing period.</li>
                                <li><strong>Renewal Billing:</strong> Your account will be charged for renewal within 24 hours prior to the end of the current period at the rate of the selected plan.</li>
                                <li><strong>Managing Subscriptions:</strong> Subscriptions may be managed by the user and auto-renewal may be turned off by going to the user's Account Settings / App Store Subscriptions after purchase.</li>
                                <li><strong>Upgrades & Downgrades:</strong> Any changes between subscription plans will take effect according to App Store terms.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Section 3: User Accounts & Responsibilities */}
                <div className="card" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--accent)', flexShrink: 0 }}>
                            <Shield size={28} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.25rem' }}>Account & Acceptable Use</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
                                You are responsible for safeguarding your login credentials and for all activities that occur under your account. You agree not to:
                            </p>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8', fontSize: '0.9rem', margin: 0 }}>
                                <li>Use the service for any illegal activity or unauthorized academic dishonesty.</li>
                                <li>Reverse engineer, decompile, or attempt to extract source code from the application.</li>
                                <li>Abuse, disrupt, or overload our servers and AI integration services.</li>
                                <li>Share accounts with multiple unauthorized users.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Section 4: Privacy & Data Protection */}
                <div className="card" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--success)', flexShrink: 0 }}>
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.25rem' }}>Privacy & Disclaimer</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
                                Your privacy is paramount. Please review our Privacy Policy to understand how we collect, protect, and manage your data. College Organizer is provided "as is" without warranty of any kind.
                            </p>
                            <button
                                onClick={() => navigate('/privacy')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--primary)',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontSize: '0.9rem'
                                }}
                            >
                                View Privacy Policy &rarr;
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section 5: Contact Us */}
                <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                    <Mail size={24} style={{ margin: '0 auto 8px auto', color: 'var(--primary)', display: 'block' }} />
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>Questions about our Terms?</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 12px 0' }}>
                        Contact our support team anytime.
                    </p>
                    <a
                        href="mailto:support@collegeorganizer.org"
                        style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}
                    >
                        support@collegeorganizer.org
                    </a>
                </div>

            </div>
        </div>
    );
};

export default Terms;
