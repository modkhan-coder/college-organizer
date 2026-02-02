import { useState } from 'react';
import { FileText, Edit3, Upload, Brain, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SyllabusImportWizard = ({ onClose, onComplete, user }) => {
    const [step, setStep] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfId, setPdfId] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const [editedData, setEditedData] = useState(null);

    // Step 1: Upload PDF
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a PDF file');
            return;
        }

        setPdfFile(file);
        setUploading(true);

        try {
            // Upload to temp storage (we'll process it later)
            const fileName = `temp_syllabus_${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage
                .from('course_materials')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            setPdfId(fileName);
            setStep(2);
            setTimeout(() => handleExtraction(fileName, file), 500);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload PDF');
        } finally {
            setUploading(false);
        }
    };

    // Step 2: AI Extraction
    const handleExtraction = async (fileName, file) => {
        setExtracting(true);

        try {
            // First, create a temporary course to get an ID
            const tempCourse = {
                user_id: user.id,
                code: 'TEMP',
                name: 'Processing...',
                credits: 0
            };

            const { data: course, error: courseError } = await supabase
                .from('courses')
                .insert(tempCourse)
                .select()
                .single();

            if (courseError) throw courseError;

            // Create PDF record
            const { data: pdf, error: pdfError } = await supabase
                .from('pdf_files')
                .insert({
                    user_id: user.id,
                    course_id: course.id,
                    file_name: file.name,
                    file_path: fileName,
                    num_pages: 1,
                    is_syllabus: true,
                    doc_type: 'syllabus'
                })
                .select()
                .single();

            if (pdfError) throw pdfError;

            console.log('PDF record created:', pdf.id);

            // Step 1: Extract text from PDF
            console.log('Extracting text from PDF...');
            const { data: extractTextData, error: extractTextError } = await supabase.functions.invoke('extract-pdf-text', {
                body: {
                    pdf_id: pdf.id,
                    user_id: user.id,
                    course_id: course.id
                }
            });

            if (extractTextError) {
                console.error('PDF text extraction error:', extractTextError);
                throw new Error(`Failed to extract PDF text: ${extractTextError.message}`);
            }

            if (!extractTextData.success) {
                throw new Error(extractTextData.error || 'PDF text extraction failed');
            }

            console.log('PDF text extracted:', extractTextData);

            // Step 2: Call AI extraction
            console.log('Starting AI extraction...');
            const { data, error } = await supabase.functions.invoke('extract-syllabus', {
                body: {
                    pdf_id: pdf.id,
                    course_id: course.id,
                    user_id: user.id
                }
            });

            if (error) throw error;

            if (data.success) {
                console.log('✅ Extraction successful!');
                console.log('Raw data:', data);
                console.log('Extracted data:', data.data);
                setExtractedData(data.data);
                setEditedData(JSON.parse(JSON.stringify(data.data))); // Deep clone
                setStep(3);
            } else {
                throw new Error(data.error || 'Extraction failed');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            alert(`Extraction failed: ${error.message}`);
            setStep(1);
        } finally {
            setExtracting(false);
        }
    };

    // Step 3-5: Review sections
    const handleDataEdit = (section, index, field, value) => {
        const updated = { ...editedData };
        if (index !== null) {
            updated[section][index][field] = value;
        } else {
            updated[section][field] = value;
        }
        setEditedData(updated);
    };

    // Final: Create Course
    const handleCreateCourse = async () => {
        try {
            const courseData = {
                code: editedData.course_info.title.split(' ')[0] || 'COURSE',
                name: editedData.course_info.title,
                credits: 3,
                instructor: editedData.course_info.instructor_name,
                categories: editedData.grading_policy.map(cat => ({
                    id: crypto.randomUUID(),
                    name: cat.category,
                    weight: cat.weight
                }))
            };

            onComplete(courseData, editedData);
        } catch (error) {
            console.error('Create course error:', error);
            alert('Failed to create course');
        }
    };

    return (
        <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
            {/* Step Indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                {[1, 2, 3, 4].map(s => (
                    <div key={s} style={{
                        width: '40px',
                        height: '4px',
                        background: s <= step ? 'var(--primary)' : '#e2e8f0',
                        borderRadius: '2px',
                        transition: 'background 0.3s'
                    }} />
                ))}
            </div>

            {/* Step 1: Upload */}
            {step === 1 && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                    <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                    <h2 style={{ marginBottom: '8px' }}>Upload Your Syllabus</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Upload a PDF of your course syllabus and we'll extract all the important information.
                    </p>

                    <label className="btn btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                        <Upload size={18} /> {uploading ? 'Uploading...' : 'Choose PDF File'}
                        <input
                            type="file"
                            accept=".pdf"
                            hidden
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>
            )}

            {/* Step 2: Extraction */}
            {step === 2 && (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{
                        display: 'inline-block',
                        animation: 'pulse 1.5s ease-in-out infinite'
                    }}>
                        <Brain size={64} style={{ color: 'var(--primary)' }} />
                    </div>
                    <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>Reading Your Syllabus...</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Extracting text from your PDF and analyzing course information...
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '16px' }}>
                        This usually takes 15-30 seconds
                    </p>
                </div>
            )}

            {/* Step 3: Review Course Info */}
            {step === 3 && editedData && (
                <div>
                    <h2 style={{ marginBottom: '16px' }}>Review Course Information</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="form-label">Course Title</label>
                            <input
                                className="input-field"
                                value={editedData?.course_info?.title || ''}
                                onChange={e => handleDataEdit('course_info', null, 'title', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label">Instructor</label>
                            <input
                                className="input-field"
                                value={editedData?.course_info?.instructor_name || ''}
                                onChange={e => handleDataEdit('course_info', null, 'instructor_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label">Email</label>
                            <input
                                className="input-field"
                                type="email"
                                value={editedData?.course_info?.instructor_email || ''}
                                onChange={e => handleDataEdit('course_info', null, 'instructor_email', e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label className="form-label">Meeting Times</label>
                                <input
                                    className="input-field"
                                    value={editedData?.course_info?.meeting_times || ''}
                                    onChange={e => handleDataEdit('course_info', null, 'meeting_times', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label">Location</label>
                                <input
                                    className="input-field"
                                    value={editedData?.course_info?.location || ''}
                                    onChange={e => handleDataEdit('course_info', null, 'location', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={() => setStep(4)}>
                            Next: Grading <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Review Grading */}
            {step === 4 && editedData && (
                <div>
                    <h2 style={{ marginBottom: '16px' }}>Review Grading Policy</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {editedData.grading_policy.map((cat, idx) => (
                            <div key={idx} style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr',
                                gap: '12px',
                                padding: '12px',
                                background: 'var(--bg-surface)',
                                borderRadius: '8px'
                            }}>
                                <input
                                    className="input-field"
                                    placeholder="Category name"
                                    value={cat.category}
                                    onChange={e => handleDataEdit('grading_policy', idx, 'category', e.target.value)}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        className="input-field"
                                        type="number"
                                        placeholder="Weight"
                                        value={cat.weight}
                                        onChange={e => handleDataEdit('grading_policy', idx, 'weight', parseFloat(e.target.value))}
                                    />
                                    <span>%</span>
                                </div>
                            </div>
                        ))}
                        <div style={{
                            padding: '12px',
                            background: '#f0fdf4',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                        }}>
                            Total: {editedData.grading_policy.reduce((sum, c) => sum + c.weight, 0)}%
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'space-between' }}>
                        <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateCourse}>
                                <CheckCircle2 size={16} /> Create Course
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SyllabusImportWizard;
