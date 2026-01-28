import { useState } from 'react';
import Modal from './Modal';
import { Calendar, Brain, Clock, Zap } from 'lucide-react';

const StudyPlanModal = ({ isOpen, onClose, examTitle, examDate, onGenerate }) => {
    const [intensity, setIntensity] = useState('balanced');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

    const handleGenerate = () => {
        // Algorithm:
        // 1. Calculate days until exam
        // 2. Based on intensity, determine key sessions

        const exam = new Date(examDate);
        const start = new Date(startDate);
        const diffTime = Math.abs(exam - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 1) {
            alert("Exam is too soon! Just study now!");
            return;
        }

        const tasks = [];

        // Helper to format date
        const getDateBefore = (days) => {
            const d = new Date(exam);
            d.setDate(d.getDate() - days);
            return d.toISOString().split('T')[0];
        };

        // Helper to check if date is in past relative to start
        const isValidDate = (dateStr) => {
            return new Date(dateStr) >= new Date(startDate);
        };

        // Strategy Pattern
        if (intensity === 'chill') {
            // T-7: Review Notes
            // T-2: Practice
            if (diffDays >= 7) tasks.push({ title: `Review Notes: ${examTitle}`, daysBefore: 7, est: 60 });
            if (diffDays >= 2) tasks.push({ title: `Practice Questions: ${examTitle}`, daysBefore: 2, est: 45 });
        } else if (intensity === 'balanced') {
            // T-5: Deep Dive
            // T-3: Practice Test
            // T-1: Quick Review
            if (diffDays >= 5) tasks.push({ title: `Deep Dive Study: ${examTitle}`, daysBefore: 5, est: 90 });
            if (diffDays >= 3) tasks.push({ title: `Practice Test: ${examTitle}`, daysBefore: 3, est: 120 });
            if (diffDays >= 1) tasks.push({ title: `Final Revision: ${examTitle}`, daysBefore: 1, est: 60 });
        } else if (intensity === 'cram') {
            // Every day for last 3 days
            if (diffDays >= 3) tasks.push({ title: `Cram Session 1: ${examTitle}`, daysBefore: 3, est: 180 });
            if (diffDays >= 2) tasks.push({ title: `Cram Session 2: ${examTitle}`, daysBefore: 2, est: 180 });
            if (diffDays >= 1) tasks.push({ title: `Final Cram: ${examTitle}`, daysBefore: 1, est: 240 });
        }

        // Generate final objects
        const generatedTasks = tasks.map(t => {
            const dueDate = getDateBefore(t.daysBefore);
            return isValidDate(dueDate) ? {
                title: t.title,
                dueDate: dueDate,
                estMinutes: t.est,
                priority: 'high',
                notes: `Auto-generated study session for ${examTitle}.`
            } : null;
        }).filter(t => t !== null);

        // Always add "Exam Day" event/task if desired? No, we have the assignment. 
        // But maybe a "Morning Warmup"?
        if (intensity === 'cram') {
            generatedTasks.push({
                title: `Morning Warmup: ${examTitle}`,
                dueDate: examDate,
                estMinutes: 30,
                priority: 'high',
                notes: 'Quick review of formulas/concepts before the exam.'
            });
        }

        onGenerate(generatedTasks);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Study Plan">
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '50%', display: 'inline-block', marginBottom: '12px', color: 'var(--primary)' }}>
                    <Brain size={32} />
                </div>
                <h3>{examTitle}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Exam on {new Date(examDate).toLocaleDateString()}</p>
            </div>

            <div className="input-group">
                <label className="input-label">Start Studying From</label>
                <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            <div className="input-group" style={{ marginTop: '20px' }}>
                <label className="input-label">Intensity Level</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <button
                        className={`btn ${intensity === 'chill' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIntensity('chill')}
                        style={{ flexDirection: 'column', gap: '8px', padding: '16px' }}
                    >
                        <Clock size={20} />
                        <span>Lite</span>
                    </button>
                    <button
                        className={`btn ${intensity === 'balanced' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIntensity('balanced')}
                        style={{ flexDirection: 'column', gap: '8px', padding: '16px' }}
                    >
                        <Calendar size={20} />
                        <span>Normal</span>
                    </button>
                    <button
                        className={`btn ${intensity === 'cram' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIntensity('cram')}
                        style={{ flexDirection: 'column', gap: '8px', padding: '16px' }}
                    >
                        <Zap size={20} />
                        <span>Cram</span>
                    </button>
                </div>
                <p style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {intensity === 'chill' && "Relaxed pace. A couple of reviews."}
                    {intensity === 'balanced' && "Best practice. Deep work + Practice tests."}
                    {intensity === 'cram' && "High intensity. Multiple heavy sessions."}
                </p>
            </div>

            <div style={{ marginTop: '32px' }}>
                <button className="btn btn-primary" onClick={handleGenerate} style={{ width: '100%' }}>
                    Generate Schedule
                </button>
            </div>
        </Modal>
    );
};

export default StudyPlanModal;
