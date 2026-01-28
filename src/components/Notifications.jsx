import { useApp } from '../context/AppContext';
import { Bell, Check, Trash2, Calendar, UserPlus, Trophy } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

const Notifications = () => {
    const { socialNotifications, markNotificationRead } = useApp();

    const getIcon = (type) => {
        switch (type) {
            case 'invite': return <UserPlus size={18} className="text-primary" />;
            case 'reminder': return <Calendar size={18} className="text-warning" />;
            case 'achievement': return <Trophy size={18} className="text-accent" />;
            default: return <Bell size={18} className="text-secondary" />;
        }
    };

    if (!socialNotifications || socialNotifications.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <Bell size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                <p>No new notifications</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {socialNotifications.map(notif => (
                <div
                    key={notif.id}
                    className="card"
                    style={{
                        padding: '16px',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'flex-start',
                        opacity: notif.is_read ? 0.7 : 1,
                        borderLeft: notif.is_read ? 'none' : '4px solid var(--primary)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{
                        padding: '10px',
                        background: 'var(--bg-app)',
                        borderRadius: '12px'
                    }}>
                        {getIcon(notif.type)}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>{notif.title}</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {formatDate(notif.created_at)}
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            {notif.message}
                        </p>

                        {!notif.is_read && (
                            <button
                                onClick={() => markNotificationRead(notif.id)}
                                style={{
                                    marginTop: '8px',
                                    fontSize: '0.8rem',
                                    color: 'var(--primary)',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Check size={14} /> Mark as read
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Notifications;
