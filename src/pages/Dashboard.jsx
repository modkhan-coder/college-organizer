import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { Flame, Clock } from 'lucide-react';
import { isOverdue, isToday, isTomorrow, getDaysDifference } from '../utils/dateUtils';
import { calculateCourseGrade } from '../utils/gradeCalculator';
import Modal from '../components/Modal';
import ShareableCard from '../components/ShareableCard';

// DnD Imports
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Widgets
import { ProgressWidget, StatsWidget, InsightsWidget, TasksWidget, GradesWidget } from '../components/DashboardWidgets';

// Default Widget Order (Stats & Progress pinned, so removed from draggable list)
const DEFAULT_LAYOUT = ['insights', 'tasks', 'grades'];

const SortableWidget = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
        touchAction: 'none' // Required for pointer sensor on mobile sometimes, but we handle via sensors
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
};

const Dashboard = () => {
    const { user, courses, assignments, tasks, userStats, generateSmartInsights, survivalMode, setSurvivalMode, calculateSurvivalPlan, addNotification } = useApp();
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Layout State
    const [layout, setLayout] = useState(() => {
        const saved = localStorage.getItem('dashboard-layout');
        let initial = saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
        // Migration: If 'stats' or 'progress' is still in layout from previous save, remove it
        if (initial.includes('stats')) initial = initial.filter(id => id !== 'stats');
        if (initial.includes('progress')) initial = initial.filter(id => id !== 'progress');
        return initial;
    });

    // Sensors (Enable drag on touch/mouse but allow clicks)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Data Prep
    const insights = generateSmartInsights();
    const survivalPlan = calculateSurvivalPlan();
    const tasksDoneToday = tasks.filter(t => t.completed && isToday(t.dueDate)).length;
    const dailyGoal = 3;

    // Next Class Logic
    const getNextClass = () => {
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' });
        const currentTime = now.getHours() * 60 + now.getMinutes();

        let upcoming = [];

        courses.forEach(c => {
            if (c.schedule) {
                c.schedule.forEach(s => {
                    // Start time in minutes
                    const [h, m] = s.start.split(':').map(Number);
                    const startMin = h * 60 + m;

                    // Simple logic: If today and start time is in future
                    if (s.day === currentDay && startMin > currentTime) {
                        upcoming.push({ ...s, code: c.code, diff: startMin - currentTime });
                    }
                });
            }
        });

        // Sort by soonest
        upcoming.sort((a, b) => a.diff - b.diff);
        return upcoming[0] || null;
    };

    const nextClass = getNextClass();

    const openItems = [
        ...assignments.filter(a => !a.pointsEarned).map(a => ({ ...a, type: 'assignment', date: a.dueDate, title: a.title })),
        ...tasks.filter(t => !t.completed).map(t => ({ ...t, type: 'task', date: t.dueDate, title: t.title }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    const overdueCount = openItems.filter(i => isOverdue(i.date)).length;
    const todayCount = openItems.filter(i => isToday(i.date)).length;
    const tomorrowCount = openItems.filter(i => isTomorrow(i.date)).length;
    const weekCount = openItems.filter(i => {
        const diff = getDaysDifference(i.date);
        return diff >= 0 && diff <= 7;
    }).length;

    const courseGrades = courses.map(course => ({ ...course, grade: calculateCourseGrade(course, assignments) }));

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setLayout((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                const newLayout = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
                return newLayout;
            });
        }
    };

    if (!user) return <div style={{ textAlign: 'center', padding: '48px' }}>Loading...</div>;

    const renderWidget = (id) => {
        switch (id) {
            case 'insights':
                return <InsightsWidget survivalMode={survivalMode} survivalPlan={survivalPlan} insights={insights} addNotification={addNotification} />;
            case 'tasks':
                return <TasksWidget openItems={openItems} />;
            case 'grades':
                return <GradesWidget courseGrades={courseGrades} />;
            default:
                return null;
        }
    };

    return (
        <div className={survivalMode ? 'survival-theme' : ''} style={{ transition: 'all 0.4s ease', minHeight: '100%', paddingBottom: '40px' }}>
            {/* Header (Not Draggable) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">Hello, {(user.name || 'Student').split(' ')[0]} 👋 </h1>
                    {user.school && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: '600', marginBottom: '8px', fontSize: '0.95rem' }}>
                            <span>🏫</span> {user.school}
                        </div>
                    )}
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {survivalMode ? 'MISSION DATA: FINALS SURVIVAL MODE ACTIVE' : 'Here’s what’s on your plate.'}
                    </p>
                </div>
                <button
                    onClick={() => setSurvivalMode(!survivalMode)}
                    className="btn"
                    style={{
                        background: survivalMode ? '#ef4444' : 'var(--bg-surface)',
                        color: survivalMode ? 'white' : 'var(--text-main)',
                        border: '1px solid var(--border)',
                        boxShadow: survivalMode ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                    }}
                >
                    <Flame size={16} fill={survivalMode ? 'white' : 'none'} />
                    {survivalMode ? 'EXIT SURVIVAL' : 'SURVIVAL MODE'}
                </button>
            </div>

            {/* Next Class Banner */}
            {nextClass && (
                <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid var(--primary)', background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-app)', padding: '10px', borderRadius: '50%', color: 'var(--primary)' }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Next: {nextClass.code} <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>starts at {nextClass.start}</span></div>
                            {nextClass.location && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>📍 {nextClass.location}</div>}
                        </div>
                    </div>
                    <Link to="/calendar" className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>View Calendar</Link>
                </div>
            )}

            {/* Pinned Stats Section */}
            <div style={{ marginBottom: '24px' }}>
                <StatsWidget overdueCount={overdueCount} todayCount={todayCount} tomorrowCount={tomorrowCount} weekCount={weekCount} />
            </div>

            {/* Pinned Progress Section */}
            <div style={{ marginBottom: '24px' }}>
                <ProgressWidget userStats={userStats} tasksDoneToday={tasksDoneToday} dailyGoal={dailyGoal} setIsShareModalOpen={setIsShareModalOpen} />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={layout} strategy={rectSortingStrategy}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                        {layout.map(id => (
                            <SortableWidget key={id} id={id}>
                                {renderWidget(id)}
                            </SortableWidget>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Share Modal */}
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share Your Progress">
                <ShareableCard type="streak" data={{ streak: userStats.current_streak, tasks: tasksDoneToday }} user={user} />
            </Modal>

            <style>{`
                .survival-theme {
                    --bg-app: #0f172a !important;
                    --bg-surface: #1e293b !important;
                    --text-main: #f8fafc !important;
                    --text-secondary: #94a3b8 !important;
                    --border: #334155 !important;
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
