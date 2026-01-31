import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPdf, chunkTextByPage } from '../utils/pdfProcessor';
import { searchContextWithPages, generateGuidedNotes, generateQuizWithCitations, chatWithPDFCitations } from '../lib/ai';
import PDFViewer from '../components/PDFViewer';
import PDFCitation from '../components/PDFCitation';
import {
    ArrowLeft, Upload, FileText, Trash2, BookOpen,
    Brain, MessageSquare, Save, Star, RefreshCw, Send
} from 'lucide-react';

// Math & Markdown Rendering
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const StudyStudio = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user, courses, addNotification } = useApp();
    const isPremium = user?.plan === 'premium';

    // State
    const [course, setCourse] = useState(null);
    const [pdfFiles, setPdfFiles] = useState([]);
    const [selectedPDF, setSelectedPDF] = useState(null);
    const [currentFileUrl, setCurrentFileUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('chat');

    // Scope & Page Range
    const [scope, setScope] = useState('this');
    const [pageStart, setPageStart] = useState('');
    const [pageEnd, setPageEnd] = useState('');

    // Notes State
    const [noteFormat, setNoteFormat] = useState('outline');
    const [generatedNotes, setGeneratedNotes] = useState(null);
    const [notesTitle, setNotesTitle] = useState('');

    // Quiz State
    const [quizSettings, setQuizSettings] = useState({ numQuestions: 10, difficulty: 'medium' });
    const [generatedQuiz, setGeneratedQuiz] = useState(null);
    const [quizAnswers, setQuizAnswers] = useState({});

    // Chat State
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');

    // Loading
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        const found = courses.find(c => c.id === courseId);
        if (found) {
            setCourse(found);
            fetchPDFs();
        }
    }, [courseId, courses]);

    const fetchPDFs = async () => {
        const { data, error } = await supabase
            .from('pdf_files')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false });

        if (!error && data) {
            setPdfFiles(data);
            if (data.length > 0 && !selectedPDF) {
                handleSelectPDF(data[0]);
            }
        }
    };

    const handleSelectPDF = async (pdf) => {
        setSelectedPDF(pdf);

        const { data } = await supabase.storage
            .from('course_materials')
            .createSignedUrl(pdf.file_path, 3600);

        if (data?.signedUrl) {
            setCurrentFileUrl(data.signedUrl);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        addNotification('Uploading and processing PDF...', 'info');

        try {
            const filePath = `${user.id}/${courseId}/${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('course_materials')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { numPages, pages } = await extractTextFromPdf(file);

            const { data: pdfRecord, error: pdfError } = await supabase
                .from('pdf_files')
                .insert({
                    user_id: user.id,
                    course_id: courseId,
                    file_name: file.name,
                    file_path: filePath,
                    num_pages: numPages
                })
                .select()
                .single();

            if (pdfError) throw pdfError;

            const chunks = chunkTextByPage(pages);
            const docRecords = chunks.map(chunk => ({
                user_id: user.id,
                course_id: courseId,
                file_name: file.name,
                pdf_id: pdfRecord.id,
                page_number: chunk.pageNumber,
                content: chunk.content,
                char_start: chunk.charStart,
                char_end: chunk.charEnd,
                metadata: { page: chunk.pageNumber }
            }));

            const { error: insertError } = await supabase
                .from('course_docs')
                .insert(docRecords);

            if (insertError) throw insertError;

            addNotification(`${file.name} processed successfully!`, 'success');
            fetchPDFs();
        } catch (error) {
            console.error('Upload error:', error);
            addNotification(`Upload failed: ${error.message}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (pdf) => {
        if (!confirm(`Delete "${pdf.file_name}"? This will remove all generated content.`)) return;

        try {
            await supabase.storage.from('course_materials').remove([pdf.file_path]);
            const { error } = await supabase.from('pdf_files').delete().eq('id', pdf.id);
            if (error) throw error;

            addNotification('PDF deleted', 'success');
            fetchPDFs();
            if (selectedPDF?.id === pdf.id) {
                setSelectedPDF(null);
                setCurrentFileUrl(null);
            }
        } catch (error) {
            addNotification(`Delete failed: ${error.message}`, 'error');
        }
    };

    const handleCitationClick = (pdfName, page) => {
        const pdf = pdfFiles.find(p => p.file_name === pdfName);
        if (pdf) {
            handleSelectPDF(pdf);
            setTimeout(() => {
                if (window.jumpToPDFPage) {
                    window.jumpToPDFPage(page);
                }
            }, 500);
        }
    };

    // Get PDF IDs based on scope
    const getScopedPDFIds = () => {
        if (scope === 'this' && selectedPDF) return [selectedPDF.id];
        if (scope === 'all') return pdfFiles.map(p => p.id);
        // For 'multiple', Phase 3 will have a selector modal
        return selectedPDF ? [selectedPDF.id] : null;
    };

    // Generate Notes
    const handleGenerateNotes = async () => {
        setGenerating(true);
        try {
            const pdfIds = getScopedPDFIds();
            const { chunks } = await searchContextWithPages(courseId, pdfIds, pageStart, pageEnd);

            if (chunks.length === 0) {
                throw new Error('No content found in selected range. Adjust scope/pages.');
            }

            const notes = await generateGuidedNotes(chunks, course.name, noteFormat);
            setGeneratedNotes(notes);
            setNotesTitle(notes.title || 'Untitled Notes');
            addNotification('Notes generated!', 'success');
        } catch (error) {
            console.error('Notes error:', error);
            addNotification(`Error: ${error.message}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    // Save Notes
    const handleSaveNotes = async () => {
        if (!generatedNotes) return;

        try {
            await supabase.from('saved_content').insert({
                user_id: user.id,
                course_id: courseId,
                content_type: 'note',
                title: notesTitle,
                content: generatedNotes,
                pdf_ids: getScopedPDFIds(),
                page_range: pageStart && pageEnd ? [parseInt(pageStart), parseInt(pageEnd)] : null
            });

            addNotification('Notes saved!', 'success');
        } catch (error) {
            addNotification(`Save failed: ${error.message}`, 'error');
        }
    };

    // Generate Quiz
    const handleGenerateQuiz = async () => {
        setGenerating(true);
        try {
            const pdfIds = getScopedPDFIds();
            const { chunks } = await searchContextWithPages(courseId, pdfIds, pageStart, pageEnd);

            if (chunks.length === 0) {
                throw new Error('No content found in selected range.');
            }

            const quiz = await generateQuizWithCitations(chunks, course.name, quizSettings);
            setGeneratedQuiz(quiz);
            setQuizAnswers({});
            addNotification('Quiz generated!', 'success');
        } catch (error) {
            console.error('Quiz error:', error);
            addNotification(`Error: ${error.message}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    // Chat
    const handleSendChat = async (e) => {
        e?.preventDefault();
        if (!chatInput.trim()) return;

        const userMessage = { role: 'user', content: chatInput };
        setChatHistory(prev => [...prev, userMessage]);
        setChatInput('');
        setGenerating(true);

        try {
            const pdfIds = getScopedPDFIds();
            const { chunks } = await searchContextWithPages(courseId, pdfIds, pageStart, pageEnd);

            const response = await chatWithPDFCitations([...chatHistory, userMessage], chunks);
            setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (error) {
            addNotification(`Chat error: ${error.message}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    // Parse and render citations in text
    const renderTextWithCitations = (text) => {
        const citationRegex = /\[([^\]]+?\.pdf) p\.(\d+)\]/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = citationRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }
            parts.push(
                <PDFCitation
                    key={match.index}
                    pdfName={match[1]}
                    page={parseInt(match[2])}
                    onClick={handleCitationClick}
                />
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts;
    };

    if (!course) return <div style={{ padding: '24px' }}>Loading...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => navigate(`/courses/${courseId}`)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
                >
                    <ArrowLeft size={18} /> Back to Course
                </button>
                <h1 className="page-title">PDF Study Studio</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{course.name}</p>
            </div>

            {/* Main Layout: 3 Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 400px', flex: 1, overflow: 'hidden' }}>

                {/* Left Rail: PDF List */}
                <div style={{ borderRight: '1px solid var(--border)', padding: '16px', overflowY: 'auto', background: 'var(--bg-surface)' }}>
                    <label className="btn btn-primary" style={{ width: '100%', marginBottom: '16px', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>
                        <Upload size={16} /> {uploading ? 'Uploading...' : 'Add PDF'}
                        <input type="file" accept=".pdf" hidden onChange={handleUpload} disabled={uploading} />
                    </label>

                    {pdfFiles.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '32px' }}>
                            No PDFs yet. Upload course materials to get started.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pdfFiles.map(pdf => (
                                <div
                                    key={pdf.id}
                                    onClick={() => handleSelectPDF(pdf)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        background: selectedPDF?.id === pdf.id ? 'var(--primary)' : 'var(--bg-app)',
                                        color: selectedPDF?.id === pdf.id ? 'white' : 'var(--text-main)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <FileText size={16} />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {pdf.file_name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{pdf.num_pages} pages</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stop Propagation(); handleDelete(pdf); }}
                                        style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: '4px', opacity: 0.7 }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Center: PDF Viewer */}
                <div style={{ position: 'relative' }}>
                    {/* Top Bar: Scope & Page Range */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Scope:</label>
                            <select
                                className="input-field"
                                value={scope}
                                onChange={e => setScope(e.target.value)}
                                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                            >
                                <option value="this">This PDF</option>
                                <option value="multiple">Multiple PDFs</option>
                                <option value="all">All Course PDFs</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pages:</label>
                            <input
                                className="input-field"
                                type="number"
                                placeholder="Start"
                                value={pageStart}
                                onChange={e => setPageStart(e.target.value)}
                                style={{ width: '60px', padding: '4px 8px', fontSize: '0.85rem' }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>–</span>
                            <input
                                className="input-field"
                                type="number"
                                placeholder="End"
                                value={pageEnd}
                                onChange={e => setPageEnd(e.target.value)}
                                style={{ width: '60px', padding: '4px 8px', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    <PDFViewer fileUrl={currentFileUrl} onJumpToPage={handleCitationClick} />
                </div>

                {/* Right Panel: Tabs */}
                <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Tab Headers */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                        <TabButton id="chat" label="Chat" icon={<MessageSquare size={16} />} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <TabButton id="notes" label="Notes" icon={<BookOpen size={16} />} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <TabButton id="quiz" label="Quiz" icon={<Brain size={16} />} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <TabButton id="saved" label="Saved" icon={<Star size={16} />} activeTab={activeTab} setActiveTab={setActiveTab} />
                    </div>

                    {/* Tab Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

                        {/* CHAT TAB */}
                        {activeTab === 'chat' && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <h3 style={{ marginBottom: '12px' }}>Chat with PDFs</h3>

                                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', padding: '12px', background: 'var(--bg-app)', borderRadius: '8px', minHeight: '300px' }}>
                                    {chatHistory.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '32px' }}>Ask questions about your PDFs. Answers include citations!</p>}
                                    {chatHistory.map((msg, idx) => (
                                        <div key={idx} style={{
                                            marginBottom: '12px',
                                            padding: '10px',
                                            background: msg.role === 'user' ? 'var(--primary)' : 'white',
                                            color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}>
                                            <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>
                                            <div style={{ marginTop: '4px', lineHeight: '1.6' }}>
                                                {msg.role === 'assistant' ? renderTextWithCitations(msg.content) : msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {generating && <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>AI is thinking...</p>}
                                </div>

                                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        className="input-field"
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        disabled={generating}
                                        style={{ flex: 1, padding: '8px' }}
                                    />
                                    <button type="submit" className="btn btn-primary" disabled={generating || !chatInput.trim()}>
                                        <Send size={16} />
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* NOTES TAB */}
                        {activeTab === 'notes' && (
                            <div>
                                <h3 style={{ marginBottom: '12px' }}>Guided Notes</h3>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Format:</label>
                                    <select className="input-field" value={noteFormat} onChange={e => setNoteFormat(e.target.value)} style={{ marginTop: '4px', padding: '6px' }}>
                                        <option value="outline">Outline</option>
                                        <option value="cornell">Cornell Notes</option>
                                        <option value="fill-in">Fill-in-the-Blank</option>
                                        <option value="eli5">ELI5 Summary</option>
                                    </select>
                                </div>

                                <button className="btn btn-primary" onClick={handleGenerateNotes} disabled={generating} style={{ width: '100%', marginBottom: '16px' }}>
                                    {generating ? <><RefreshCw className="spin" size={16} /> Generating...</> : <>< Brain size={16} /> Generate Notes</>}
                                </button>

                                {generatedNotes && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <input
                                                className="input-field"
                                                value={notesTitle}
                                                onChange={e => setNotesTitle(e.target.value)}
                                                placeholder="Notes title"
                                                style={{ flex: 1, padding: '6px' }}
                                            />
                                            <button className="btn btn-secondary" onClick={handleSaveNotes}>
                                                <Save size={16} />
                                            </button>
                                        </div>

                                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            {generatedNotes.sections?.map((section, idx) => (
                                                <div key={idx} style={{ marginBottom: '20px' }}>
                                                    <h4 style={{ marginBottom: '8px', color: 'var(--primary)' }}>{section.heading}</h4>
                                                    <div style={{ lineHeight: '1.7' }}>
                                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                            {section.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                    {section.citations && section.citations.length > 0 && (
                                                        <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                                                            {section.citations.map((cite, cIdx) => (
                                                                <PDFCitation key={cIdx} pdfName={cite.pdf_name} page={cite.page} onClick={handleCitationClick} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!generatedNotes && !generating && (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '32px' }}>
                                        Select scope/pages and click Generate to create notes with citations.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* QUIZ TAB */}
                        {activeTab === 'quiz' && (
                            <div>
                                <h3 style={{ marginBottom: '12px' }}>Practice Quiz</h3>

                                <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Questions:</label>
                                        <input
                                            className="input-field"
                                            type="number"
                                            value={quizSettings.numQuestions}
                                            onChange={e => setQuizSettings({ ...quizSettings, numQuestions: parseInt(e.target.value) })}
                                            style={{ marginTop: '4px', padding: '6px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Difficulty:</label>
                                        <select
                                            className="input-field"
                                            value={quizSettings.difficulty}
                                            onChange={e => setQuizSettings({ ...quizSettings, difficulty: e.target.value })}
                                            style={{ marginTop: '4px', padding: '6px' }}
                                        >
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                </div>

                                <button className="btn btn-primary" onClick={handleGenerateQuiz} disabled={generating} style={{ width: '100%', marginBottom: '16px' }}>
                                    {generating ? <><RefreshCw className="spin" size={16} /> Generating...</> : <><Brain size={16} /> Generate Quiz</>}
                                </button>

                                {generatedQuiz && (
                                    <div>
                                        {generatedQuiz.questions?.map((q, idx) => (
                                            <div key={idx} style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                        {`${idx + 1}. ${q.question}`}
                                                    </ReactMarkdown>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                                                    {q.options.map((opt, oIdx) => (
                                                        <button
                                                            key={oIdx}
                                                            onClick={() => setQuizAnswers({ ...quizAnswers, [idx]: oIdx })}
                                                            style={{
                                                                padding: '10px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--border)',
                                                                background: quizAnswers[idx] === oIdx ? (oIdx === q.correctAnswer ? '#dcfce7' : '#fee2e2') : 'white',
                                                                textAlign: 'left',
                                                                cursor: 'pointer',
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>

                                                {quizAnswers[idx] !== undefined && (
                                                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        <strong>Explanation:</strong> {q.explanation}
                                                    </div>
                                                )}

                                                {q.citation && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <PDFCitation pdfName={q.citation.pdf_name} page={q.citation.page} onClick={handleCitationClick} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!generatedQuiz && !generating && (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '32px' }}>
                                        Configure settings and click Generate to create a quiz with cited questions.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* SAVED TAB */}
                        {activeTab === 'saved' && (
                            <div>
                                <h3 style={{ marginBottom: '12px' }}>Saved Content</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Your saved notes, quizzes, and flashcards will appear here. (Phase 3)
                                </p>
                            </div>
                        )}
                    </div>
                </div>

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
                padding: '12px 8px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                transition: 'all 0.2s'
            }}
        >
            {icon}
            {label}
        </button>
    );
};

export default StudyStudio;
