import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

const Auth = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();

    const isIOS = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (mode === 'signup') {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Check your email for the verification link!' });
            } else {
                const { error, data } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // session update handled by AppContext
                navigate('/');
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            // Use production domain for OAuth redirect
            const redirectUrl = window.location.hostname === 'localhost'
                ? window.location.origin
                : 'https://www.collegeorganizer.org';

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl
                }
            });
            if (error) throw error;
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const handleAppleLogin = async () => {
        setLoading(true);
        setMessage(null);

        try {
            if (isIOS) {
                // Native iOS: use Capacitor Apple Sign-In plugin
                const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

                const result = await SignInWithApple.authorize({
                    clientId: 'com.collegeorganizer.app',
                    redirectURI: 'https://www.collegeorganizer.org',
                    scopes: 'email name',
                    state: '',
                    nonce: '',
                });

                const identityToken = result.response?.identityToken;
                if (!identityToken) {
                    throw new Error('No identity token received from Apple.');
                }

                // Send the Apple identity token to Supabase
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: identityToken,
                });

                if (error) throw error;
                navigate('/');
            } else {
                // Web fallback: use Supabase OAuth for Apple
                const redirectUrl = window.location.hostname === 'localhost'
                    ? window.location.origin
                    : 'https://www.collegeorganizer.org';

                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'apple',
                    options: {
                        redirectTo: redirectUrl
                    }
                });
                if (error) throw error;
            }
        } catch (error) {
            // User cancelled is not an error
            if (error?.code === 'ERR_SIGN_IN_CANCELLED' || error?.message?.includes('canceled')) {
                console.log('[APPLE AUTH] User cancelled sign in');
            } else {
                console.error('[APPLE AUTH] Error:', error);
                setMessage({ type: 'error', text: error.message || 'Apple Sign-In failed. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'var(--bg-app)',
            padding: '24px'
        }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ color: 'var(--primary)', marginBottom: '8px' }}>College Org</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {mode === 'login' ? 'Welcome back!' : 'Create your account'}
                    </p>
                </div>

                {message && (
                    <div style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '24px',
                        background: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                        color: message.type === 'error' ? '#dc2626' : '#16a34a',
                        fontSize: '0.875rem'
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            className="input-field"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            className="input-field"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--text-secondary)' }}>
                    <hr style={{ flex: 1, borderColor: 'var(--border)' }} />
                    <span style={{ padding: '0 12px', fontSize: '0.875rem' }}>OR</span>
                    <hr style={{ flex: 1, borderColor: 'var(--border)' }} />
                </div>

                {/* Sign in with Apple — required by Apple Guideline 4.8 */}
                <button
                    onClick={handleAppleLogin}
                    disabled={loading}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        background: '#000000',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-md, 8px)',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        transition: 'opacity 0.2s',
                        opacity: loading ? 0.6 : 1,
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.1 9.52c-.02-1.84 1.5-2.72 1.57-2.76-.86-1.25-2.19-1.42-2.66-1.44-1.13-.12-2.21.67-2.78.67-.57 0-1.46-.65-2.4-.63-1.23.02-2.37.72-3.01 1.83-1.28 2.22-.33 5.52.92 7.32.61.89 1.34 1.88 2.3 1.85.92-.04 1.27-.6 2.38-.6 1.11 0 1.42.6 2.39.58.99-.02 1.62-.9 2.23-1.8.7-1.03.99-2.03 1.01-2.08-.02-.01-1.94-.75-1.95-2.94z" fill="white"/>
                        <path d="M11.24 3.88c.51-.61.85-1.47.76-2.32-.73.03-1.62.49-2.14 1.1-.47.54-.88 1.41-.77 2.24.82.06 1.65-.41 2.15-1.02z" fill="white"/>
                    </svg>
                    Sign in with Apple
                </button>

                {/* Continue with Google */}
                <button
                    onClick={handleGoogleLogin}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    Continue with Google
                </button>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.875rem' }}>
                    {mode === 'login' ? (
                        <>
                            Don't have an account?{' '}
                            <button
                                onClick={() => setMode('signup')}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Create an Account
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => setMode('login')}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Sign In
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Auth;
