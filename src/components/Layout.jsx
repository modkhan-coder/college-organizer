import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Calendar, CheckSquare, BarChart2, User, Flame, Globe, Trophy, Bell, Users, Target, CalendarRange, HelpCircle, Shield, Menu, X, MessageCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useState } from 'react';
import Banner from './Banner';
import ToastContainer from './ToastContainer';
import PanicModal from './PanicModal';
import './Layout.css';

const Layout = ({ children }) => {
    const location = useLocation();
    const { appNotifications, socialNotifications } = useApp();
    const [isPanicOpen, setIsPanicOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { id: 'nav-dashboard', icon: Home, label: 'Dashboard', path: '/' },
        { id: 'nav-courses', icon: BookOpen, label: 'Courses', path: '/courses' },
        { id: 'nav-assignments', icon: CheckSquare, label: 'Assignments', path: '/assignments' },
        { id: 'nav-planner', icon: Calendar, label: 'Planner', path: '/planner' },
        { icon: CalendarRange, label: 'Calendar', path: '/calendar' },
        { icon: BookOpen, label: 'GPA Calc', path: '/gpa' },
        { icon: BarChart2, label: 'Analytics', path: '/analytics' },
        { icon: Globe, label: 'Integrations', path: '/integrations' },
        { icon: Trophy, label: 'Achievements', path: '/achievements' },
        { icon: Target, label: 'Focus Mode', path: '/focus' },
        { icon: Users, label: 'Social', path: '/social' },
        { icon: MessageCircle, label: 'Feedback', path: '/feedback' },
        { id: 'nav-help', icon: HelpCircle, label: 'Help & Guide', path: '/help' },
        { icon: Shield, label: 'Privacy', path: '/privacy' },
        { icon: User, label: 'Profile', path: '/profile' },
        // Admin Link (Only for specific email)
        ...(useApp().user?.email === 'modkhan20@gmail.com' ? [{ icon: Shield, label: 'Admin', path: '/admin' }] : []),
    ];

    const unreadCount = socialNotifications?.filter(n => !n.is_read).length || 0;

    return (
        <div className="app-layout">
            {/* Mobile Header (Only visible on < 768px via CSS) */}
            <div className="mobile-header">
                <button className="menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu size={24} />
                </button>
                <h2>College Org</h2>
                <div style={{ width: 24 }}></div> {/* Spacer for center alignment */}
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>College Org</h2>
                    <button className="close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <button
                    id="btn-panic"
                    className="panic-button-trigger"
                    onClick={() => setIsPanicOpen(true)}
                    style={{
                        margin: '0 20px 20px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '14px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                    }}
                >
                    <Flame size={18} fill="currentColor" />
                    PANIC BUTTON
                </button>
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            id={item.id}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                    <Link
                        to="/notifications"
                        className={`nav-item ${location.pathname === '/notifications' ? 'active' : ''}`}
                        style={{ position: 'relative' }}
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <Bell size={20} />
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                right: '20px',
                                background: 'var(--danger)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                fontSize: '0.7rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                border: '2px solid var(--bg-surface)'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </Link>
                </nav>
            </aside>
            <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
                <Banner />
                <div className="content-container" style={{ flex: 1 }}>
                    {children}
                </div>
                <ToastContainer notifications={appNotifications} />
                <PanicModal isOpen={isPanicOpen} onClose={() => setIsPanicOpen(false)} />
            </main>
        </div>
    );
};

export default Layout;
