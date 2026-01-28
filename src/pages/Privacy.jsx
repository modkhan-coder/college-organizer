import { Shield, Lock, Eye, Database, Server } from 'lucide-react';

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
                                You can request a full export of your data or permanently delete your account at any time from the Settings page.
                            </p>
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
