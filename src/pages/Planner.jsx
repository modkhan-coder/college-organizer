import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StudyPlanModal from '../components/StudyPlanModal';
import AIPlannerModal from '../components/AIPlannerModal';
import { supabase } from '../lib/supabase';
import { CheckCircle, Circle, Clock, Plus, Filter, Calendar as CalIcon, Share2, Copy, Check, Trash2, Bell, RefreshCw, FileText, Paperclip, Brain, Sparkles } from 'lucide-react';
import { formatDate, isOverdue, isToday, isTomorrow } from '../utils/dateUtils';
import { generateICS, downloadFile } from '../utils/exportUtils';

const Planner = () => {
    console.log("Planner render - AI button check");
    const { assignments, tasks, addTask, addTasks, toggleTask, deleteTask, courses, createInvite, addNotification } = useApp();
    const [filter, setFilter] = useState({ type: 'all', status: 'all' });
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
    const [isAIPlannerOpen, setIsAIPlannerOpen] = useState(false);
    const [linkingAssignment, setLinkingAssignment] = useState(null); // If creating a task for an assignment

    // Combine and Sort
    const combinedItems = [
        ...assignments.map(a => ({ ...a, type: 'assignment', date: a.dueDate, completed: !!a.pointsEarned })),
        ...tasks.map(t => ({ ...t, type: 'task', date: t.dueDate }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Filter
    const filteredItems = combinedItems.filter(item => {
        if (filter.type !== 'all' && item.type !== filter.type) return false;
        if (filter.status === 'open' && item.completed) return false;
        if (filter.status === 'completed' && !item.completed) return false;
        return true;
    });

    const handlePlanStudy = (assignment) => {
        setLinkingAssignment(assignment);
        const title = assignment.title.toLowerCase();
        // Heuristic: If it looks like a big exam, suggest Study Plan
        if (title.includes('exam') || title.includes('midterm') || title.includes('final') || title.includes('test')) {
            setIsStudyModalOpen(true);
        } else {
            setIsTaskModalOpen(true);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Planner</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        className="btn"
                        onClick={() => setIsAIPlannerOpen(true)}
                        style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Sparkles size={20} /> AI Auto-Schedule
                    </button>
                    <button className="btn btn-secondary" onClick={() => setIsSyncModalOpen(true)}>
                        <CalIcon size={20} /> Sync
                    </button>
                    <button className="btn btn-secondary" onClick={() => setIsShareModalOpen(true)}>
                        <Share2 size={20} /> Share
                    </button>
                    <button className="btn btn-primary" onClick={() => { setLinkingAssignment(null); setIsTaskModalOpen(true); }}>
                        <Plus size={20} /> Add Task
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <Filter size={20} color="var(--text-secondary)" />
                <select className="input-field" value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
                    <option value="all">All Types</option>
                    <option value="assignment">Assignments</option>
                    <option value="task">Tasks</option>
                </select>
                <select className="input-field" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {/* Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                        No items found.
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const isOver = isOverdue(item.date) && !item.completed;
                        const isDone = item.completed;
                        const course = courses.find(c => c.id === item.courseId); // assignments have courseId
                        // tasks might have courseCode string or courseId if linked?
                        // For now assuming tasks created here might just be plain text or linked to assignment.

                        return (
                            <div key={`${item.type}-${item.id}`} className="card" style={{
                                padding: '16px', display: 'flex', alignItems: 'center', gap: '16px',
                                opacity: isDone ? 0.6 : 1,
                                borderLeft: `4px solid ${item.type === 'assignment' ? 'var(--primary)' : 'var(--accent)'}`
                            }}>
                                {/* Checkbox for Tasks */}
                                {item.type === 'task' ? (
                                    <button onClick={() => toggleTask(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDone ? 'var(--success)' : 'var(--text-secondary)' }}>
                                        {isDone ? <CheckCircle size={24} /> : <Circle size={24} />}
                                    </button>
                                ) : (
                                    // Assignment Icon
                                    <div style={{ width: '24px', display: 'flex', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <CalIcon size={20} />
                                    </div>
                                )}

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: '600', textDecoration: isDone ? 'line-through' : 'none' }}>
                                            {item.title}
                                        </span>
                                        {item.type === 'assignment' && <span style={{ fontSize: '0.75rem', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px' }}>Assignment</span>}
                                        {isOver && <span style={{ fontSize: '0.75rem', background: 'var(--danger)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>OVERDUE</span>}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {formatDate(item.date)} {course ? `• ${course.code}` : ''}

                                        {/* Icons */}
                                        {item.recurrenceRule && (
                                            <div title="Recurring Task" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px' }}>
                                                <RefreshCw size={12} />
                                                <span style={{ fontSize: '0.7rem' }}>{item.recurrenceRule.frequency}</span>
                                            </div>
                                        )}
                                        {item.reminders && item.reminders.length > 0 && (
                                            <div title={`${item.reminders.length} reminder(s)`} style={{ color: 'var(--primary)' }}>
                                                <Bell size={12} fill="currentColor" />
                                            </div>
                                        )}
                                        {item.notes && (
                                            <div title="Has Notes" style={{ color: 'var(--text-secondary)' }}>
                                                <FileText size={12} />
                                            </div>
                                        )}
                                        {item.attachments && item.attachments.length > 0 && (
                                            <div title="Has Attachments" style={{ color: 'var(--text-secondary)' }}>
                                                <Paperclip size={12} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Delete Button for Tasks */}
                                {item.type === 'task' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this task?')) deleteTask(item.id);
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.5 }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}

                                {!isDone && item.type === 'assignment' && (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                                        onClick={() => handlePlanStudy(item)}
                                    >
                                        Plan Study
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <TaskForm
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                initialDesc={linkingAssignment ? `Study for ${linkingAssignment.title}` : ''}
                initialDate={linkingAssignment ? linkingAssignment.dueDate : ''} // Default to due date, user can change
                onSubmit={(val) => {
                    addTask(val);
                    setIsTaskModalOpen(false);
                }}
            />

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                createInvite={createInvite}
                addNotification={addNotification}
            />

            <StudyPlanModal
                isOpen={isStudyModalOpen}
                onClose={() => setIsStudyModalOpen(false)}
                examTitle={linkingAssignment?.title || 'Exam'}
                examDate={linkingAssignment?.dueDate || new Date().toISOString().split('T')[0]}
                onGenerate={(tasks) => {
                    addTasks(tasks);
                    setIsStudyModalOpen(false);
                }}
            />

            <AIPlannerModal
                isOpen={isAIPlannerOpen}
                onClose={() => setIsAIPlannerOpen(false)}
                assignments={assignments.filter(a => !a.completed)} // Only plan for open assignments
                onSaveTasks={(newTasks) => {
                    addTasks(newTasks);
                    addNotification(`Added ${newTasks.length} study tasks!`, 'success');
                }}
            />

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

const ShareModal = ({ isOpen, onClose, createInvite, addNotification }) => {
    const [inviteLink, setInviteLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const invite = await createInvite('schedule_share', null, { scope: 'planner_full' });
            if (invite) {
                const link = `${window.location.origin}/invite/${invite.id}`;
                setInviteLink(link);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        addNotification('Link copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Your Schedule">
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{
                    width: '64px', height: '64px', background: 'var(--bg-app)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 20px', color: 'var(--primary)'
                }}>
                    <Share2 size={32} />
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Generate a link to share your current study schedule and deadlines with friends or accountability partners.
                </p>

                {!inviteLink ? (
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{ width: '100%' }}
                    >
                        {loading ? 'Generating...' : 'Generate Share Link'}
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{
                            padding: '12px',
                            background: 'var(--bg-app)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            fontSize: '0.85rem',
                            wordBreak: 'break-all',
                            textAlign: 'left'
                        }}>
                            {inviteLink}
                        </div>
                        <button className="btn btn-primary" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setInviteLink('')}>
                            Create New Link
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const TaskForm = ({ isOpen, onClose, initialDesc, initialDate, onSubmit }) => {
    const { user } = useApp();
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [priority, setPriority] = useState('medium');
    const [estMinutes, setEstMinutes] = useState('60');
    // Recurrence State
    const [recurrenceType, setRecurrenceType] = useState('none'); // none, daily, weekly
    // Reminders State
    const [reminders, setReminders] = useState([]); // Array of { offset: number, unit: 'minutes'|'hours' }
    // New Fields
    const [notes, setNotes] = useState('');
    // Attachments State: Array of { name, url, type }
    // For file inputs, we first upload to storage then store the URL.
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Load initials
    useEffect(() => {
        if (isOpen) {
            setTitle(initialDesc || '');
            setDate(initialDate || new Date().toISOString().split('T')[0]);
            setPriority('medium');
            setEstMinutes('60');
            setRecurrenceType('none');
            setReminders([]);
            setNotes('');
            setAttachments([]);
        }
    }, [isOpen, initialDesc, initialDate]);

    const addReminder = () => {
        setReminders([...reminders, { offset: 60 }]); // Default 1 hour
    };

    const removeReminder = (index) => {
        setReminders(reminders.filter((_, i) => i !== index));
    };

    const updateReminder = (index, val) => {
        const newReminders = [...reminders];
        newReminders[index] = { offset: parseInt(val) };
        setReminders(newReminders);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Unqique path: user_id/timestamp_filename
            const filePath = `${user.id}/${Date.now()}_${file.name}`;

            // Upload
            const { error: uploadError } = await supabase.storage
                .from('task_attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('task_attachments')
                .getPublicUrl(filePath);

            const newAttachment = {
                name: file.name,
                url: publicUrl,
                type: file.type
            };
            setAttachments([...attachments, newAttachment]);

        } catch (error) {
            alert('Error uploading file: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Construct Recurrence Rule
        let recurrenceRule = null;
        if (recurrenceType !== 'none') {
            recurrenceRule = {
                frequency: recurrenceType,
                interval: 1 // Default to every 1 day/week
            };
        }

        onSubmit({
            title,
            dueDate: date,
            priority,
            estMinutes: Number(estMinutes),
            recurrenceRule,
            reminders,
            notes,
            attachments
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Smart Task">
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label className="input-label">Task Name</label>
                    <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Weekly Quiz" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                        <label className="input-label">Due Date</label>
                        <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Est. Time (min)</label>
                        <input className="input-field" type="number" step="15" value={estMinutes} onChange={e => setEstMinutes(e.target.value)} />
                    </div>
                </div>

                {/* Notes Section */}
                <div className="input-group" style={{ marginTop: '16px' }}>
                    <label className="input-label">Notes</label>
                    <textarea
                        className="input-field"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add details, links, or instructions..."
                        style={{ minHeight: '80px', fontFamily: 'inherit' }}
                    />
                </div>

                {/* Attachments Section */}
                <div className="input-group" style={{ marginTop: '16px' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Attachments</span>
                        {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Uploading...</span>}
                    </label>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem'
                        }}>
                            <Plus size={16} /> Upload File
                            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
                        </label>
                    </div>

                    {attachments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {attachments.map((att, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px', background: 'var(--bg-app)', borderRadius: '6px', fontSize: '0.9rem'
                                }}>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'var(--primary)' }}>
                                        {att.name}
                                    </a>
                                    <button type="button" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>


                {/* Recurrence Section */}
                <div className="input-group" style={{ marginTop: '12px' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} /> Recurrence
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            className={`btn ${recurrenceType === 'none' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setRecurrenceType('none')}
                            style={{ flex: 1, fontSize: '0.9rem' }}
                        >
                            None
                        </button>
                        <button
                            type="button"
                            className={`btn ${recurrenceType === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setRecurrenceType('daily')}
                            style={{ flex: 1, fontSize: '0.9rem' }}
                        >
                            Daily
                        </button>
                        <button
                            type="button"
                            className={`btn ${recurrenceType === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setRecurrenceType('weekly')}
                            style={{ flex: 1, fontSize: '0.9rem' }}
                        >
                            Weekly
                        </button>
                    </div>
                </div>

                {/* Reminders Section */}
                <div className="input-group" style={{ marginTop: '12px' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={16} /> Reminders</span>
                        <button type="button" onClick={addReminder} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>+ Add</button>
                    </label>

                    {reminders.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No reminders set.</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {reminders.map((rem, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                    className="input-field"
                                    value={rem.offset}
                                    onChange={(e) => updateReminder(idx, e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="60">1 Hour Before</option>
                                    <option value="120">2 Hours Before</option>
                                    <option value="1440">1 Day Before</option>
                                    <option value="0">Day of (9 AM)</option>
                                </select>
                                <button type="button" onClick={() => removeReminder(idx)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="input-group" style={{ marginTop: '16px' }}>
                    <label className="input-label">Priority</label>
                    <select className="input-field" value={priority} onChange={e => setPriority(e.target.value)}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={uploading}>Save Task</button>
                </div>
            </form>
        </Modal >
    );
};

const SyncModal = ({ isOpen, onClose, onDownload }) => {
    // In a real app, this URL would come from the user's profile or env config
    // For now, we construct it based on the current user ID we can get check
    // Actually, we need the user ID. We can get it from useApp() context, 
    // but SyncModal props don't pass it. Let's fix that or use useApp inside.
    const { user } = useApp();
    const [copied, setCopied] = useState(false);

    // Mock Feed URL - In production, this points to your Supabase Function
    const feedUrl = user ? `https://jpggbgvbfeuadlhonslu.supabase.co/functions/v1/calendar-feed?u=${user.id}` : 'Loading...';

    const handleCopy = () => {
        navigator.clipboard.writeText(feedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sync to Calendar">
            <div style={{ padding: '10px 0' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '64px', height: '64px', background: 'var(--bg-app)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 16px', color: 'var(--primary)'
                    }}>
                        <RefreshCw size={32} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Connect your schedule to <strong>Apple or Google Calendar</strong>.
                    </p>
                </div>

                <div className="input-group">
                    <label className="input-label">Subscribe (Auto-Updates)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            className="input-field"
                            readOnly
                            value={feedUrl}
                            style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                        />
                        <button className="btn btn-primary" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Paste this URL into your calendar app's "Add Subscription" or "Add from URL" section.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                <button className="btn btn-secondary" onClick={onDownload} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <CalIcon size={18} /> Download Static .ICS File
                </button>
            </div>
        </Modal>
    );
};

export default Planner;
