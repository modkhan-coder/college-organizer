import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isOverdue, isToday } from '../utils/dateUtils';
import { Link } from 'react-router-dom';

const Banner = () => {
    const { assignments, user, bannerVisible, setBannerVisible } = useApp();

    if (!user || !user.settings?.banner || !bannerVisible) return null;

    // Find urgent items
    const urgentItems = assignments.filter(a =>
        (a.pointsEarned === undefined || a.pointsEarned === null || a.pointsEarned === '') && // Not graded
        (isOverdue(a.dueDate) || isToday(a.dueDate))
    );

    if (urgentItems.length === 0) return null;

    return (
        <div style={{
            background: 'var(--danger)',
            color: 'white',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            position: 'sticky',
            top: 0,
            zIndex: 999
        }}>
            <AlertTriangle size={20} />
            <span style={{ fontWeight: '500' }}>
                You have {urgentItems.length} overdue or due today assignments!
            </span>
            <Link to="/planner" style={{ color: 'white', textDecoration: 'underline', fontWeight: 'bold' }}>
                View Planner
            </Link>

            <button
                onClick={() => setBannerVisible(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
                <X size={20} />
            </button>
        </div>
    );
};

export default Banner;
