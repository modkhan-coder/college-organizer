import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateCourseGrade, getLetterGrade } from '../utils/gradeCalculator';
import { Calculator, Share2, Lock } from 'lucide-react';
import ShareableCard from '../components/ShareableCard';
import Modal from '../components/Modal';

const GPA = () => {
    const { courses, assignments, user } = useApp();
    const isPro = user?.plan === 'pro' || user?.plan === 'premium';
    const [targetGrade, setTargetGrade] = useState(90);
    const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // 1. Calculate GPA
    const courseGrades = courses.map(course => {
        const grade = calculateCourseGrade(course, assignments);
        return { ...course, grade };
    });

    const gpaPoints = {
        'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D': 1.0, 'F': 0.0
    };

    let totalPoints = 0;
    let totalCredits = 0;

    courseGrades.forEach(c => {
        if (c.grade.letter !== 'N/A') {
            const points = gpaPoints[c.grade.letter] || 0;
            totalPoints += points * c.credits;
            totalCredits += c.credits;
        }
    });

    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

    // 2. Final Grade Calculator Logic
    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    let finalPrediction = null;

    if (selectedCourse) {
        // Find "Final" category or largest empty category
        // Simple logic: Assume user picks a category that is NOT yet fully graded? 
        // Prompt says: "Student picks which category is the final (defaults to 'Final Exam' if present)"
        // Let's simplified: Detect "Final" category.

        const finalCat = selectedCourse.categories.find(c => c.name.toLowerCase().includes('final')) ||
            selectedCourse.categories[selectedCourse.categories.length - 1]; // fallback to last

        if (finalCat) {
            // Get current NORMALIZED grade logic (ignoring the Final category for "Current Performance" baseline)
            // We want to know: "Based on how I'm doing on everything else, what do I need on the final?"

            // 1. Calculate grade for everything EXCEPT the final
            const nonFinalAssignments = assignments.filter(a => a.courseId === selectedCourse.id && a.categoryId !== finalCat.id);
            // Create a temporary course object excluding the final category to reuse calculator logic?
            // Or easier: manually sum weights like existing logic but Normalized.

            // Let's use the Logic: Target = (CurrentPercent * (TotalWeight - FinalWeight) + FinalPercent * FinalWeight) / TotalWeight
            // This assumes "CurrentPercent" is your average on the non-final portion.

            // First, get CurrentPercent for non-final items.
            const { percent: currentPercent } = calculateCourseGrade(
                { ...selectedCourse, categories: selectedCourse.categories.filter(c => c.id !== finalCat.id) },
                assignments
            );

            const totalWeight = selectedCourse.categories.reduce((acc, c) => acc + c.weight, 0); // e.g. 100
            const finalWeight = finalCat.weight; // e.g. 20
            const otherWeight = totalWeight - finalWeight; // e.g. 80

            // If user has NO grades in other categories, we can't predict (or assume 100? or 0?)
            // Let's assume 100 if data is missing, to show "Best Case"? Or return null?
            // Better: Defaults to 100 (optimistic) if no data, so it shows what you need if you ace everything else.
            const baseline = currentPercent !== null ? currentPercent : 100;

            // Formula: Target% = ( (Baseline * OtherWeight) + (Required * FinalWeight) ) / TotalWeight
            // Required = ( Target% * TotalWeight - Baseline * OtherWeight ) / FinalWeight

            const targetPoints = targetGrade * totalWeight;
            const currentPoints = baseline * otherWeight;

            const reqPercent = (targetPoints - currentPoints) / finalWeight;

            finalPrediction = {
                category: finalCat.name,
                percent: reqPercent.toFixed(1),
                weight: finalWeight,
                baselineUsed: baseline
            };
        }
    }

    return (
        <div>
            <h1 className="page-title">GPA & Grades</h1>

            {/* GPA Card */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '32px', marginBottom: '32px'
            }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{gpa}</h2>
                    <p style={{ opacity: 0.9 }}>Term GPA</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px' }}>
                    <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="btn"
                        style={{ background: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                    >
                        <Share2 size={16} /> Share Card
                    </button>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{courses.length} Courses</div>
                        <div style={{ fontSize: '1rem' }}>{totalCredits} Credits</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(300px, 1fr)', gap: '24px' }}>

                {/* Course List */}
                <div className="card">
                    <h3 style={{ marginBottom: '16px' }}>Course Breakdown</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {courseGrades.map(c => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontWeight: '600' }}>{c.code}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{c.name}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                        {c.grade.percent ? `${c.grade.percent.toFixed(1)}%` : '--'}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                                        {c.grade.letter}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Final Calculator */}
                <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                    {!isPro && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backdropFilter: 'blur(5px)', background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock color="var(--primary)" size={32} />
                            <h3 style={{ margin: '12px 0 8px' }}>Grade Forecaster Locked</h3>
                            <button className="btn btn-primary" onClick={() => window.location.href = '/pricing'}>Upgrade to Pro</button>
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Calculator size={20} color="var(--primary)" />
                        <h3>Check Final Grade</h3>
                    </div>

                    {courses.length > 0 ? (
                        <>
                            <div className="input-group">
                                <label className="input-label">Select Course</label>
                                <select className="input-field" value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.code}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Target Grade (%)</label>
                                <input
                                    className="input-field"
                                    type="number"
                                    value={targetGrade}
                                    onChange={e => setTargetGrade(e.target.value)}
                                />
                            </div>

                            {finalPrediction && (
                                <div style={{
                                    background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)',
                                    textAlign: 'center', marginTop: '16px'
                                }}>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        To get a <b>{targetGrade}%</b> in {courses.find(c => c.id === selectedCourseId)?.code}, you need:
                                    </p>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: Number(finalPrediction.percent) > 100 ? 'var(--danger)' : 'var(--success)' }}>
                                        {finalPrediction.percent}%
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        on your <b>{finalPrediction.category}</b> ({finalPrediction.weight}%)
                                    </p>
                                    {Number(finalPrediction.percent) > 100 && (
                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--danger)', fontStyle: 'italic' }}>
                                            Impossible target! (Max is normally 100%). Try lowering your goal or hoping for extra credit!
                                        </div>
                                    )}
                                    <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                        *Assuming you maintain your current {finalPrediction.baselineUsed.toFixed(1)}% average on other work.
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)' }}>Add courses to calculate.</p>
                    )}
                </div>
            </div>
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share Your GPA Card">
                <ShareableCard
                    type="gpa"
                    data={{ gpa, courses: courses.length }}
                    user={user}
                />
            </Modal>
        </div>
    );
};

export default GPA;
