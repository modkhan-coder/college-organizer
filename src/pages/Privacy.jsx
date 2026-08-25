import { Shield, Lock, Eye, Database, Server, Share2, Globe, ExternalLink, Trash2, Mail } from 'lucide-react';

const Privacy = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
            <h1 className="page-title">Privacy Policy</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <strong>Last Updated:</strong> August 25, 2026
            </p>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '40px' }}>
                College Organizer ("we", "us", or "our") is committed to protecting your privacy. 
                This Privacy Policy explains what data we collect, how we use it, and your rights regarding your personal information.
            </p>

            <div style={{ display: 'grid', gap: '24px' }}>

                {/* Section 1: Data We Collect */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--primary)' }}>
                            <Database size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Data We Collect</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                We collect the following types of data to provide and improve our services:
                            </p>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '2' }}>
                                <li><strong>Account Information:</strong> Email address, name (if provided), and authentication credentials (password is hashed and never stored in plain text).</li>
                                <li><strong>Academic Data:</strong> Courses, assignments, tasks, grades, GPA calculations, and study schedules that you create within the app.</li>
                                <li><strong>Subscription Data:</strong> Subscription plan type, payment provider (Apple/Stripe), and subscription status. We do not store credit card numbers.</li>
                                <li><strong>AI Interaction Data:</strong> Content you submit to AI features (study plans, quiz generation, PDF chat) is processed by Google Gemini AI and is not stored permanently by the AI provider.</li>
                                <li><strong>Device Information:</strong> Device type, operating system version, and app version for crash reporting and compatibility.</li>
                                <li><strong>Usage Data:</strong> Feature usage patterns and app interaction data to improve the user experience.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Section 2: How We Use Your Data */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--accent)' }}>
                            <Eye size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>How We Use Your Data</h2>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '2' }}>
                                <li><strong>App Functionality:</strong> To provide core features like course tracking, grade calculations, assignment management, and AI-powered study tools.</li>
                                <li><strong>Account Management:</strong> To authenticate your identity, manage your account, and sync data across devices.</li>
                                <li><strong>Subscription Management:</strong> To process payments, manage subscription status, and provide access to premium features.</li>
                                <li><strong>Service Improvement:</strong> To analyze usage patterns, fix bugs, and improve app performance and features.</li>
                                <li><strong>Communications:</strong> To send essential account notifications (e.g., password reset, subscription updates). We do not send marketing emails without your consent.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Section 3: Data Protection & Encryption */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--success)' }}>
                            <Lock size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Data Protection & Encryption</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                All data is encrypted <strong>in transit</strong> (using TLS/SSL) and <strong>at rest</strong>.
                                Your passwords and sensitive credentials are never stored in plain text. We use Supabase Authentication which adheres to industry-standard security protocols.
                            </p>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginTop: '12px' }}>
                                We use <strong>Row Level Security (RLS)</strong> policies at the database level, ensuring your data is strictly isolated. 
                                No other user can access your grades, tasks, or assignments.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 4: Third-Party Services */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--info)' }}>
                            <Share2 size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Third-Party Services</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                We use the following third-party services to operate College Organizer. Each service only receives the minimum data necessary:
                            </p>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '2' }}>
                                <li><strong>Supabase (Google Cloud):</strong> Authentication, encrypted database storage, and real-time data sync. Stores your account and academic data.</li>
                                <li><strong>Apple (In-App Purchases):</strong> Processes subscription payments on iOS. Apple handles all payment information directly.</li>
                                <li><strong>Stripe:</strong> Processes subscription payments on the web. Stripe handles all payment card information; we never see or store your card details.</li>
                                <li><strong>Google Gemini AI:</strong> Powers AI study tools (quiz generation, study plans, PDF analysis). Content is sent for processing and is not used to train AI models.</li>
                            </ul>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginTop: '12px' }}>
                                <strong>We do not sell your personal information</strong> to any third party, and we do not share your data with advertisers or data brokers.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 5: Data Retention */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--warning)' }}>
                            <Server size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Data Retention</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                Your data is retained for as long as your account is active. If you delete your account, 
                                all your personal data (including courses, assignments, grades, and profile information) will be 
                                permanently deleted from our servers within 30 days. Anonymized, aggregated usage data may be retained 
                                for analytics purposes.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 6: Your Rights */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--primary)' }}>
                            <Shield size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Your Rights</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                You have the following rights regarding your personal data:
                            </p>
                            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '2' }}>
                                <li><strong>Access:</strong> Request a copy of all personal data we hold about you.</li>
                                <li><strong>Correction:</strong> Update or correct inaccurate personal data.</li>
                                <li><strong>Deletion:</strong> Request permanent deletion of your account and all associated data.</li>
                                <li><strong>Data Portability:</strong> Request an export of your data in a standard format.</li>
                                <li><strong>Opt-Out:</strong> Opt out of non-essential communications at any time.</li>
                            </ul>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginTop: '12px' }}>
                                To exercise any of these rights, contact us at the email below or use the account deletion option in your Profile settings.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 7: Children's Privacy */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--accent)' }}>
                            <Globe size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Children's Privacy</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                College Organizer is designed for college students and is not intended for children under the age of 13.
                                We do not knowingly collect personal information from children under 13. If we discover that a child under 13 
                                has provided us with personal information, we will promptly delete it. If you believe a child under 13 has 
                                provided us with data, please contact us immediately.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 8: Contact */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--success)' }}>
                            <Mail size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Contact Us</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                If you have any questions about this Privacy Policy or your data, please contact us at:
                            </p>
                            <p style={{ lineHeight: '1.6', color: 'var(--primary)', fontWeight: '600', marginTop: '8px' }}>
                                <a href="mailto:support@collegeorganizer.org" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                    support@collegeorganizer.org
                                </a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 9: Changes to Policy */}
                <div className="card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', color: 'var(--warning)' }}>
                            <ExternalLink size={32} />
                        </div>
                        <div>
                            <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Changes to This Policy</h2>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                We may update this Privacy Policy from time to time. When we make changes, we will update the "Last Updated" 
                                date at the top of this page. We encourage you to review this policy periodically. Continued use of College Organizer 
                                after changes constitutes acceptance of the updated policy.
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>© 2026 College Organizer. All rights reserved.</p>
                <p style={{ marginTop: '8px' }}>Protected by Supabase Infrastructure • ISO 27001 Certified</p>
            </div>
        </div>
    );
};

export default Privacy;
