import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Trophy, Star, Award, Flame, Target, Clock, Timer, Moon, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Achievements = () => {
    const { user, userStats, syncAchievements } = useApp();
    const [badges, setBadges] = useState([]);
    const [userBadges, setUserBadges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        fetchBadges();
    }, [user]);

    const fetchBadges = async () => {
        setLoading(true);
        try {
            const [allRes, userRes] = await Promise.all([
                supabase.from('badges').select('*').order('category'),
                supabase.from('user_badges').select('*').eq('user_id', user.id)
            ]);

            setBadges(allRes.data || []);
            setUserBadges(userRes.data || []);
        } catch (error) {
            console.error('Error fetching badges:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        await syncAchievements();
        await fetchBadges();
        setSyncing(false);
    };

    const isUnlocked = (badgeId) => userBadges.some(ub => ub.badge_id === badgeId);
    const getAwardedDate = (badgeId) => {
        const ub = userBadges.find(ub => ub.badge_id === badgeId);
        return ub ? new Date(ub.awarded_at).toLocaleDateString() : null;
    };

    const getProgress = (badge) => {
        let current = 0;
        let target = badge.requirement_value || 1;

        switch (badge.requirement_type) {
            case 'task_count': current = userStats.total_tasks_completed || 0; break;
            case 'streak_count': current = userStats.current_streak || 0; break;
            case 'study_minutes': current = userStats.total_study_minutes || 0; break;
            case 'on_time_count': return null; // Not tracking yet
            default: return null;
        }

        const percent = Math.min(100, Math.round((current / target) * 100));
        return { current, target, percent };
    };

    const getIcon = (name, unlocked) => {
        const props = { size: 32, color: unlocked ? 'var(--primary)' : '#94a3b8' };
        switch (name) {
            case 'Flame': return <Flame {...props} />;
            case 'Target': return <Target {...props} />;
            case 'Clock': return <Clock {...props} />;
            case 'Timer': return <Timer {...props} />;
            case 'Moon': return <Moon {...props} />;
            default: return <Award {...props} />;
        }
    };

    if (loading) return <div style={{ padding: '24px' }}>Loading Achievements...</div>;

    return (
        <div style={{ paddingBottom: '100px' }}>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <Trophy size={48} color="var(--warning)" style={{ marginBottom: '16px' }} />
                <h1 className="page-title" style={{ marginBottom: '8px' }}>Your Achievements</h1>
                <p style={{ color: 'var(--text-secondary)' }}>You've completed {userStats.total_tasks_completed || 0} tasks and maintained a {userStats.current_streak || 0} day streak!</p>

                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="btn btn-secondary"
                    style={{ marginTop: '16px', fontSize: '0.85rem' }}
                >
                    {syncing ? 'Syncing...' : 'Sync Milestones 🔄'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {badges.map(badge => {
                    const unlocked = isUnlocked(badge.id);
                    return (
                        <div key={badge.id} className={`card ${unlocked ? 'achievement-glow' : ''}`} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: '32px 24px',
                            opacity: unlocked ? 1 : 0.7,
                            border: unlocked ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: unlocked ? 'white' : 'var(--bg-app)',
                            transition: 'transform 0.2s',
                            cursor: 'default'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: unlocked ? 'rgba(99, 102, 241, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '20px'
                            }}>
                                {getIcon(badge.icon_name, unlocked)}
                            </div>
                            <h3 style={{ marginBottom: '8px', color: unlocked ? 'var(--text-main)' : 'var(--text-secondary)' }}>{badge.title}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                                {badge.description}
                            </p>

                            {unlocked ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    <CheckCircle size={16} /> Unlocked {getAwardedDate(badge.id)}
                                </div>
                            ) : (
                                <div style={{ width: '100%', marginTop: 'auto' }}>
                                    {(() => {
                                        const prog = getProgress(badge);
                                        if (!prog) return (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                Keep working to unlock!
                                            </div>
                                        );
                                        return (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                                                    <span>{prog.current} / {prog.target}</span>
                                                    <span>{prog.percent}%</span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${prog.percent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.5s ease' }}></div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
                .achievement-glow {
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
                    transform: translateY(-4px);
                }
            `}</style>
        </div>
    );
};

export default Achievements;
