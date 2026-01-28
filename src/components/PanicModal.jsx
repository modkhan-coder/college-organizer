import { useState, useMemo } from 'react';
import { AlertTriangle, Clock, Calendar, CheckCircle2, Flame, Zap } from 'lucide-react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';

const PanicModal = ({ isOpen, onClose }) => {
    const { calculatePriorityScores, planPanicSession } = useApp();
    const [planning, setPlanning] = useState(false);

    const priorityItems = useMemo(() => calculatePriorityScores(), [isOpen, calculatePriorityScores]);

    const handleAutoPlan = async () => {
        setPlanning(true);
        const top3 = priorityItems.slice(0, 3);
        await planPanicSession(top3);
        setPlanning(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Priority Command Center">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: '1px solid #ef4444'
                }}>
                    <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '50%' }}>
                        <Flame size={24} />
                    </div>
                    <div>
                        <h3 style={{ color: '#991b1b', marginBottom: '4px' }}>Feeling Overwhelmed?</h3>
                        <p style={{ fontSize: '0.9rem', color: '#b91c1c' }}>
                            Our algorithm analyzed your {priorityItems.length} upcoming assignments to find what deserves your focus first.
                        </p>
                    </div>
                </div>

                {priorityItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <p>No urgent assignments! You're all caught up.</p>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            {priorityItems.map((item, idx) => (
                                <div key={item.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px',
                                    background: 'var(--bg-app)',
                                    borderRadius: 'var(--radius-md)',
                                    borderLeft: `6px solid ${item.courseColor}`,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {/* Rank Badge */}
                                    <div style={{
                                        position: 'absolute', right: '-10px', top: '-10px',
                                        background: idx === 0 ? '#ef4444' : 'var(--border)',
                                        color: idx === 0 ? 'white' : 'var(--text-secondary)',
                                        fontSize: '0.7rem', fontWeight: 'bold', padding: '15px 15px 5px 5px',
                                        borderRadius: '50%'
                                    }}>
                                        #{idx + 1}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                            {item.courseName}
                                        </div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>{item.title}</div>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: item.diffDays <= 2 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                                <Clock size={14} /> Due in {item.diffDays} days
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                                                <AlertTriangle size={14} /> Panic Score: {item.priorityScore}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                            onClick={handleAutoPlan}
                            disabled={planning}
                        >
                            <Zap size={20} /> {planning ? 'Scheduling...' : 'Solve the Panic: Auto-Plan Study Session'}
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default PanicModal;
