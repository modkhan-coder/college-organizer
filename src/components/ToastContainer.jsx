import { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ToastContainer = ({ notifications }) => {
    if (!notifications || notifications.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            {notifications.map(n => (
                <div key={n.id} className="card" style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'var(--bg-card)', // Ensure contrast
                    borderLeft: `4px solid ${getColor(n.type)}`,
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '300px',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <div style={{ color: getColor(n.type) }}>
                        {getIcon(n.type)}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>{n.message}</p>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const getColor = (type) => {
    switch (type) {
        case 'success': return 'var(--success)';
        case 'warning': return 'var(--warning)'; // Need to ensure var exists or use generic
        case 'error': return 'var(--danger)';
        default: return 'var(--primary)';
    }
};

const getIcon = (type) => {
    switch (type) {
        case 'success': return <CheckCircle size={20} />;
        case 'warning': return <AlertTriangle size={20} />;
        case 'error': return <AlertTriangle size={20} />; // shared icon
        default: return <Info size={20} />;
    }
};

export default ToastContainer;
