import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPdf, chunkTextByPage } from '../utils/pdfProcessor';
import PDFViewer from '../components/PDFViewer';
import PDFCitation from '../components/PDFCitation';
import {
    ArrowLeft, Upload, FileText, Trash2, BookOpen,
    Brain, MessageSquare, Save, Star
} from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState('chat'); // chat | notes | quiz | saved

    // Scope & Page Range
    const [scope, setScope] = useState('this'); // 'this' | 'multiple' | 'all'
    const [pageStart, setPageStart] = useState('');
    const [pageEnd, setPageEnd] = useState('');

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

        // Get signed URL from storage
        const { data } = await supabase.storage
            .from('course_materials')
            .createSignedUrl(pdf.file_path, 3600); // 1 hour expiry

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
            // 1. Upload to storage
            const filePath = `${user.id}/${courseId}/${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('course_materials')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Extract text per-page
            const { numPages, pages } = await extractTextFromPdf(file);

            // 3. Create pdf_files record
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

            // 4. Create chunks with page metadata
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
            // Delete from storage
            await supabase.storage.from('course_materials').remove([pdf.file_path]);

            // Database cascade will handle pdf_files → course_docs deletion
            const { error } = await supabase
                .from('pdf_files')
                .delete()
                .eq('id', pdf.id);

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
        // Find PDF and load it
        const pdf = pdfFiles.find(p => p.file_name === pdfName);
        if (pdf) {
            handleSelectPDF(pdf);
            // Wait for PDF to load, then jump
            setTimeout(() => {
                if (window.jumpToPDFPage) {
                    window.jumpToPDFPage(page);
                }
            }, 500);
        }
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
                                        onClick={(e) => { e.stopPropagation(); handleDelete(pdf); }}
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
                    <div className="card" style={{ flex: 1, margin: '16px', overflowY: 'auto', borderRadius: '12px' }}>
                        {activeTab === 'chat' && (
                            <div style={{ padding: '16px' }}>
                                <h3 style={{ marginBottom: '12px' }}>Chat with PDFs</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Ask questions and get answers with citations. (Coming in Phase 2)
                                </p>
                            </div>
                        )}
                        {activeTab === 'notes' && (
                            <div style={{ padding: '16px' }}>
                                <h3 style={{ marginBottom: '12px' }}>Guided Notes</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Generate study notes with citations. (Coming in Phase 2)
                                </p>
                            </div>
                        )}
                        {activeTab === 'quiz' && (
                            <div style={{ padding: '16px' }}>
                                <h3 style={{ marginBottom: '12px' }}>Practice Quiz</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Generate quizzes from selected pages. (Coming in Phase 2)
                                </p>
                            </div>
                        )}
                        {activeTab === 'saved' && (
                            <div style={{ padding: '16px' }}>
                                <h3 style={{ marginBottom: '12px' }}>Saved Content</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Your saved notes, quizzes, and flashcards. (Coming in Phase 2)
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
