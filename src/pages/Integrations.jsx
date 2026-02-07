import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Link, ExternalLink, RefreshCw, Trash2, Globe, CheckCircle2, AlertCircle, Pencil, Settings2, Lock } from 'lucide-react';
import Modal from '../components/Modal';
import { getCanvasAuthUrl } from '../lib/lms';

const Integrations = () => {
    const { user, addNotification, syncAllLMS, lmsConnections, getLMSCourses, importLMSCourse } = useApp();
    const isPro = user?.plan === 'pro' || user?.plan === 'premium';
    const [loading, setLoading] = useState(false);
    const [setupProvider, setSetupProvider] = useState(null); // 'canvas' | 'blackboard' | 'moodle'
    const [instanceUrl, setInstanceUrl] = useState('');
    const [token, setToken] = useState('');
    const [showDevSettings, setShowDevSettings] = useState(false);
    const [clientId, setClientId] = useState(localStorage.getItem('canvas_client_id') || '');

    // Preview Logic
    const [previewConnection, setPreviewConnection] = useState(null);
    const [availableCourses, setAvailableCourses] = useState([]);
    const [importingIds, setImportingIds] = useState([]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            addNotification('LMS account connected via OAuth!', 'success');
            // Find the most recent connection and open preview
            const triggerPreview = async () => {
                const { data } = await supabase.from('lms_connections').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                if (data) handleOpenPreview(data);
            };
            triggerPreview();
        }
    }, []);

    const handleOpenPreview = async (connection) => {
        setLoading(true);
        try {
            const courses = await getLMSCourses(connection);
            setAvailableCourses(courses);
            setPreviewConnection(connection);
        } catch (error) {
            console.error('LMS Preview Error:', error);
            addNotification(`Preview failed: ${error.message}`, 'error');
        }
        setLoading(false);
    };

    const handleImport = async (lmsCourse) => {
        setImportingIds(prev => [...prev, lmsCourse.lms_id]);
        try {
            await importLMSCourse(previewConnection, lmsCourse);
            addNotification(`${lmsCourse.code} imported successfully!`, 'success');
        } catch (error) {
            addNotification(`Import failed: ${error.message}`, 'error');
        }
        setImportingIds(prev => prev.filter(id => id !== lmsCourse.lms_id));
    };

    const handleOpenSetup = (provider) => {
        setToken('');
        setSetupProvider(provider);
        // Pre-fill common defaults for UX
        if (provider === 'canvas') setInstanceUrl('canvas.instructure.com');
        else if (provider === 'blackboard') setInstanceUrl('blackboard.school.edu');
        else if (provider === 'moodle') setInstanceUrl('moodle.university.org');
    };

    const handleConnect = async () => {
        if (!instanceUrl.trim()) return addNotification('Please enter your school URL', 'warning');
        if (setupProvider === 'moodle' && !token.trim()) return addNotification('Moodle requires a Web Service Token', 'warning');

        setLoading(true);
        addNotification(`Connecting to ${setupProvider}...`, 'info');

        try {
            const { data: newConn, error } = await supabase.from('lms_connections').insert([{
                user_id: user.id,
                provider: setupProvider,
                instance_url: instanceUrl,
                access_token: token.trim() || 'mock_token_' + Math.random().toString(36).slice(2),
                sync_status: 'pending'
            }]).select().single();

            if (error) {
                if (error.code === '42P01') {
                    throw new Error("LMS database table missing. Please click the SQL file I provided and run it in Supabase!");
                }
                throw error;
            }

            addNotification(`${setupProvider} connected!`, 'success');

            setSetupProvider(null);

            // Only open preview if using a real token
            if (newConn && !newConn.access_token?.startsWith('mock_token_')) {
                handleOpenPreview(newConn);
            } else if (newConn) {
                // Mock/simulation mode - show helpful message
                addNotification('Connected in Simulation Mode! Mock courses are now available. Use "Sync Now" to see sample data.', 'info');
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error) {
            console.error('Connection failed', error);
            alert(`CONNECTION FAILED:\n\n${error.message}\n\nTIP: Ensure you have run the 'supabase_phase3_setup.sql' script in your Supabase dashboard.`);
            addNotification(`Connection failed: ${error.message}`, 'error');
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setLoading(true);
        await syncAllLMS();
        setLoading(false);
    };

    const handleDisconnect = async (id, provider) => {
        if (!confirm(`Are you sure you want to disconnect ${provider}? This will stop background sync.`)) return;

        const { error } = await supabase.from('lms_connections').delete().eq('id', id);

        if (error) {
            addNotification(`Error disconnecting: ${error.message}`, 'error');
        } else {
            addNotification(`${provider} disconnected successfully`, 'success');
            window.location.reload();
        }
    };

    const handleConnectOAuth = () => {
        if (!instanceUrl.trim() || !clientId.trim()) {
            if (!clientId.trim()) setShowDevSettings(true);
            return addNotification('Institution URL and Client ID are required for OAuth', 'warning');
        }

        const state = btoa(JSON.stringify({
            userId: user.id,
            provider: setupProvider,
            instanceUrl: instanceUrl
        }));

        const authUrl = getCanvasAuthUrl(instanceUrl, clientId);
        window.location.href = `${authUrl}&state=${state}`;
    };

    const providers = [
        {
            id: 'canvas',
            name: 'Canvas',
            description: 'Connect your Canvas account to import courses and grades.',
            color: '#E13939',
            icon: 'https://www.instructure.com/sites/default/files/styles/canvas_favicon/public/2021-03/canvas-favicon.png'
        },
        {
            id: 'blackboard',
            name: 'Blackboard Learn',
            description: 'Sync your Blackboard assignments and results automatically.',
            color: '#000000',
            icon: 'https://www.blackboard.com/favicon.ico'
        },
        {
            id: 'moodle',
            name: 'Moodle',
            description: 'Import from Moodle using OAuth or a Web Service token.',
            color: '#F98012',
            icon: 'https://moodle.org/favicon.ico'
        }
    ];

    if (loading) return <div style={{ textAlign: 'center', padding: '48px' }}>Loading integrations...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 className="page-title">LMS Integrations</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Connect your school's Learning Management System to keep your courses and grades in perfect sync.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {providers.map(provider => {
                    const connection = lmsConnections.find(c => c.provider === provider.id);
                    return (
                        <div key={provider.id} className="card" style={{
                            padding: '24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderLeft: `6px solid ${provider.color}`
                        }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: '12px',
                                    background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Globe size={32} color={provider.color} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{provider.name}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
                                        {provider.description}
                                    </p>

                                    {connection ? (
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '12px' }}>
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold'
                                            }}>
                                                <CheckCircle2 size={16} /> Connected
                                            </span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                Last sync: {connection.last_sync ? new Date(connection.last_sync).toLocaleString() : 'Never'}
                                            </span>
                                        </div>
                                    ) : (
                                        <span style={{
                                            fontSize: '0.85rem', color: 'var(--text-secondary)',
                                            display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px'
                                        }}>
                                            <AlertCircle size={16} /> Not connected
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div>
                                {connection ? (
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button className="btn btn-secondary" onClick={handleSync} disabled={loading}>
                                            <RefreshCw size={18} className={loading ? "pulse" : ""} /> Sync Now
                                        </button>
                                        <button className="btn" style={{ color: 'var(--danger)', border: '1px solid var(--danger)', padding: '10px' }}
                                            onClick={() => handleDisconnect(connection.id, provider.name)}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    isPro ? (
                                        <button className="btn btn-primary" onClick={() => handleOpenSetup(provider.id)} disabled={loading}>
                                            Connect {provider.name}
                                        </button>
                                    ) : (
                                        <button className="btn" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} onClick={() => window.location.href = '/pricing'}>
                                            <Lock size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Unlock with Pro
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '48px', padding: '24px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ExternalLink size={18} color="var(--primary)" />
                    How security works
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    We use read-only OAuth 2.0 permissions whenever possible. Your student credentials (passwords) are
                    <strong> never stored </strong> in our database. We only store encrypted access tokens used specifically for
                    syncing your course data and grades. You can disconnect at any time to permanently delete all tokens.
                </p>
            </div>

            <Modal isOpen={!!setupProvider} onClose={() => setSetupProvider(null)} title={`Setup ${setupProvider?.charAt(0).toUpperCase() + setupProvider?.slice(1)}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="input-group">
                        <label className="input-label">Institution URL</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-app)', padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <Globe size={16} color="var(--text-secondary)" />
                            <input
                                className="input-field"
                                style={{ border: 'none', background: 'transparent', padding: '8px 0', flex: 1, boxShadow: 'none' }}
                                value={instanceUrl}
                                onChange={e => setInstanceUrl(e.target.value)}
                                placeholder="e.g. canvas.university.edu"
                            />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {setupProvider === 'canvas' ? 'The web address you use to log into Canvas.' :
                                setupProvider === 'blackboard' ? 'The web address where your Blackboard portal lives.' :
                                    'The URL of your Moodle instance.'}
                        </p>
                    </div>

                    {setupProvider === 'moodle' ? (
                        <div className="input-group">
                            <label className="input-label">Moodle Web Service Token</label>
                            <input
                                className="input-field"
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                placeholder="Paste your token here..."
                                type="password"
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                You can find this in Moodle under Preferences &gt; Security keys.
                            </p>
                        </div>
                    ) : (
                        <div className="input-group">
                            <label className="input-label">API Access Token</label>
                            <input
                                className="input-field"
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                placeholder="Paste your Canvas/LMS token here..."
                                type="password"
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                                <strong>How to get this:</strong>
                                <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>
                                    <li>Go to your {setupProvider} Account/Profile settings</li>
                                    <li>Look for "Approved Integrations" or "Access Tokens"</li>
                                    <li>Click "+ New Access Token" and copy it here</li>
                                </ol>
                                <span style={{ opacity: 0.8 }}>(Leave blank only if testing with Mock Data)</span>
                            </div>
                        </div>
                    )}

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                        <p><strong>Status:</strong> {token ? 'Real Account Sync' : 'Simulation Mode enabled'}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConnect} disabled={loading}>
                            {setupProvider === 'moodle' || token ? 'Authorize & Connect' : 'Connect & Simulate'}
                        </button>
                    </div>

                    {setupProvider === 'canvas' && (
                        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Professional OAuth (BETA)</h4>
                                <button className="btn" style={{ padding: '4px', border: 'none' }} onClick={() => setShowDevSettings(!showDevSettings)}>
                                    <Settings2 size={16} />
                                </button>
                            </div>

                            {showDevSettings && (
                                <div className="input-group" style={{ marginBottom: '16px' }}>
                                    <label className="input-label">Developer Client ID</label>
                                    <input
                                        className="input-field"
                                        value={clientId}
                                        onChange={e => {
                                            setClientId(e.target.value);
                                            localStorage.setItem('canvas_client_id', e.target.value);
                                        }}
                                        placeholder="Enter Canvas Client ID..."
                                    />
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        Registered in Canvas Admin &gt; Developer Keys.
                                    </p>
                                </div>
                            )}

                            <button className="btn" style={{ width: '100%', background: '#fff', border: '1px solid #E13939', color: '#E13939' }} onClick={handleConnectOAuth}>
                                Sign in with Canvas
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Import Preview Modal */}
            <Modal isOpen={!!previewConnection} onClose={() => setPreviewConnection(null)} title={`Import from ${previewConnection?.provider?.charAt(0).toUpperCase() + previewConnection?.provider?.slice(1)}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>We found these courses in your account. Choose which ones to import.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                        {availableCourses.map(lc => {
                            const isImporting = importingIds.includes(lc.lms_id);
                            const alreadyInApp = useApp().courses.some(c => c.lmsId === lc.lms_id);

                            return (
                                <div key={lc.lms_id} style={{
                                    padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: alreadyInApp ? 'var(--bg-app)' : 'var(--bg-surface)'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{lc.code}: {lc.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Term: {lc.term}</div>
                                    </div>

                                    {alreadyInApp ? (
                                        <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 'bold' }}>Imported</span>
                                    ) : (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                            onClick={() => handleImport(lc)}
                                            disabled={isImporting}
                                        >
                                            {isImporting ? 'Importing...' : 'Import'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ width: '100%' }}>
                        Done & Refresh App
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Integrations;
