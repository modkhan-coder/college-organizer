import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, Book, ExternalLink, Clock, FileText, Edit3 } from 'lucide-react';
import Modal from '../components/Modal';
import SyllabusImportWizard from '../components/SyllabusImportWizard';

const Courses = () => {
    const { courses, addCourse, updateCourse, deleteCourse, user } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [creationMethod, setCreationMethod] = useState(null); // 'manual' | 'syllabus'

    const handleEdit = (course) => {
        setEditingCourse(course);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingCourse(null);
        setCreationMethod(null); // Reset to show method selector
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (confirm('Are you sure? This will delete all assignments for this course too.')) {
            deleteCourse(id);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Courses</h1>
                <button className="btn btn-primary" onClick={handleAdd}>
                    <Plus size={20} /> Add Course
                </button>
            </div>

            {courses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                    <Book size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
                    <h3 style={{ marginBottom: '8px' }}>No courses yet</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add your schedule to get started.</p>
                    <button className="btn btn-primary" onClick={handleAdd}>Add First Course</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    {courses.map(course => (
                        <CourseCard
                            key={course.id}
                            course={course}
                            onEdit={() => handleEdit(course)}
                            onDelete={() => handleDelete(course.id)}
                        />
                    ))}
                </div>
            )}

            <CourseFormWrapper
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setCreationMethod(null);
                }}
                initialData={editingCourse}
                creationMethod={creationMethod}
                setCreationMethod={setCreationMethod}
                user={user}
                onSubmit={(data) => {
                    if (editingCourse) {
                        updateCourse(editingCourse.id, data);
                    } else {
                        addCourse({ ...data, color: `hsl(${Math.random() * 360}, 70%, 60%)` });
                    }
                    setIsModalOpen(false);
                    setCreationMethod(null);
                }}
            />
        </div>
    );
};

