import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { formatDate, isOverdue } from '../utils/dateUtils';

const Assignments = () => {
    const { assignments, addAssignment, updateAssignment, deleteAssignment, courses } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [filterCourse, setFilterCourse] = useState('all');

    const handleEdit = (assignment) => {
        setEditingAssignment(assignment);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this assignment?')) {
            deleteAssignment(id);
        }
    };

    // Sort by due date
    const sortedAssignments = [...assignments]
        .filter(a => filterCourse === 'all' || a.courseId === filterCourse)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Assignments</h1>
                <button className="btn btn-primary" onClick={() => { setEditingAssignment(null); setIsModalOpen(true); }}>
                    <Plus size={20} /> Add Assignment
                </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <select
                    className="input-field"
                    style={{ maxWidth: '200px' }}
                    value={filterCourse}
                    onChange={e => setFilterCourse(e.target.value)}
                >
                    <option value="all">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sortedAssignments.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '48px' }}>No assignments found.</p>
                ) : (
                    sortedAssignments.map(assignment => {
                        const course = courses.find(c => c.id === assignment.courseId);
                        const categoryName = course?.categories?.find(cat => cat.id === assignment.categoryId)?.name || 'Unknown';
                        const isGraded = assignment.pointsEarned !== undefined && assignment.pointsEarned !== null && assignment.pointsEarned !== '';

                        return (
                            <div key={assignment.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: `4px solid ${course?.color || 'var(--border)'}` }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>{assignment.title}</span>
                                        {isGraded ? (
                                            <span style={{ fontSize: '0.75rem', background: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>GRADED</span>
                                        ) : isOverdue(assignment.dueDate) ? (
                                            <span style={{ fontSize: '0.75rem', background: 'var(--danger)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>OVERDUE</span>
                                        ) : null}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {course?.code} • {categoryName} • Due {formatDate(assignment.dueDate)}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right', marginRight: '16px' }}>
                                    {isGraded ? (
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                            {assignment.pointsEarned} / {assignment.pointsPossible}
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            -- / {assignment.pointsPossible}
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => handleEdit(assignment)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(assignment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', marginLeft: '8px' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            <AssignmentForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingAssignment}
                courses={courses}
                onSubmit={(data) => {
                    if (editingAssignment) {
                        updateAssignment(editingAssignment.id, data);
                    } else {
                        addAssignment(data);
                    }
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
};

const AssignmentForm = ({ isOpen, onClose, initialData, courses, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [courseId, setCourseId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [pointsPossible, setPointsPossible] = useState('100');
    const [pointsEarned, setPointsEarned] = useState('');

    // Load initial data
    // Load initial data
    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title);
            setCourseId(initialData.courseId);
            setCategoryId(initialData.categoryId);
            setDueDate(initialData.dueDate);
            setPointsPossible(initialData.pointsPossible);
            setPointsEarned(initialData.pointsEarned || '');
        } else if (isOpen) {
            setTitle('');
            setCourseId(courses[0]?.id || '');
            // default category?
            setCategoryId(courses[0]?.categories?.[0]?.id || '');
            setDueDate(''); // Today?
            setPointsPossible('100');
            setPointsEarned('');
        }
    }, [isOpen, initialData, courses]);

    // When course changes, reset category
    const handleCourseChange = (id) => {
        setCourseId(id);
        const course = courses.find(c => c.id === id);
        if (course && course.categories.length > 0) {
            setCategoryId(course.categories[0].id);
        } else {
            setCategoryId('');
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            title,
            courseId,
            categoryId,
            dueDate,
            pointsPossible: Number(pointsPossible),
            pointsEarned: pointsEarned === '' ? null : Number(pointsEarned)
        });
    };

    const selectedCourse = courses.find(c => c.id === courseId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Assignment' : 'Add Assignment'}>
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label className="input-label">Title</label>
                    <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Essay 1" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                        <label className="input-label">Course</label>
                        <select className="input-field" value={courseId} onChange={e => handleCourseChange(e.target.value)} required>
                            <option value="" disabled>Select Course</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Category</label>
                        <select className="input-field" value={categoryId} onChange={e => setCategoryId(e.target.value)} required disabled={!courseId}>
                            {selectedCourse?.categories?.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">Due Date</label>
                    <input className="input-field" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                        <label className="input-label">Points Possible</label>
                        <input className="input-field" type="number" value={pointsPossible} onChange={e => setPointsPossible(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Points Earned (Optional)</label>
                        <input className="input-field" type="number" value={pointsEarned} onChange={e => setPointsEarned(e.target.value)} placeholder="--" />
                    </div>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{initialData ? 'Save Changes' : 'Add Assignment'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default Assignments;
