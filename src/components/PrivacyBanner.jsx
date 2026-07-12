import React from 'react';
import { Shield, ExternalLink, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';

const PrivacyBanner = () => {
    const { user, acknowledgePrivacy } = useApp();

    // Only show if user is logged in AND hasn't acknowledged the update
    if (!user || user.settings?.privacy_acknowledged) return null;

    return (
        <div
            className="privacy-banner-container"
            style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% - 48px)',
                maxWidth: '850px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 24px',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '24px',
                zIndex: 1000,
                backdropFilter: 'blur(12px)',
                animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                    padding: '12px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Shield size={28} />
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        Privacy & Partner Data Update
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        We're introducing new tools to give you more control over your data and how it's shared with partners.
                        <Link
                            to="/privacy"
                            style={{
                                marginLeft: '8px',
                                color: 'var(--primary)',
                                fontWeight: '600',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderBottom: '1.5px solid transparent',
                                transition: 'border-color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                        >
                            View Privacy Center <ExternalLink size={14} />
                        </Link>
                    </p>
                </div>
            </div>

            <button
                onClick={acknowledgePrivacy}
                className="btn btn-primary"
                style={{
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    fontSize: '0.95rem'
                }}
            >
                <Check size={20} /> I Understand
            </button>

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 100px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @media (max-width: 768px) {
                    .privacy-banner-container {
                        flex-direction: column;
                        text-align: center;
                        bottom: 16px;
                        padding: 24px;
                    }
                    .privacy-banner-container > div {
                        flex-direction: column;
                        align-items: center;
                    }
                }
            `}</style>
        </div>
    );
};

export default PrivacyBanner;
