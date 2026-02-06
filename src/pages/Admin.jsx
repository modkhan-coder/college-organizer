import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { Shield, CheckCircle, Clock, AlertCircle, RefreshCw, Filter } from 'lucide-react';

const Admin = () => {
    const { user } = useApp();
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, new, resolved
    const ADMIN_EMAIL = 'modkhan20@gmail.com';

    useEffect(() => {
        if (user?.email === ADMIN_EMAIL) {
            fetchFeedback();
        }
    }, [user]);

    const fetchFeedback = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('user_feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching feedback:', error);
        else setFeedback(data || []);
        setLoading(false);
    };

    const updateStatus = async (id, newStatus) => {
        const { error } = await supabase
            .from('user_feedback')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            alert('Failed to update status');
        } else {
            // Update local state
            setFeedback(prev => prev.map(item =>
                item.id === id ? { ...item, status: newStatus } : item
            ));
        }
    };

    if (user?.email !== ADMIN_EMAIL) {
        return (
            <div style={{ padding: '48px', textAlign: 'center' }}>
                <Shield size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
                <h1>Access Denied</h1>
                <p>You do not have permission to view this page.</p>
            </div>
        );
    }

    const filteredFeedback = feedback.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'resolved') return item.status === 'resolved';
        if (filter === 'new') return item.status === 'new' || !item.status;
        return true;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'resolved': return 'var(--success)';
            case 'in_progress': return 'var(--warning)';
            default: return 'var(--primary)';
        }
    };

    return (
        <div style={{ paddingBottom: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield className="text-primary" /> Admin Dashboard
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage user feedback and support tickets.</p>
                </div>
                <button onClick={fetchFeedback} className="btn" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {['all', 'new', 'resolved'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            border: filter === f ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: filter === f ? 'var(--primary-light)' : 'var(--bg-surface)',
                            color: filter === f ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: '600',
                            textTransform: 'capitalize',
                            cursor: 'pointer'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredFeedback.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No feedback found.</p>
                    ) : (
                        filteredFeedback.map(item => (
                            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid ${getStatusColor(item.status)}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            background: 'var(--bg-app)',
                                            fontSize: '0.75rem',
                                            textTransform: 'uppercase',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                            marginRight: '8px'
                                        }}>
                                            {item.category}
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                        <h3 style={{ margin: '4px 0' }}>{item.subject}</h3>
                                    </div>
                                    <select
                                        value={item.status || 'new'}
                                        onChange={(e) => updateStatus(item.id, e.target.value)}
                                        style={{
                                            padding: '8px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-app)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="new">New</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                </div>

                                <p style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                    {item.message}
                                </p>

                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                    User ID: {item.user_id}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Admin;
