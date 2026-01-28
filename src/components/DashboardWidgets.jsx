import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Clock, Calendar, Brain, Flame, Share2 } from 'lucide-react';
import { isOverdue, formatDate } from '../utils/dateUtils';

// --- Widget 1: Progress (Streak + Daily Goal) ---
export const ProgressWidget = ({ userStats, tasksDoneToday, dailyGoal, setIsShareModalOpen }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', height: '100%' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', color: 'white', padding: '20px' }}>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                <Flame size={24} color="white" />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{userStats.current_streak || 0} Day Streak</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Best: {userStats.best_streak || 0} days 🔥</div>
            </div>
            <button
                onClick={() => setIsShareModalOpen(true)}
                className="btn"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px', borderRadius: '50%' }}
            >
                <Share2 size={16} />
            </button>
        </div>

        <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600' }}>Today's Progress</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tasksDoneToday}/{dailyGoal} Tasks</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                    width: `${Math.min(100, (tasksDoneToday / dailyGoal) * 100)}%`,
                    height: '100%',
                    background: 'var(--success)',
                    transition: 'width 0.5s ease-out'
                }}></div>
            </div>
        </div>
    </div>
);

// --- Widget 2: Stats (4 Small Cards) ---
const StatCard = ({ icon, label, value, color, bg }) => (
    <div className="card stat-card-hover" style={{
        display: 'flex', alignItems: 'center', gap: '20px', padding: '24px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'grab'
    }}>
        <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${bg.replace('0.1', '0.2')}`
        }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: '1', marginBottom: '4px', color: 'var(--text-main)' }}>{value}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        </div>
    </div>
);

export const StatsWidget = ({ overdueCount, todayCount, tomorrowCount, weekCount }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', height: '100%' }}>
        <StatCard icon={<AlertCircle size={24} />} label="Overdue" value={overdueCount} color="var(--danger)" bg="rgba(239, 68, 68, 0.1)" />
        <StatCard icon={<Clock size={24} />} label="Due Today" value={todayCount} color="var(--warning)" bg="rgba(245, 158, 11, 0.1)" />
        <StatCard icon={<Calendar size={24} />} label="Due Tomorrow" value={tomorrowCount} color="var(--info)" bg="rgba(59, 130, 246, 0.1)" />
        <StatCard icon={<CheckCircle size={24} />} label="Next 7 Days" value={weekCount} color="var(--success)" bg="rgba(34, 197, 94, 0.1)" />
    </div>
);

// --- Widget 3: Insights / Survival ---
export const InsightsWidget = ({ survivalMode, survivalPlan, insights, addNotification }) => {
    if (!survivalMode && insights.length === 0) return null;

    if (survivalMode) {
        return (
            <div className="card" style={{
                background: '#111827', color: 'white', padding: '32px',
                border: '2px solid #ef4444', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', height: '100%'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertCircle color="#ef4444" size={28} />
                        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>Survival Plan</h2>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {survivalPlan.slice(0, 3).map((item, idx) => (
                        <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: '20px', padding: '16px',
                            background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ fontWeight: 'bold', color: '#ef4444' }}>#{idx + 1}</div>
                            <div style={{ flex: 1, fontWeight: '600' }}>{item.title}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '0', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Brain size={20} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Smart Recommendations</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {insights.slice(0, 2).map((insight, idx) => (
                    <div key={idx} className="card" style={{
                        padding: '20px', borderLeft: `6px solid var(--${insight.priority === 'critical' ? 'danger' : 'info'})`
                    }}>
                        <div style={{ fontWeight: 'bold' }}>{insight.title}</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{insight.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Widget 4: Tasks ---
export const TasksWidget = ({ openItems }) => (
    <div className="card" style={{ height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3>Next Up</h3>
            <Link to="/planner" style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>View Planner</Link>
        </div>
        {openItems.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nothing due soon! 🎉</p>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {openItems.slice(0, 5).map(item => (
                    <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: '16px', padding: '12px',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                        borderLeft: `4px solid ${item.type === 'assignment' ? 'var(--primary)' : 'var(--accent)'}`,
                        backgroundColor: 'var(--bg-surface)'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '1rem' }}>{item.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {formatDate(item.date)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// --- Widget 5: Grades ---
export const GradesWidget = ({ courseGrades }) => (
    <div className="card" style={{ height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3>Grade Snapshot</h3>
            <Link to="/courses" style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>Manage</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {courseGrades.map(course => (
                <div key={course.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--border)'
                }}>
                    <div>
                        <div style={{ fontWeight: '600' }}>{course.code}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{course.name}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {course.grade.percent !== null ? `${course.grade.percent.toFixed(1)}%` : '-'}
                    </div>
                </div>
            ))}
        </div>
    </div>
);
