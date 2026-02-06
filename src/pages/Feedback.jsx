import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle, Send, AlertTriangle, Lightbulb, HelpCircle, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Feedback = () => {
    const { user } = useApp();
    const [category, setCategory] = useState('suggestion');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const { error: dbError } = await supabase
                .from('user_feedback')
                .insert([
                    {
                        user_id: user.id,
                        category,
                        subject,
                        message,
                        status: 'new'
                    }
                ]);

            if (dbError) throw dbError;

            setSuccess(true);
            setSubject('');
            setMessage('');
            // Reset success message after 5 seconds
            setTimeout(() => setSuccess(false), 5000);
        } catch (err) {
            console.error('Feedback error:', err);
            setError('Failed to send feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getIcon = () => {
        switch (category) {
            case 'bug': return <AlertTriangle size={24} className="text-danger" />;
            case 'suggestion': return <Lightbulb size={24} className="text-warning" />;
            case 'support': return <HelpCircle size={24} className="text-info" />;
            default: return <MessageCircle size={24} />;
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h1 className="page-title">Feedback & Support</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    We'd love to hear from you. Help us improve College Org!
                </p>
            </div>

            <div className={`card fade-in`} style={{ padding: '32px' }}>
                {success ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{
                            background: '#dcfce7',
                            color: '#166534',
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <CheckCircle size={32} />
                        </div>
                        <h2>Thank you!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            Your feedback has been received. We read every message!
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => setSuccess(false)}
                        >
                            Send Another
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>Reason for contact</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                                {[
                                    { id: 'suggestion', label: 'Suggestion', icon: Lightbulb },
                                    { id: 'bug', label: 'Report Bug', icon: AlertTriangle },
                                    { id: 'support', label: 'Help / Support', icon: HelpCircle },
                                    { id: 'other', label: 'Other', icon: MessageCircle }
                                ].map(type => (
                                    <div
                                        key={type.id}
                                        onClick={() => setCategory(type.id)}
                                        style={{
                                            padding: '16px',
                                            border: `2px solid ${category === type.id ? 'var(--primary)' : 'var(--border)'}`,
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            background: category === type.id ? 'var(--primary-light)' : 'var(--bg-app)',
                                            color: category === type.id ? 'var(--primary)' : 'var(--text-secondary)',
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <type.icon size={24} />
                                        <span style={{ fontWeight: '500' }}>{type.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                            <label style={{ fontWeight: '600' }}>Subject</label>
                            <input
                                className="input-field"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder={category === 'bug' ? "e.g., Cannot upload PDF" : "e.g., Add Dark Mode"}
                                required
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                            <label style={{ fontWeight: '600' }}>Message</label>
                            <textarea
                                className="input-field"
                                rows={6}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Tell us more details..."
                                required
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                            />
                        </div>

                        {error && (
                            <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                            style={{ width: '100%', padding: '14px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {submitting ? 'Sending...' : <><Send size={20} /> Send Feedback</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Feedback;
