import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Clock, MapPin } from 'lucide-react';
import { isToday, formatDate } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import { generateICS, downloadFile } from '../utils/exportUtils';
import Modal from '../components/Modal';

// Reusing SyncModal from Planner
const SyncModal = ({ isOpen, onClose, onDownload }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sync to Calendar">
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{
                    width: '64px', height: '64px', background: 'var(--bg-app)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 20px', color: 'var(--primary)'
                }}>
                    <CalIcon size={32} />
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                    Download your schedule as an <strong>.ics</strong> file. You can import this into:
                    <br />
                    Google Calendar • Apple Calendar • Outlook
                </p>
                <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'left', fontSize: '0.85rem', border: '1px solid var(--border)' }}>
                    <strong>Includes:</strong> Classes, Assignments, and Tasks.
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                    <button className="btn btn-primary" onClick={onDownload} style={{ flex: 1 }}>
                        Download .ICS
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const Calendar = () => {
    const { courses, assignments, tasks, addNotification } = useApp();
    const [view, setView] = useState('week'); // 'month' or 'week'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    // Helper: Get Start of Week (Sunday)
    const getStartOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day; // adjust when day is sunday
        return new Date(date.setDate(diff));
    };

    const startOfWeek = getStartOfWeek(currentDate);

    // Navigation
    const nextPeriod = () => {
        const newDate = new Date(currentDate);
        if (view === 'week') newDate.setDate(newDate.getDate() + 7);
        else newDate.setMonth(newDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    const prevPeriod = () => {
        const newDate = new Date(currentDate);
        if (view === 'week') newDate.setDate(newDate.getDate() - 7);
        else newDate.setMonth(newDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const goToToday = () => setCurrentDate(new Date());

    // Get Data for a specific date
    const getEventsForDate = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Mon"
        const events = [];

        // 1. Assignments
        assignments.forEach(a => {
            if (a.dueDate === dateStr) {
                events.push({ type: 'assignment', title: a.title, color: 'var(--primary)', time: 'Due 11:59 PM', id: a.id });
            }
        });

        // 2. Tasks
        tasks.forEach(t => {
            // Simple Due Date
            if (t.dueDate === dateStr) {
                events.push({ type: 'task', title: t.title, color: 'var(--accent)', time: 'Task', id: t.id });
            }
            // Recurrence (Weekly)
            if (t.recurrence && t.recurrence.frequency === 'weekly') {
                // If the day-of-week matches AND date is >= created/due date?
                // Simplification for MVP: If day of week matches the original due date day of week
                const taskDate = new Date(t.dueDate);
                // Fix timezone issue by parsing properly? 
                // Let's assume t.dueDate is YYYY-MM-DD.
                const tDayName = new Date(t.dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

                if (tDayName === dayName && dateStr >= t.dueDate) {
                    // Check if not already added (to avoid double counting if due today)
                    if (t.dueDate !== dateStr) {
                        events.push({ type: 'task', title: t.title, color: 'var(--accent)', time: 'Recurring', id: t.id + '-rec' });
                    }
                }
            }
        });

        // 3. Classes (Schedule)
        courses.forEach(c => {
            if (c.schedule) {
                c.schedule.forEach(s => {
                    // s.day is "Mon", "Tue"... matches dayName
                    if (s.day === dayName) {
                        events.push({
                            type: 'class',
                            title: c.code,
                            desc: c.name,
                            color: c.color || '#94a3b8',
                            time: `${s.start} - ${s.end}`,
                            location: s.location,
                            id: c.id + s.start
                        });
                    }
                });
            }
        });

        // Sort by time?
        // Classes have times. Assignments usually end of day.
        return events.sort((a, b) => {
            // simple sort: classes first, then tasks/assignments
            if (a.type === 'class' && b.type !== 'class') return -1;
            if (a.type !== 'class' && b.type === 'class') return 1;
            return 0;
        });
    };

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Calendar</h1>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={() => setIsSyncModalOpen(true)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <CalIcon size={18} /> Sync
                    </button>
                    <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <button
                            onClick={prevPeriod}
                            style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', borderRight: '1px solid var(--border)' }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={goToToday}
                            style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                        >
                            Today
                        </button>
                        <button
                            onClick={nextPeriod}
                            style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', borderLeft: '1px solid var(--border)' }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <button
                            onClick={() => setView('week')}
                            style={{
                                padding: '8px 16px', border: 'none', cursor: 'pointer',
                                background: view === 'week' ? 'var(--primary)' : 'transparent',
                                color: view === 'week' ? 'white' : 'var(--text-main)'
                            }}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setView('month')}
                            style={{
                                padding: '8px 16px', border: 'none', cursor: 'pointer',
                                background: view === 'month' ? 'var(--primary)' : 'transparent',
                                color: view === 'month' ? 'white' : 'var(--text-main)'
                            }}
                        >
                            Month
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>

                {view === 'week' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflowY: 'auto' }}>
                        {Array.from({ length: 7 }).map((_, idx) => {
                            const date = new Date(startOfWeek);
                            date.setDate(date.getDate() + idx);
                            const isTodayDate = isToday(date.toISOString().split('T')[0]);
                            const events = getEventsForDate(date);

                            return (
                                <div key={idx} style={{ borderRight: idx < 6 ? '1px solid var(--border)' : 'none', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{
                                        padding: '12px', borderBottom: '1px solid var(--border)', textAlign: 'center',
                                        background: isTodayDate ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                                    }}>
                                        <div style={{ fontSize: '0.85rem', color: isTodayDate ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div style={{
                                            fontSize: '1.5rem', fontWeight: 'bold',
                                            width: '36px', height: '36px', lineHeight: '36px',
                                            margin: '4px auto 0', borderRadius: '50%',
                                            background: isTodayDate ? 'var(--primary)' : 'transparent',
                                            color: isTodayDate ? 'white' : 'inherit'
                                        }}>
                                            {date.getDate()}
                                        </div>
                                    </div>
                                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, background: isTodayDate ? 'rgba(99, 102, 241, 0.02)' : 'transparent' }}>
                                        {events.map((ev, i) => (
                                            <div key={i} style={{
                                                background: ev.type === 'class' ? 'var(--bg-app)' : ev.color,
                                                color: ev.type === 'class' ? 'var(--text-main)' : 'white',
                                                borderLeft: ev.type === 'class' ? `4px solid ${ev.color}` : 'none',
                                                borderRadius: '6px', padding: '8px', fontSize: '0.8rem',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{ev.title}</div>
                                                {ev.time && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9, fontSize: '0.75rem' }}>
                                                        <Clock size={10} /> {ev.time}
                                                    </div>
                                                )}
                                                {ev.location && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7, fontSize: '0.75rem', marginTop: '2px' }}>
                                                        <MapPin size={10} /> {ev.location}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                        {/* Headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                            <div key={d} style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderRight: i < 6 ? '1px solid var(--border)' : 'none', fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {d}
                            </div>
                        ))}
                        {/* Days */}
                        {/* We need to pad the start */}
                        {(() => {
                            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                            const startDay = monthStart.getDay(); // 0-6
                            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                            const cells = [];

                            // Padding
                            for (let i = 0; i < startDay; i++) {
                                cells.push(<div key={`pad-${i}`} style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />);
                            }

                            // Days
                            for (let d = 1; d <= daysInMonth; d++) {
                                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                                const isTodayDate = isToday(date.toISOString().split('T')[0]);
                                const events = getEventsForDate(date);

                                cells.push(
                                    <div key={d} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', height: '100px', padding: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px',
                                            color: isTodayDate ? 'var(--primary)' : 'var(--text-secondary)'
                                        }}>
                                            {d}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {events.slice(0, 3).map((ev, i) => (
                                                <div key={i} style={{
                                                    fontSize: '0.7rem', padding: '2px 4px', borderRadius: '4px',
                                                    background: ev.type === 'class' ? '#f1f5f9' : ev.color,
                                                    color: ev.type === 'class' ? '#334155' : 'white',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    {ev.time.includes('-') ? '' : '• '}{ev.title}
                                                </div>
                                            ))}
                                            {events.length > 3 && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '4px' }}>+{events.length - 3} more</div>}
                                        </div>
                                    </div>
                                );
                            }
                            return cells;
                        })()}
                    </div>
                )}
            </div>

            <SyncModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                onDownload={() => {
                    const ics = generateICS(assignments, tasks, courses);
                    downloadFile(ics, 'college-organizer.ics', 'text/calendar');
                    addNotification('Calendar file downloaded!', 'success');
                    setIsSyncModalOpen(false);
                }}
            />
        </div>
    );
};

export default Calendar;
