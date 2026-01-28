import Notifications from '../components/Notifications';
import { Bell } from 'lucide-react';

const SocialNotifications = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Bell size={28} className="text-primary" />
                <h1 className="page-title" style={{ margin: 0 }}>Notifications</h1>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                Manage your invites, social actions, and academic alerts here.
            </p>

            <Notifications />
        </div>
    );
};

export default SocialNotifications;
