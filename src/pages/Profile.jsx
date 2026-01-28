import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Save, LogOut, Globe } from 'lucide-react';
import { generateICS, generateCSV, downloadFile } from '../utils/exportUtils';
import { useTheme } from '../context/ThemeContext';
import { Palette, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Profile = () => {
    const {
        user, saveUser, exportData, importData, updateSettings, addNotification,
        assignments, tasks, courses
    } = useApp();
    const isPro = user?.plan === 'pro' || user?.plan === 'premium';
    const isPremium = user?.plan === 'premium';
    const [searchParams, setSearchParams] = useSearchParams();

    // Payment Verification Logic
    useEffect(() => {
        const verifyPayment = async (sessionId) => {
            try {
                addNotification('Verifying payment...', 'info');
                const { data, error } = await supabase.functions.invoke('verify-payment', {
                    body: { session_id: sessionId }
                });

                if (error) throw error;

                if (data?.success) {
                    addNotification(`Success! Plan updated to ${data.plan}`, 'success');
                    // Force refresh user if needed, though real-time should catch it
                } else {
                    console.error('Verify failed:', data);
                }
            } catch (e) {
                console.error('Verification Error:', e);
                // Fallback: Webhook might enable it later
                addNotification('Payment received. Updating profile...', 'info');
            } finally {
                setSearchParams({}); // Clear params
            }
        };

        if (searchParams.get('downgrade')) {
            addNotification('Plan Downgraded to Free', 'info');
            setSearchParams({});
        }
        if (searchParams.get('updated')) {
            addNotification('Subscription Updated Successfully', 'success');
            setSearchParams({});
        }

        const sessionId = searchParams.get('session_id');
        if (searchParams.get('success') && sessionId) {
            verifyPayment(sessionId);
        }
    }, [searchParams]);

    // Settings
    const { theme, setTheme, themes } = useTheme();
    const [remindersEnabled, setRemindersEnabled] = useState(user?.settings?.reminders !== false); // default true
    const [bannerEnabled, setBannerEnabled] = useState(user?.settings?.banner !== false); // default true
    const [emailDigestEnabled, setEmailDigestEnabled] = useState(false);

    // Local state for form
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [school, setSchool] = useState(user?.school || '');
    const [major, setMajor] = useState(user?.major || '');
    const [gpaScale, setGpaScale] = useState(user?.gpaScale || '4.0'); // 4.0, 4.3, 5.0, 100
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

    useEffect(() => {
        if (user) {
            if (user.name) setName(user.name);
            if (user.email) setEmail(user.email);
            if (user.school) setSchool(user.school);
            if (user.major) setMajor(user.major);
            if (user.gpaScale) setGpaScale(user.gpaScale);
            if (user.display_name) setDisplayName(user.display_name);
            if (user.avatar_url) setAvatarUrl(user.avatar_url);
            if (user.email_digest_enabled !== undefined) setEmailDigestEnabled(user.email_digest_enabled);
        }
    }, [user]);

    const handleLogin = (e) => {
        e.preventDefault();
        // Validation could go here
        saveUser({ ...user, name, email, school, major, gpaScale, display_name: displayName, avatar_url: avatarUrl, joinedAt: new Date().toISOString() });
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        saveUser({
            ...user,
            name, email, school, major, gpaScale,
            display_name: displayName, avatar_url: avatarUrl,
            email_digest_enabled: emailDigestEnabled,
            settings: {
                ...(user.settings || {}),
                reminders: remindersEnabled,
                banner: bannerEnabled
            }
        });
        addNotification('Profile and settings updated!', 'success');
    };

    const handleLogout = async () => {
        if (confirm('Are you sure you want to log out?')) {
            const { error } = await import('../lib/supabase').then(m => m.supabase.auth.signOut());
            if (error) console.error('Error logging out:', error);
            // State update handled by onAuthStateChange in AppContext
        }
    }

    // --- Login View (No User) ---
    if (!user) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{
                            width: '64px', height: '64px', background: 'var(--primary)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 16px', color: 'white'
                        }}>
                            <User size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Welcome Student</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Create a profile to get started.</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <label className="input-label">Name</label>
                            <input
                                className="input-field"
                                type="text"
                                placeholder="Your Name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email (Optional)</label>
                            <input
                                className="input-field"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            Get Started
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const handleExportJSON = () => {
        const json = exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `college_organizer_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleImportJSON = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => importData(ev.target.result);
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleExportICS = () => {
        try {
            const content = generateICS(assignments, tasks, courses);
            downloadFile(content, 'college_calendar.ics', 'text/calendar');
            addNotification('Calendar exported successfully!', 'success');
        } catch (error) {
            console.error('ICS Export Error:', error);
            addNotification('Failed to export calendar. Check console for details.', 'error');
        }
    };

    const handleExportCSV = () => {
        try {
            // Export Assignments as simple CSV example
            if (assignments.length === 0) return addNotification('No assignments to export', 'warning');

            // Flatten for CSV
            const flatAssignments = assignments.map(a => ({
                Title: a.title,
                Course: courses.find(c => c.id === a.courseId)?.code || '',
                DueDate: a.dueDate,
                PointsPossible: a.pointsPossible,
                PointsEarned: a.pointsEarned || ''
            }));

            const content = generateCSV(flatAssignments);
            downloadFile(content, 'assignments.csv', 'text/csv');
            addNotification('Assignments exported successfully!', 'success');
        } catch (error) {
            console.error('CSV Export Error:', error);
            addNotification('Failed to export assignments. Check console for details.', 'error');
        }
    };

    // --- Profile View (Logged In) ---
    return (
        <div>
            <h1 className="page-title">Profile & Settings</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Profile Card */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                        <div style={{
                            width: '56px', height: '56px', background: 'var(--primary)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: 'white', overflow: 'hidden'
                        }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {(displayName || user.name || user.email || '?').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{displayName || user.name || 'Student'}</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>{user.email || 'No email set'}</p>
                            <Link to="/pricing" style={{ fontSize: '0.75rem', background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>
                                {user.plan?.toUpperCase() || 'FREE'} PLAN &rarr;
                            </Link>
                        </div>
                    </div>

                    <form onSubmit={handleUpdate}>
                        <div className="input-group">
                            <label className="input-label">Real Name</label>
                            <input className="input-field" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@example.com" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Display Name (Social)</label>
                            <input className="input-field" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. MasterStudent22" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Avatar URL</label>
                            <input className="input-field" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.png" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">School / University</label>
                            <input className="input-field" value={school} onChange={e => setSchool(e.target.value)} placeholder="e.g. State University" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Major</label>
                            <input className="input-field" value={major} onChange={e => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">GPA System</label>
                            <select className="input-field" value={gpaScale} onChange={e => setGpaScale(e.target.value)}>
                                <option value="4.0">4.0 Scale</option>
                                <option value="4.3">4.3 Scale</option>
                                <option value="5.0">5.0 Scale</option>
                                <option value="100">Percentage (100)</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button type="submit" className="btn btn-primary">
                                <Save size={18} /> Save Changes
                            </button>
                            <button type="button" onClick={handleLogout} className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                                <LogOut size={18} /> Logout
                            </button>
                        </div>
                    </form>
                </div>

                {/* Appearance Card */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Palette size={20} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Appearance</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {themes.map((t, idx) => {
                            const isDefault = t.name === 'University Blue' || idx === 0;
                            const isLocked = !isPremium && !isDefault;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        if (isLocked) {
                                            if (confirm('Premium Theme locked! Upgrade to Premium to unlock custom themes.')) {
                                                window.location.href = '/pricing';
                                            }
                                        } else {
                                            setTheme(t.id);
                                        }
                                    }}
                                    style={{
                                        padding: '12px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: theme === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: theme === t.id ? 'var(--bg-app)' : 'var(--bg-surface)',
                                        color: theme === t.id ? 'var(--primary)' : 'var(--text-main)',
                                        fontWeight: theme === t.id ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '0.9rem',
                                        opacity: isLocked ? 0.7 : 1,
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    {isLocked && <Lock size={12} />} {t.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Settings Card */}
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>Notification Settings</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ margin: 0 }}>Enable Reminders</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Get toast notifications for updates</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={remindersEnabled}
                                onChange={e => setRemindersEnabled(e.target.checked)}
                                style={{ transform: 'scale(1.2)' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ margin: 0 }}>Show Urgent Banner</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Top banner for overdue/due today items</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={bannerEnabled}
                                onChange={e => setBannerEnabled(e.target.checked)}
                                style={{ transform: 'scale(1.2)' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isPro ? 1 : 0.7 }}>
                            <div
                                onClick={() => !isPro && confirm('Daily Digest locked! Upgrade to Pro to enable email summaries.') && (window.location.href = '/pricing')}
                                style={{ cursor: !isPro ? 'pointer' : 'default' }}
                            >
                                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Daily Email Digest {!isPro && <Lock size={12} />}
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Receive a daily summary of upcoming tasks</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={emailDigestEnabled}
                                onChange={e => {
                                    if (!isPro) {
                                        if (confirm('Daily Digest locked! Upgrade to Pro to enable email summaries.')) {
                                            window.location.href = '/pricing';
                                        }
                                    } else {
                                        setEmailDigestEnabled(e.target.checked);
                                    }
                                }}
                                style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Data Management Card */}
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>Data Management</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Export your data to backup or use in other apps.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button className="btn btn-secondary" onClick={handleExportJSON}>
                            Download JSON Backup
                        </button>
                        <button className="btn btn-secondary" onClick={handleImportJSON}>
                            Import JSON Backup
                        </button>
                        <hr style={{ borderColor: 'var(--border)', margin: '8px 0' }} />
                        <button className="btn btn-secondary" onClick={handleExportICS}>
                            Export Calendar (.ics)
                        </button>
                        <button className="btn btn-secondary" onClick={handleExportCSV}>
                            Export Assignments CSV
                        </button>
                    </div>
                </div>

                {/* LMS Integrations Card */}
                <div className="card" style={{ border: '2px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Globe size={24} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>LMS Integrations</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Connect your Canvas, Blackboard, or Moodle account to auto-sync your courses and grades.
                    </p>
                    <Link to="/integrations" className="btn btn-primary" style={{ width: '100%' }}>
                        Manage Connections
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Profile;
