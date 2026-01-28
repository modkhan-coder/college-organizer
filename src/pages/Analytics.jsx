import { useApp } from '../context/AppContext';
import { calculateCourseGrade } from '../utils/gradeCalculator';
import { BarChart2, Clock, CheckCircle, TrendingUp, Calendar as CalendarIcon, AlertCircle, Lock } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

const Analytics = () => {
    const { courses, assignments, tasks, user } = useApp();
    const isPro = user?.plan === 'pro' || user?.plan === 'premium';

    const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

    // --- 1. Study Minutes (Next 7 days) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const textNext7Days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        textNext7Days.push(d.toISOString().split('T')[0]);
    }

    const studyData = textNext7Days.map(dateStr => {
        const dayTasks = tasks.filter(t => t.dueDate === dateStr);
        const minutes = dayTasks.reduce((acc, t) => acc + (t.estMinutes || 0), 0);
        return {
            date: dateStr,
            minutes,
            label: new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short' })
        };
    });

    // --- 2. Grades Calculation ---
    const courseGrades = courses.map((c, index) => {
        const g = calculateCourseGrade(c, assignments);
        return {
            name: c.code,
            percent: g.percent || 0,
            color: c.color || COLORS[index % COLORS.length]
        };
    });

    // --- 3. Grade Trend (Simulated Cumulative) ---
    // In a real app, we'd query historical snapshots. Here, we'll simulate a trend 
    // based on completed assignments over time.
    const sortedCompletedAssignments = assignments
        .filter(a => a.pointsEarned !== undefined && a.pointsEarned !== null)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const trendData = [];
    if (sortedCompletedAssignments.length > 0) {
        let runningPoints = 0;
        let runningPossible = 0;

        sortedCompletedAssignments.forEach(a => {
            runningPoints += a.pointsEarned;
            runningPossible += a.pointsPossible;
            trendData.push({
                date: new Date(a.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                gpa: (runningPoints / runningPossible) * 100 // Overall percentage
            });
        });
    } else {
        // Fallback if no data
        trendData.push({ date: 'Start', gpa: 100 });
        trendData.push({ date: 'Now', gpa: 100 });
    }

    // --- 4. Milestones (Exams/High Priority) ---
    const upcomingExams = assignments
        .filter(a => {
            const title = a.title.toLowerCase();
            const isExam = title.includes('exam') || title.includes('midterm') || title.includes('final') || title.includes('test');
            const isFuture = new Date(a.dueDate) >= new Date();
            return isExam && isFuture;
        })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 3); // Top 3

    // --- 5. Completion Stats ---
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;


    return (
        <div className="fade-in">
            <h1 className="page-title">Analytics Dashboard</h1>

            {/* Top Row: Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Current Average</p>
                        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>
                            {courseGrades.length > 0 ?
                                (courseGrades.reduce((acc, c) => acc + c.percent, 0) / courseGrades.length).toFixed(1) :
                                'N/A'
                            }%
                        </h2>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#10b981' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Task Completion</p>
                        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{Math.round(taskCompletionRate)}%</h2>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upcoming Exams</p>
                        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{upcomingExams.length}</h2>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

                {/* Grade Trend Chart */}
                <div className="card" style={{ minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
                    {!isPro && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backdropFilter: 'blur(5px)', background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock color="#8b5cf6" size={32} />
                            <h3 style={{ margin: '12px 0 8px' }}>Trends Locked</h3>
                            <button className="btn btn-primary" onClick={() => window.location.href = '/pricing'}>Upgrade to Pro</button>
                        </div>
                    )}
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={18} color="var(--primary)" /> Academic Performance
                        </h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cumulative grade trend over time</p>
                    </div>
                    <div style={{ height: '240px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    hide
                                />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--text-main)' }}
                                    formatter={(value) => [`${value.toFixed(1)}%`, 'Average']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="gpa"
                                    stroke="#8b5cf6"
                                    fillOpacity={1}
                                    fill="url(#colorGpa)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Course Comparison */}
                <div className="card" style={{ minHeight: '300px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart2 size={18} color="var(--accent)" /> Course Breakdown
                        </h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Current standing by subject</p>
                    </div>
                    <div style={{ height: '240px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={courseGrades} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                <XAxis type="number" domain={[0, 100]} hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tick={{ fontSize: 12, fill: 'var(--text-main)' }}
                                    width={60}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--bg-app)' }}
                                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    formatter={(value) => [`${value.toFixed(1)}%`, 'Grade']}
                                />
                                <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={20}>
                                    {courseGrades.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Study Forecast */}
                <div className="card" style={{ minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
                    {!isPro && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backdropFilter: 'blur(5px)', background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock color="#f59e0b" size={32} />
                            <h3 style={{ margin: '12px 0 8px' }}>Study Forecast Locked</h3>
                            <button className="btn btn-primary" onClick={() => window.location.href = '/pricing'}>Upgrade to Pro</button>
                        </div>
                    )}
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={18} color="#f59e0b" /> Study Forecast
                        </h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Planned minutes for next 7 days</p>
                    </div>
                    <div style={{ height: '240px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={studyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--bg-app)' }}
                                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    formatter={(value) => [`${value} min`, 'Study Time']}
                                />
                                <Bar dataKey="minutes" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Milestones / Countdown */}
                <div className="card">
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarIcon size={18} color="#ec4899" /> Milestones
                        </h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upcoming major exams</p>
                    </div>

                    {upcomingExams.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p>No exams detected.</p>
                            <small>Tasks/Assignments with "Exam" in the title will appear here.</small>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {upcomingExams.map(exam => {
                                const daysLeft = Math.ceil((new Date(exam.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                                const course = courses.find(c => c.id === exam.courseId);
                                return (
                                    <div key={exam.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px', borderRadius: '8px', background: 'var(--bg-app)',
                                        borderLeft: `4px solid ${course?.color || 'var(--text-secondary)'}`
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{exam.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {new Date(exam.dueDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: daysLeft <= 3 ? 'var(--danger)' : 'var(--primary)' }}>
                                                {daysLeft}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Days</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Analytics;