const CourseCard = ({ course, onEdit, onDelete }) => (
    <div className="card" style={{ borderTop: `4px solid ${course.color || 'var(--primary)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{course.code}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{course.name}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <Link to={`/courses/${course.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }} title="View Details">
                    <ExternalLink size={18} />
                </Link>
                <button onClick={onEdit} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={18} /></button>
                <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
            </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <span style={{ background: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px' }}>{course.credits} Credits</span>
            <span style={{ background: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px' }}>{course.categories?.length || 0} Categories</span>
        </div>

        {/* Mini Weights Visualization */}
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0' }}>
            {(course.categories || []).map((cat, idx) => (
                <div key={idx} style={{
                    width: `${cat.weight}%`,
                    background: `hsl(${idx * 40}, 70%, 60%)`, // visual placeholder colors
                    title: `${cat.name} (${cat.weight}%)`
                }} />
            ))}
        </div>

        {/* Schedule Display */}
        {course.schedule && course.schedule.length > 0 && (
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {course.schedule.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} />
                        <span>{s.day} {s.start} - {s.end} {s.location ? `(${s.location})` : ''}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const CourseForm = ({ isOpen, onClose, initialData, onSubmit }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [credits, setCredits] = useState('3');
    const [categories, setCategories] = useState([{ id: uuidv4(), name: 'Homework', weight: 40 }, { id: uuidv4(), name: 'Exams', weight: 60 }]);
    const [schedule, setSchedule] = useState([]);

    const DEFAULT_SCALE = `A: 93-100
A-: 90-92
B+: 87-89
B: 83-86
B-: 80-82
C+: 77-79
C: 73-76
C-: 70-72
D: 60-69
F: 0-59`;

    const [gradingScale, setGradingScale] = useState(DEFAULT_SCALE);

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setCode(initialData.code);
                setCredits(initialData.credits);
                setCredits(initialData.credits);
                setCategories(initialData.categories || []);
                setSchedule(initialData.schedule || []);
                setGradingScale(initialData.gradingScale || DEFAULT_SCALE);
            } else {
                setName('');
                setCode('');
                setCredits('3');
                setCategories([{ id: uuidv4(), name: 'Homework', weight: 40 }, { id: uuidv4(), name: 'Exams', weight: 60 }]);
                setSchedule([]);
                setGradingScale(DEFAULT_SCALE); // Default for new
            }
        }
    }, [isOpen, initialData]);

    const handleCategoryChange = (id, field, value) => {
        setCategories(categories.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addCategory = () => {
        setCategories([...categories, { id: uuidv4(), name: 'New Category', weight: 10 }]);
    };

    const removeCategory = (id) => {
        setCategories(categories.filter(c => c.id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            name,
            code,
            credits: Number(credits),
            categories: categories.map(c => ({ ...c, weight: Number(c.weight) })),
            schedule,
            gradingScale // pass the string
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Course' : 'Add New Course'}>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                        <label className="input-label">Course Code</label>
                        <input className="input-field" placeholder="e.g. MATH 101" value={code} onChange={e => setCode(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Credits</label>
                        <input className="input-field" type="number" min="0" step="0.5" value={credits} onChange={e => setCredits(e.target.value)} required />
                    </div>
                </div>
                <div className="input-group">
                    <label className="input-label">Course Name</label>
                    <input className="input-field" placeholder="e.g. Intro to Calculus" value={name} onChange={e => setName(e.target.value)} required />
                </div>

                {/* Schedule Builder */}
                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="input-label">Class Schedule</label>
                        <button type="button" onClick={() => setSchedule([...schedule, { day: 'Mon', start: '10:00', end: '11:00', location: '' }])} style={{ fontSize: '0.875rem', color: 'var(--primary)', background: 'none', border: 'none' }}>+ Add Time</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {schedule.map((slot, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                    className="input-field"
                                    style={{ flex: 1, padding: '8px' }}
                                    value={slot.day}
                                    onChange={e => {
                                        const newSched = [...schedule];
                                        newSched[idx].day = e.target.value;
                                        setSchedule(newSched);
                                    }}
                                >
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <input
                                    className="input-field"
                                    type="time"
                                    style={{ flex: 1 }}
                                    value={slot.start}
                                    onChange={e => {
                                        const newSched = [...schedule];
                                        newSched[idx].start = e.target.value;
                                        setSchedule(newSched);
                                    }}
                                />
                                <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                <input
                                    className="input-field"
                                    type="time"
                                    style={{ flex: 1 }}
                                    value={slot.end}
                                    onChange={e => {
                                        const newSched = [...schedule];
                                        newSched[idx].end = e.target.value;
                                        setSchedule(newSched);
                                    }}
                                />
                                <input
                                    className="input-field"
                                    placeholder="Room (opt)"
                                    style={{ flex: 1 }}
                                    value={slot.location || ''}
                                    onChange={e => {
                                        const newSched = [...schedule];
                                        newSched[idx].location = e.target.value;
                                        setSchedule(newSched);
                                    }}
                                />
                                <button type="button" onClick={() => setSchedule(schedule.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', background: 'none', border: 'none' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="input-label">Grading Categories & Weights</label>
                        <button type="button" onClick={addCategory} style={{ fontSize: '0.875rem', color: 'var(--primary)', background: 'none', border: 'none' }}>+ Add Category</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {categories.map((cat) => (
                            <div key={cat.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    className="input-field"
                                    style={{ flex: 2, padding: '8px' }}
                                    value={cat.name}
                                    onChange={e => handleCategoryChange(cat.id, 'name', e.target.value)}
                                    placeholder="Category Name"
                                />
                                <input
                                    className="input-field"
                                    style={{ flex: 1, padding: '8px' }}
                                    type="number"
                                    value={cat.weight}
                                    onChange={e => handleCategoryChange(cat.id, 'weight', e.target.value)}
                                    placeholder="Weight"
                                />
                                <button type="button" onClick={() => removeCategory(cat.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="input-group" style={{ marginTop: '24px' }}>
                    <label className="input-label">Letter grade scale (optional)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        One per line, like: <code>A: 94-100</code>
                    </p>
                    <textarea
                        className="input-field"
                        rows={8}
                        value={gradingScale}
                        onChange={e => setGradingScale(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{initialData ? 'Save Changes' : 'Create Course'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default Courses;
