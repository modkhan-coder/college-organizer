import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Upload, FileText, Brain, MessageSquare, HelpCircle, Trash2, RefreshCw, Mic, Volume2, Square, TrendingUp, Calculator, Lock, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractTextFromPdf, chunkText } from '../utils/pdfProcessor';
import { generateStudyGuide, generateQuiz, chatWithDocuments, searchContext } from '../lib/ai';

// Math & Markdown Rendering
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const CourseDetails = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { courses, assignments, user, addNotification } = useApp();
    const isPro = user?.plan === 'pro' || user?.plan === 'premium';
    const isPremium = user?.plan === 'premium';
    const [activeTab, setActiveTab] = useState('overview');
    const [course, setCourse] = useState(null);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

    // AI States
    // Simulation State
    const [simulationMode, setSimulationMode] = useState(false);
    const [simulatedScores, setSimulatedScores] = useState({}); // { assignmentId: score }
    const [targetGrade, setTargetGrade] = useState(90);

    const [generating, setGenerating] = useState(false);
    const [studyGuide, setStudyGuide] = useState('');
    const [quiz, setQuiz] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [speakingIdx, setSpeakingIdx] = useState(null);
    const [selectedFile, setSelectedFile] = useState('all');

    useEffect(() => {
        const found = courses.find(c => c.id === courseId);
        if (found) {
            setCourse(found);
            fetchFiles();
            fetchAIContent();
        }
    }, [courseId, courses]);

    const fetchAIContent = async () => {
        const { data, error } = await supabase
            .from('course_ai_content')
            .select('*')
            .eq('course_id', courseId)
            .single();

        if (data && !error) {
            setStudyGuide(data.study_guide || '');
            setQuiz(data.quiz_data || null);
            setChatHistory(data.chat_history || []);
        }
    };

    const fetchFiles = async () => {
        const { data } = await supabase.storage.from('course_materials').list(`${user.id}/${courseId}`);
        setFiles(data || []);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        addNotification('Uploading and processing...', 'info');

        try {
            // 1. Upload File
            const filePath = `${user.id}/${courseId}/${file.name}`;
            console.log('Antigravity Debug: Attempting upload to bucket course_materials at path:', filePath);
            const { error: uploadError } = await supabase.storage.from('course_materials').upload(filePath, file);

            if (uploadError) {
                console.error('Antigravity Debug: Upload Error:', uploadError);
                throw new Error(`Upload to Storage failed: ${uploadError.message}`);
            }

            console.log('Antigravity Debug: Upload successful, extracting text via PDF.js...');

            // 2. Extract Text (if PDF)
            if (file.type === 'application/pdf') {
                const text = await extractTextFromPdf(file);
                console.log('Antigravity Debug: Text extraction successful (Length:', text.length, '). Chunking...');
                const chunks = chunkText(text);

                // 3. Save Chunks to Supabase DB (course_docs)
                const docRecords = chunks.map((chunk, idx) => ({
                    user_id: user.id,
                    course_id: courseId,
                    file_name: file.name,
                    content: chunk,
                    metadata: { page: idx }
                }));

                console.log('Antigravity Debug: Inserting chunks into course_docs table:', docRecords.length);
                const { error: insertError } = await supabase.from('course_docs').insert(docRecords);
                if (insertError) {
                    console.error('Antigravity Debug: Insert Error:', insertError);
                    throw new Error(`Saving to Database failed: ${insertError.message}. Did you run the SQL script?`);
                }
            }

            addNotification('File processed successfully!', 'success');
            fetchFiles();
        } catch (error) {
            console.error('Antigravity Debug: Final Catch:', error);
            alert(`Oops! ${error.message}`);
            addNotification(`Process failed: ${error.message}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateGuide = async () => {
        setGenerating(true);
        try {
            const context = await searchContext(courseId, "Course overview and key concepts", selectedFile);
            const guide = await generateStudyGuide(context, course.name);
            setStudyGuide(guide);

            // Persist to DB
            const { error: dbError } = await supabase.from('course_ai_content').upsert({
                course_id: courseId,
                study_guide: guide,
                updated_at: new Date()
            }, { onConflict: 'course_id' });

            if (dbError) console.error('Persist Error:', dbError);
        } catch (error) {
            console.error('Guide Gen catch:', error);
            alert(`Guide Error: ${error.message}`);
            addNotification('Error generating guide', 'error');
        }
        setGenerating(false);
    };

    const handleGenerateQuiz = async () => {
        setGenerating(true);
        try {
            const context = await searchContext(courseId, "Key concepts for quiz", selectedFile);
            const quizData = await generateQuiz(context, course.name);
            setQuiz(quizData);

            // Persist to DB
            const { error: dbError } = await supabase.from('course_ai_content').upsert({
                course_id: courseId,
                quiz_data: quizData,
                updated_at: new Date()
            }, { onConflict: 'course_id' });

            if (dbError) console.error('Persist Error:', dbError);
        } catch (error) {
            console.error('Quiz Gen catch:', error);
            alert(`Quiz Error: ${error.message}`);
            addNotification('Error generating quiz', 'error');
        }
        setGenerating(false);
    };

    const handleChat = async (e) => {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        // Stop listening if active
        if (isListening) stopListening();

        const updatedHistory = [...chatHistory, { role: 'user', content: chatInput }];
        setChatHistory(updatedHistory);
        setChatInput('');
        setGenerating(true);

        try {
            const context = await searchContext(courseId, chatInput, selectedFile);
            const response = await chatWithDocuments(updatedHistory, context);
            const finalHistory = [...updatedHistory, { role: 'assistant', content: response }];
            setChatHistory(finalHistory);

            // Persist to DB
            const { error: dbError } = await supabase.from('course_ai_content').upsert({
                course_id: courseId,
                chat_history: finalHistory,
                updated_at: new Date()
            }, { onConflict: 'course_id' });

            if (dbError) console.error('Persist Error:', dbError);
        } catch (error) {
            addNotification('Chat error', 'error');
        }
        setGenerating(false);
    };

    // Voice Input (STT)
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addNotification('Voice recognition not supported in this browser', 'error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setChatInput(transcript);
        };

        recognition.start();
    };

    const stopListening = () => {
        setIsListening(false);
    };

    // Voice Output (TTS)
    const handleSpeak = (text, index) => {
        if (speakingIdx === index) {
            window.speechSynthesis.cancel();
            setSpeakingIdx(null);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setSpeakingIdx(null);
        setSpeakingIdx(index);
        window.speechSynthesis.speak(utterance);
    };

    const handleDeleteFile = async (fileName) => {
        if (!confirm(`Are you sure you want to delete "${fileName}"? This will also remove its context from the AI.`)) return;

        try {
            // 1. Delete from Storage
            const filePath = `${user.id}/${courseId}/${fileName}`;
            const { error: storageError } = await supabase.storage.from('course_materials').remove([filePath]);
            if (storageError) throw storageError;

            // 2. Delete from Database
            const { error: dbError } = await supabase.from('course_docs').delete().eq('course_id', courseId).eq('file_name', fileName);
            if (dbError) throw dbError;

            addNotification('File deleted successfully', 'success');
            fetchFiles();
        } catch (error) {
            console.error('Delete error:', error);
            addNotification(`Delete failed: ${error.message}`, 'error');
        }
    };

    const calculateProjectedGrade = () => {
        const courseAssignments = assignments.filter(a => a.courseId === courseId);
        if (courseAssignments.length === 0) return { current: 100, projected: 100 };

        let totalPoints = 0;
        let earnedPoints = 0;
        let projTotal = 0;
        let projEarned = 0;

        courseAssignments.forEach(a => {
            const max = a.pointsPossible || 100;

            // Current Grade (only graded items)
            if (a.pointsEarned !== null && a.pointsEarned !== undefined) {
                totalPoints += max;
                earnedPoints += a.pointsEarned;

                projTotal += max;
                projEarned += a.pointsEarned;
            } else if (simulationMode) {
                // Projected Grade (include simulated)
                const sim = simulatedScores[a.id];
                if (sim !== undefined && sim !== '') {
                    projTotal += max;
                    projEarned += Number(sim);
                }
            }
        });

        const currentGrade = totalPoints === 0 ? 100 : (earnedPoints / totalPoints) * 100;
        const projectedGrade = projTotal === 0 ? 100 : (projEarned / projTotal) * 100;

        return {
            current: Math.round(currentGrade * 10) / 10,
            projected: Math.round(projectedGrade * 10) / 10
        };
    };

    const grades = calculateProjectedGrade();

    if (!course) return <div style={{ padding: '24px' }}>Loading...</div>;

    return (
        <div style={{ paddingBottom: '100px' }}>
            <div style={{ marginBottom: '24px' }}>
                <button
                    onClick={() => navigate('/courses')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}
                >
                    <ArrowLeft size={18} /> Back to Courses
                </button>
                <h1 className="page-title" style={{ borderLeft: `6px solid ${course.color}`, paddingLeft: '16px' }}>
                    {course.name} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '0.6em' }}>({course.code})</span>
                </h1>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
                <TabButton id="overview" label="Overview" icon={<FileText size={18} />} activeTab={activeTab} setActiveTab={setActiveTab} />
                <button
                    onClick={() => navigate(`/courses/${courseId}/hub`)}
                    style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: '2px solid transparent',
                        color: 'var(--text-secondary)',
                        fontWeight: 'normal',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                >
                    <LinkIcon size={18} /> Hub
                </button>
                <TabButton id="materials" label="Materials" icon={<Upload size={18} />} activeTab={activeTab} setActiveTab={setActiveTab} />
                <button
                    onClick={() => navigate(isPremium ? `/courses/${courseId}/studio` : '/pricing')}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: isPremium ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'var(--bg-app)',
                        color: isPremium ? 'white' : 'var(--text-secondary)',
                        border: isPremium ? 'none' : '1px solid var(--border)',

                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        borderRadius: '4px 4px 0 0',
                        position: 'relative'
                    }}
                >
                    <Brain size={18} /> PDF Studio ✨
                    {!isPremium && (
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                        }}>
                            PREMIUM
                        </span>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="card" style={{ minHeight: '400px' }}>
                {activeTab === 'overview' && (
                    <div>
                        <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            {Array.isArray(course.gradingScale) ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                    {course.gradingScale.map((s, idx) => (
                                        <div key={idx} style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>{s.label}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.min}%</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span style={{ color: 'var(--text-secondary)' }}>{course.gradingScale || 'Standard Scale (A: 90, B: 80...)'}</span>
                            )}
                        </div>
                        <h3 style={{ marginTop: '24px' }}>Categories</h3>
                        <ul style={{ paddingLeft: '20px' }}>
                            {course.categories?.map(c => (
                                <li key={c.id}>{c.name} ({c.weight}%)</li>
                            ))}
                        </ul>

                        {/* Grade Predictor Section */}
                        <div className="card" style={{ marginTop: '24px', padding: '24px', border: simulationMode ? '2px solid var(--primary)' : '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                            {!isPro && (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backdropFilter: 'blur(5px)', background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <Lock color="var(--primary)" size={32} />
                                    <h3 style={{ margin: '12px 0 8px' }}>Grade Predictor Locked</h3>
                                    <button className="btn btn-primary" onClick={() => window.location.href = '/pricing'}>Upgrade to Pro</button>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '50%', background: simulationMode ? 'var(--primary)' : 'var(--bg-app)', color: simulationMode ? 'white' : 'var(--text-secondary)' }}>
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>Grade Predictor</h3>
                                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            {simulationMode ? 'Simulation Active' : 'Enable to forecast your final grade'}
                                        </p>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={simulationMode} onChange={e => setSimulationMode(e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            {simulationMode && (
                                <div className="fade-in">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px', background: 'var(--bg-app)', padding: '16px', borderRadius: '8px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Current Grade</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{grades.current}%</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>Projected Grade</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{grades.projected}%</div>
                                        </div>
                                    </div>

                                    <h4 style={{ marginBottom: '12px' }}>Upcoming Assignments</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {assignments.filter(a => a.courseId === courseId && !a.pointsEarned).map(a => (
                                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                                <div>
                                                    <div style={{ fontWeight: '600' }}>{a.title}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max: {a.pointsPossible || 100}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="number"
                                                        placeholder="-"
                                                        className="input-field"
                                                        style={{ width: '80px', textAlign: 'center' }}
                                                        value={simulatedScores[a.id] || ''}
                                                        onChange={e => setSimulatedScores({ ...simulatedScores, [a.id]: e.target.value })}
                                                    />
                                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>/ {a.pointsPossible || 100}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {assignments.filter(a => a.courseId === courseId && !a.pointsEarned).length === 0 && (
                                            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No upcoming assignments to simulate.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <style>{`
                            .switch { position: relative; display: inline-block; width: 50px; height: 26px; }
                            .switch input { opacity: 0; width: 0; height: 0; }
                            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
                            .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                            input:checked + .slider { background-color: var(--primary); }
                            input:checked + .slider:before { transform: translateX(24px); }
                        `}</style>
                    </div>
                )}

                {activeTab === 'materials' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3>Course Materials</h3>
                            <label className="btn btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                                <Upload size={18} /> {uploading ? 'Processing...' : 'Upload PDF'}
                                <input type="file" accept=".pdf" hidden onChange={handleFileUpload} disabled={uploading} />
                            </label>
                        </div>
                        {uploading && <div style={{ color: 'var(--primary)', marginBottom: '16px' }}>Reading PDF and learning contents... Please wait.</div>}

                        {files.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px' }}>
                                No materials uploaded yet. Upload syllabus or notes (PDF) to enable AI features.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {files.map(file => (
                                    <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-app)', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <FileText size={20} color="var(--primary)" />
                                            <span>{file.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteFile(file.name)}
                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                            title="Delete File"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}






            </div>
        </div>
    );
};

const TabButton = ({ id, label, icon, activeTab, setActiveTab }) => {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                flex: 1,
                minWidth: '120px',
                padding: '16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
            }}
        >
            {icon} {label}
        </button>
    );
}

export default CourseDetails;
