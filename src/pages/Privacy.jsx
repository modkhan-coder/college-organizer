import { Shield, Lock, Eye, Database, Server, Share2, Globe, ExternalLink } from 'lucide-react';

const Privacy = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
            <h1 className="page-title">Privacy & Security</h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '40px' }}>
                Your data is secure, private, and under your control. Here is how we protect you.
            </p>

            <div style={{ display: 'grid', gap: '24px' }}>

                {/* Section 1: Data Protection */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--primary)' }}>
                            <Shield size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Data Protection</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                We use <strong>Row Level Security (RLS)</strong> policies. This implies that your data is enforcingly segregated at the database level.
                                No other user can access your grades, tasks, or assignments. The only information shared is what you explicitly choose to share (like your profile name and study activity) with confirmed friends.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 2: Encryption */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--success)' }}>
                            <Lock size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Encryption</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                All data is encrypted <strong>in transit</strong> (using TLS/SSL) and <strong>at rest</strong>.
                                Your passwords and sensitive credentials are never stored in plain text. We use Supabase Authentication which adheres to industry-standard security protocols.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 3: Transparency */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--warning)' }}>
                            <Eye size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Transparency & Control</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                You own your data. We do not sell your personal information to third parties.
                                You can manage your data, privacy, and security settings directly from your Profile.
                                You have the right to request a full export of your data or permanently delete your account at any time.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 4: Third-Party Partners & Ad Settings */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--info)' }}>
                            <Share2 size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Partner Data & Advertising</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                We partner with industry leaders to provide essential services:
                            </p>
                            <ul style={{ color: 'var(--text-secondary)', marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
                                <li><strong>Stripe:</strong> Secure payment processing and subscription management.</li>
                                <li><strong>Supabase (Google Cloud):</strong> Encrypted database storage and authentication.</li>
                                <li><strong>Google Partners:</strong> Used for analytics and specialized ad performance measurement.</li>
                            </ul>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginTop: '12px' }}>
                                You can choose whether to provide additional information to advertising partners through your <strong>Partner Ad Settings</strong> in the Profile section.
                                This data helps our partners select which ads to show and measure their performance.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 5: Global Standards */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--accent)' }}>
                            <Globe size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>My Data Center</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                We are building a centralized dashboard to make it easy to manage your data privacy.
                                Currently, you can access these tools:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
                                <div style={{ padding: '8px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>Privacy Checkup</div>
                                <div style={{ padding: '8px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>Ad Center</div>
                                <div style={{ padding: '8px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>Security Dashboard</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>Protected by Supabase Infrastructure • ISO 27001 Certified</p>
            </div>
        </div>
    );
};

export default Privacy;
