import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import {
    ArrowLeft, Plus, Upload, FileText, Zap, Link as LinkIcon,
    Pin, ExternalLink, Copy, Trash2, Edit2, Check, Video, GripVertical
} from 'lucide-react';
import Modal from '../components/Modal';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CourseHub = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user, courses, addNotification } = useApp();

    const course = courses.find(c => c.id === courseId);

    // State for resources
    const [resources, setResources] = useState([]);
    const [checklist, setChecklist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Modal states
    const [showAddLinkModal, setShowAddLinkModal] = useState(false);
    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [showEditNoteModal, setShowEditNoteModal] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [showOfficeHoursModal, setShowOfficeHoursModal] = useState(false);

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, link, file, note, office_hours, zoom



    // Fetch resources and checklist
    useEffect(() => {
        if (courseId && user) {
            fetchHubData();
        }
    }, [courseId, user]);

    const fetchHubData = async () => {
        setLoading(true);
        try {
            // Fetch resources
            const { data: resourcesData, error: resourcesError } = await supabase
                .from('course_resources')
                .select('*')
                .eq('course_id', courseId)
                .eq('user_id', user.id)
                .order('pinned', { ascending: false })
                .order('sort_order', { ascending: true });

            if (resourcesError) throw resourcesError;
            setResources(resourcesData || []);

            // Fetch checklist
            const { data: checklistData, error: checklistError } = await supabase
                .from('course_checklist_items')
                .select('*')
                .eq('course_id', courseId)
                .eq('user_id', user.id)
                .order('sort_order', { ascending: true });

            if (checklistError) throw checklistError;
            setChecklist(checklistData || []);
        } catch (error) {
            console.error('Hub data fetch error:', error);
            if (error.code === '42P01') {
                addNotification('Hub database tables not found. Please run the migrations in Supabase Dashboard.', 'error');
            } else {
                addNotification(`Error loading hub: ${error.message}`, 'error');
            }
        }
        setLoading(false);
    };

    // File Upload Handler
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        addNotification('Uploading file...', 'info');

        try {
            // Upload to Supabase Storage
            const filePath = `${user.id}/${courseId}/${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('course_materials')
                .upload(filePath, file);

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('course_materials')
                .getPublicUrl(filePath);

            // Create resource entry
            const { error: insertError } = await supabase
                .from('course_resources')
                .insert({
                    course_id: courseId,
                    user_id: user.id,
                    type: 'file',
                    title: file.name,
                    file_id: filePath,
                    url: urlData.publicUrl,
                    tags: []
                });

            if (insertError) {
                throw new Error(`Database error: ${insertError.message}`);
            }

            addNotification('File uploaded successfully!', 'success');
            fetchHubData();
        } catch (error) {
            console.error('File upload error:', error);
            addNotification(`Upload failed: ${error.message}`, 'error');
        } finally {
            setUploading(false);
            // Reset file input
            e.target.value = '';
        }
    };




    // Filter and search functions
    const filteredResources = () => {
        let filtered = resources;

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(r => r.type === filterType);
        }

        // Search filter (fuzzy)
        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(r => {
                // Search in title
                const matchTitle = r.title?.toLowerCase().includes(lowerQuery);
                // Search in tags
                const matchTags = r.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
                // Search in content for notes
                const matchContent = r.content?.text?.toLowerCase().includes(lowerQuery);
                // Search in URL
                const matchUrl = r.url?.toLowerCase().includes(lowerQuery);

                return matchTitle || matchTags || matchContent || matchUrl;
            });
        }

        return filtered;
    };

    const filteredResourcesList = filteredResources();
    const resultsCount = filteredResourcesList.length;
    const isFiltering = searchQuery.trim() || filterType !== 'all';

    // Resource type grouping
    const groupedResources = {
        links: filteredResourcesList.filter(r => r.type === 'link'),
        files: filteredResourcesList.filter(r => r.type === 'file'),
        notes: filteredResourcesList.filter(r => r.type === 'note'),
        textbook: filteredResourcesList.filter(r => r.type === 'textbook'),
        zoom: filteredResourcesList.filter(r => r.type === 'zoom'),
        office_hours: filteredResourcesList.filter(r => r.type === 'office_hours')
    };

    const pinnedResources = filteredResourcesList.filter(r => r.pinned);

    if (!course) {
        return <div>Course not found</div>;
    }

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '48px' }}>Loading hub...</div>;
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => navigate('/courses')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title" style={{ margin: 0 }}>{course.code} Hub</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>{course.name}</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px' }}>⚡ Quick Actions</h3>

                {/* Search and Filter */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                            className="input-field"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 Search resources..."
                            style={{ flex: 1, margin: 0 }}
                        />
                        <select
                            className="input-field"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{ margin: 0, minWidth: '120px' }}
                        >
                            <option value="all">All Types</option>
                            <option value="link">Links</option>
                            <option value="file">Files</option>
                            <option value="note">Notes</option>
                            <option value="office_hours">Office Hours</option>
                            <option value="zoom">Zoom</option>
                        </select>
                    </div>

                    {/* Filter indicators */}
                    {isFiltering && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                                {resultsCount} result{resultsCount !== 1 ? 's' : ''} found
                            </span>
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setFilterType('all');
                                }}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddLinkModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <LinkIcon size={16} /> Add Link
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => document.getElementById('file-upload-hub').click()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        disabled={uploading}
                    >
                        <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload File'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowAddNoteModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <FileText size={16} /> Add Note
                    </button>
                    <button
                        className="btn"
                        onClick={() => navigate(`/focus`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    >
                        <Zap size={16} /> Start Focus
                    </button>
                </div>
                <input
                    id="file-upload-hub"
                    type="file"
                    accept="*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
            </div>

            {/* Pinned Resources */}
            {pinnedResources.length > 0 && (
                <div className="card" style={{ padding: '16px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))' }}>
                    <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Pin size={18} /> Pinned Resources
                    </h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {pinnedResources.map(resource => (
                            <ResourceCard
                                key={resource.id}
                                resource={resource}
                                onUpdate={fetchHubData}
                                onEdit={resource.type === 'note' ? (note) => {
                                    setEditingNote(note);
                                    setShowEditNoteModal(true);
                                } : undefined}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Main 2-Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Study Checklist */}
                    <StudyChecklistWidget
                        checklist={checklist}
                        courseId={courseId}
                        onUpdate={fetchHubData}
                    />


                    {/* Office Hours & Zoom */}
                    <OfficeHoursWidget
                        resources={[...groupedResources.office_hours, ...groupedResources.zoom]}
                        courseId={courseId}
                        onUpdate={fetchHubData}
                        onAddOfficeHours={() => setShowOfficeHoursModal(true)}
                    />
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Links */}
                    {groupedResources.links.length > 0 && (
                        <ResourceSection title="Links" icon={LinkIcon} resources={groupedResources.links} onUpdate={fetchHubData} />
                    )}

                    {/* Files */}
                    {groupedResources.files.length > 0 && (
                        <ResourceSection title="Files" icon={Upload} resources={groupedResources.files} onUpdate={fetchHubData} />
                    )}

                    {/* Notes */}
                    {groupedResources.notes.length > 0 && (
                        <ResourceSection
                            title="Notes"
                            icon={FileText}
                            resources={groupedResources.notes}
                            onUpdate={fetchHubData}
                            onEdit={(note) => {
                                setEditingNote(note);
                                setShowEditNoteModal(true);
                            }}
                        />
                    )}

                    {/* Textbook */}
                    {groupedResources.textbook.length > 0 && (
                        <ResourceSection title="Textbook" icon={FileText} resources={groupedResources.textbook} onUpdate={fetchHubData} />
                    )}
                </div>
            </div>

            {/* Modals */}
            <AddLinkModal
                isOpen={showAddLinkModal}
                onClose={() => setShowAddLinkModal(false)}
                courseId={courseId}
                onSuccess={fetchHubData}
            />
            <AddNoteModal
                isOpen={showAddNoteModal}
                onClose={() => setShowAddNoteModal(false)}
                courseId={courseId}
                onSuccess={fetchHubData}
            />
            <AddOfficeHoursModal
                isOpen={showOfficeHoursModal}
                onClose={() => setShowOfficeHoursModal(false)}
                courseId={courseId}
                onSuccess={fetchHubData}
            />
            <EditNoteModal
                isOpen={showEditNoteModal}
                onClose={() => {
                    setShowEditNoteModal(false);
                    setEditingNote(null);
                }}
                courseId={courseId}
                note={editingNote}
                onSuccess={fetchHubData}
            />
        </div>
    );
};

// Resource Card Component
const ResourceCard = ({ resource, onUpdate, onEdit }) => {
    const { user, addNotification } = useApp();
    const [copying, setCopying] = useState(false);

    const handleCopy = async (text) => {
        setCopying(true);
        await navigator.clipboard.writeText(text);
        addNotification('Copied to clipboard!', 'success');
        setTimeout(() => setCopying(false), 1000);
    };

    const handleTogglePin = async () => {
        const { error } = await supabase
            .from('course_resources')
            .update({ pinned: !resource.pinned })
            .eq('id', resource.id)
            .eq('user_id', user.id);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            onUpdate();
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this resource?')) return;

        // If it's a file, also delete from storage
        if (resource.type === 'file' && resource.file_id) {
            const { error: storageError } = await supabase.storage
                .from('course_materials')
                .remove([resource.file_id]);

            if (storageError) {
                console.error('Storage deletion error:', storageError);
            }
        }

        const { error } = await supabase
            .from('course_resources')
            .delete()
            .eq('id', resource.id)
            .eq('user_id', user.id);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification('Resource deleted', 'success');
            onUpdate();
        }
    };

    // Get file extension for icon
    const getFileExtension = (fileName) => {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
    };

    const isFile = resource.type === 'file';
    const fileExt = isFile ? getFileExtension(resource.title) : null;

    return (
        <div style={{
            padding: '12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* File Icon */}
                {isFile && (
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '6px',
                        background: 'var(--primary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        flexShrink: 0
                    }}>
                        {fileExt}
                    </div>
                )}

                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {resource.title}
                    </div>
                    {/* Note preview */}
                    {resource.type === 'note' && resource.content?.text && (
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '6px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                        }}>
                            {resource.content.text}
                        </div>
                    )}
                    {resource.tags && resource.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {resource.tags.map((tag, i) => (
                                <span key={i} style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 6px',
                                    background: 'var(--bg-app)',
                                    borderRadius: '4px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {resource.url && (
                    <>
                        <button
                            onClick={() => handleCopy(resource.url)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            title="Copy link"
                        >
                            {copying ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                        </button>
                        <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '4px' }}
                            title={isFile ? 'Download file' : 'Open link'}
                        >
                            <ExternalLink size={16} />
                        </a>
                    </>
                )}
                {/* Edit button for notes */}
                {resource.type === 'note' && onEdit && (
                    <button
                        onClick={() => onEdit(resource)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        title="Edit note"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                <button
                    onClick={handleTogglePin}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                    title={resource.pinned ? 'Unpin' : 'Pin'}
                >
                    <Pin size={16} fill={resource.pinned ? 'var(--primary)' : 'none'} color={resource.pinned ? 'var(--primary)' : 'currentColor'} />
                </button>
                <button
                    onClick={handleDelete}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--danger)' }}
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

// Resource Section Component
const ResourceSection = ({ title, icon: Icon, resources, onUpdate, onEdit }) => {
    return (
        <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon size={18} /> {title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {resources.map(resource => (
                    <ResourceCard key={resource.id} resource={resource} onUpdate={onUpdate} onEdit={onEdit} />
                ))}
            </div>
        </div>
    );
};

// Sortable Checklist Item Component
const SortableChecklistItem = ({ item, onToggle, onDelete, isCompleted }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : isCompleted ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px',
        background: isCompleted ? 'var(--bg-app)' : 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        marginBottom: '8px',
        cursor: isDragging ? 'grabbing' : 'default',
    };

    return (
        <div ref={setNodeRef} style={style}>
            {/* Drag Handle (only for incomplete tasks) */}
            {!isCompleted && (
                <button
                    {...attributes}
                    {...listeners}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'grab',
                        padding: '4px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                    title="Drag to reorder"
                >
                    <GripVertical size={16} />
                </button>
            )}

            <input
                type="checkbox"
                checked={isCompleted}
                onChange={() => onToggle(item)}
                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
            />

            <div style={{
                flex: 1,
                fontSize: '0.9rem',
                textDecoration: isCompleted ? 'line-through' : 'none',
                color: isCompleted ? 'var(--text-secondary)' : 'inherit'
            }}>
                {item.text}
            </div>

            <button
                onClick={() => onDelete(item.id)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: 'var(--text-secondary)'
                }}
                title="Delete task"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

// Study Checklist Widget with Drag and Drop
const StudyChecklistWidget = ({ checklist, courseId, onUpdate }) => {
    const { user, addNotification } = useApp();
    const [newItemText, setNewItemText] = useState('');
    const [adding, setAdding] = useState(false);

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItemText.trim()) return;

        setAdding(true);
        const { error } = await supabase
            .from('course_checklist_items')
            .insert([{
                course_id: courseId,
                user_id: user.id,
                text: newItemText,
                source: 'manual',
                sort_order: checklist.length
            }]);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification('Task added!', 'success');
            setNewItemText('');
            onUpdate();
        }
        setAdding(false);
    };

    const handleToggleComplete = async (item) => {
        const { error } = await supabase
            .from('course_checklist_items')
            .update({
                completed_at: item.completed_at ? null : new Date().toISOString()
            })
            .eq('id', item.id)
            .eq('user_id', user.id);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            onUpdate();
        }
    };

    const handleDelete = async (itemId) => {
        if (!confirm('Delete this task?')) return;

        const { error } = await supabase
            .from('course_checklist_items')
            .delete()
            .eq('id', itemId)
            .eq('user_id', user.id);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification('Task deleted', 'success');
            onUpdate();
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = incompleteTasks.findIndex(item => item.id === active.id);
        const newIndex = incompleteTasks.findIndex(item => item.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Reorder array
        const reorderedItems = arrayMove(incompleteTasks, oldIndex, newIndex);

        // Update sort_order for all affected items
        const updates = reorderedItems.map((item, index) => ({
            id: item.id,
            sort_order: index
        }));

        // Batch update in database
        for (const update of updates) {
            await supabase
                .from('course_checklist_items')
                .update({ sort_order: update.sort_order })
                .eq('id', update.id)
                .eq('user_id', user.id);
        }

        onUpdate();
    };

    // AI Suggestions Handler
    const handleGenerateAISuggestions = async () => {
        setGeneratingAI(true);
        try {
            const { data, error } = await supabase.functions.invoke('suggest-study-checklist', {
                body: { courseId }
            });

            if (error) throw error;

            setAISuggestions(data.suggestions || []);
            setSelectedSuggestions(new Set()); // Reset selections
            setShowAISuggestionsModal(true);
            addNotification(`Generated ${data.suggestions.length} AI suggestions!`, 'success');
        } catch (error) {
            console.error('AI generation error:', error);
            if (error.message?.includes('Rate limit')) {
                addNotification('Rate limit: Max 5 AI requests per day', 'error');
            } else {
                addNotification(`AI generation failed: ${error.message || 'Unknown error'}`, 'error');
            }
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleAcceptSuggestions = async () => {
        const acceptedSuggestions = aiSuggestions.filter((_, idx) => selectedSuggestions.has(idx));

        if (acceptedSuggestions.length === 0) {
            addNotification('No suggestions selected', 'info');
            return;
        }

        try {
            const now = new Date().toISOString();
            const items = acceptedSuggestions.map(sug => ({
                course_id: courseId,
                user_id: user.id,
                text: sug.text,
                source: 'ai',
                ai_reasoning: sug.reasoning,
                estimated_time_minutes: sug.estimated_time_minutes,
                generated_at: now,
                related_assignment_id: sug.related_assignment_id || null,
                related_resource_id: sug.related_resource_id || null,
            }));

            const { error } = await supabase
                .from('course_checklist_items')
                .insert(items);

            if (error) throw error;

            addNotification(`Added ${acceptedSuggestions.length} AI suggestions to checklist`, 'success');
            setShowAISuggestionsModal(false);
            onUpdate();
        } catch (error) {
            addNotification(`Error adding suggestions: ${error.message}`, 'error');
        }
    };


    const incompleteTasks = checklist.filter(item => !item.completed_at);
    const completedTasks = checklist.filter(item => item.completed_at);

    return (
        <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px' }}>📋 What to Study Next</h3>

            {/* Add New Task Form */}
            <form onSubmit={handleAddItem} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        className="input-field"
                        value={newItemText}
                        onChange={e => setNewItemText(e.target.value)}
                        placeholder="Add a study task..."
                        style={{ flex: 1, margin: 0 }}
                        disabled={adding}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                        disabled={adding || !newItemText.trim()}
                    >
                        {adding ? '...' : '+ Add'}
                    </button>
                </div>
            </form>


            {/* Incomplete Tasks with Drag and Drop */}
            {incompleteTasks.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={incompleteTasks.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div style={{ marginBottom: completedTasks.length > 0 ? '16px' : 0 }}>
                            {incompleteTasks.map(item => (
                                <SortableChecklistItem
                                    key={item.id}
                                    item={item}
                                    onToggle={handleToggleComplete}
                                    onDelete={handleDelete}
                                    isCompleted={false}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Completed Tasks (no drag and drop) */}
            {completedTasks.length > 0 && (
                <div>
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                    }}>
                        Completed ({completedTasks.length})
                    </div>
                    {completedTasks.map(item => (
                        <div
                            key={item.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px',
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                opacity: 0.7
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleToggleComplete(item)}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                            />
                            <div style={{
                                flex: 1,
                                fontSize: '0.9rem',
                                textDecoration: 'line-through',
                                color: 'var(--text-secondary)'
                            }}>
                                {item.text}
                            </div>
                            <button
                                onClick={() => handleDelete(item.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: 'var(--text-secondary)'
                                }}
                                title="Delete task"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {checklist.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                    No study tasks yet. Add one above!
                </p>
            )}
        </div>
    );
};

// Office Hours Widget
const OfficeHoursWidget = ({ resources, courseId, onUpdate, onAddOfficeHours }) => {
    const { addNotification } = useApp();
    const [copying, setCopying] = useState(false);

    const officeHours = resources.filter(r => r.type === 'office_hours');
    const zoomLinks = resources.filter(r => r.type === 'zoom');

    const handleCopyZoom = async (url) => {
        setCopying(true);
        await navigator.clipboard.writeText(url);
        addNotification('Zoom link copied!', 'success');
        setTimeout(() => setCopying(false), 1000);
    };

    return (
        <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🕐 Office Hours & Zoom
            </h3>

            {/* Office Hours Section */}
            {officeHours.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                        Office Hours
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {officeHours.map(oh => (
                            <div key={oh.id} style={{
                                padding: '10px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px'
                            }}>
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{oh.title}</div>
                                {oh.content && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        📍 {oh.content}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Zoom Links Section */}
            {zoomLinks.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                        Zoom Meetings
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {zoomLinks.map(zoom => (
                            <div key={zoom.id} style={{
                                padding: '10px',
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))',
                                border: '1px solid var(--primary)',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                        🎥 {zoom.title}
                                    </div>
                                    {zoom.content && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {zoom.content}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleCopyZoom(zoom.url)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                        title="Copy Zoom link"
                                    >
                                        {copying ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                                    </button>
                                    <a
                                        href={zoom.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary"
                                        style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                    >
                                        Join Meeting
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {officeHours.length === 0 && zoomLinks.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 12px' }}>
                    No office hours or Zoom links added yet.
                </p>
            )}

            {/* Add Button */}
            <button
                onClick={onAddOfficeHours}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.85rem' }}
            >
                + Add Office Hours / Zoom
            </button>
        </div>
    );
};

// AI Suggestions Modal

// Add Link Modal (Placeholder)

const AddLinkModal = ({ isOpen, onClose, courseId, onSuccess }) => {
    const { user, addNotification } = useApp();
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [tags, setTags] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        const { error } = await supabase
            .from('course_resources')
            .insert([{
                course_id: courseId,
                user_id: user.id,
                type: 'link',
                title,
                url,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            }]);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification('Link added!', 'success');
            setTitle('');
            setUrl('');
            setTags('');
            onSuccess();
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Link">
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label className="input-label">Title</label>
                    <input
                        className="input-field"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        placeholder="e.g. Canvas Course Page"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">URL</label>
                    <input
                        className="input-field"
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        required
                        placeholder="https://..."
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Tags (comma-separated)</label>
                    <input
                        className="input-field"
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        placeholder="e.g. Canvas, Homework"
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Link</button>
                </div>
            </form>
        </Modal>
    );
};

// Add Note Modal
const AddNoteModal = ({ isOpen, onClose, courseId, onSuccess }) => {
    const { user, addNotification } = useApp();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        const { error } = await supabase
            .from('course_resources')
            .insert([{
                course_id: courseId,
                user_id: user.id,
                type: 'note',
                title: title,
                content: { text: content }, // Store as JSON
                tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            }]);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification('Note added!', 'success');
            setTitle('');
            setContent('');
            setTags('');
            onSuccess();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Note">
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label className="input-label">Title</label>
                    <input
                        className="input-field"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        placeholder="e.g., Chapter 5 Summary"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Content</label>
                    <textarea
                        className="input-field"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        required
                        rows={8}
                        placeholder="Type your notes here..."
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Tags (comma-separated)</label>
                    <input
                        className="input-field"
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        placeholder="e.g., Important, Exam"
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        Add Note
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// Edit Note Modal
const EditNoteModal = ({ isOpen, onClose, courseId, note, onSuccess }) => {
    const { user, addNotification } = useApp();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');

    // Pre-populate form when note changes
    useEffect(() => {
        if (note) {
            setTitle(note.title || '');
            setContent(note.content?.text || '');
            setTags(note.tags?.join(', ') || '');
        }
    }, [note]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const { error } = await supabase
            .from('course_resources')
            .update({
                title: title,
                content: { text: content },
                tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            })
            .eq('id', note.id)
            .eq('user_id', user.id);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification('Note updated!', 'success');
            onSuccess();
            onClose();
        }
    };

    if (!isOpen || !note) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Note">
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label className="input-label">Title</label>
                    <input
                        className="input-field"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        placeholder="e.g., Chapter 5 Summary"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Content</label>
                    <textarea
                        className="input-field"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        required
                        rows={8}
                        placeholder="Type your notes here..."
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Tags (comma-separated)</label>
                    <input
                        className="input-field"
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        placeholder="e.g., Important, Exam"
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        Save Changes
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// Add Office Hours Modal
const AddOfficeHoursModal = ({ isOpen, onClose, courseId, onSuccess }) => {
    const { user, addNotification } = useApp();
    const [type, setType] = useState('office_hours'); // office_hours or zoom
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [url, setUrl] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        const resourceData = {
            course_id: courseId,
            user_id: user.id,
            type: type,
            title: title,
            content: type === 'office_hours' ? location : null,
            url: type === 'zoom' ? url : null,
            tags: []
        };

        const { error } = await supabase
            .from('course_resources')
            .insert([resourceData]);

        if (error) {
            addNotification(`Error: ${error.message}`, 'error');
        } else {
            addNotification(`${type === 'zoom' ? 'Zoom link' : 'Office hours'} added!`, 'success');
            setTitle('');
            setLocation('');
            setUrl('');
            setType('office_hours');
            onSuccess();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Office Hours / Zoom">
            <form onSubmit={handleSubmit}>
                {/* Type Selection */}
                <div className="input-group">
                    <label className="input-label">Type</label>
                    <select
                        className="input-field"
                        value={type}
                        onChange={e => setType(e.target.value)}
                    >
                        <option value="office_hours">Office Hours</option>
                        <option value="zoom">Zoom Meeting</option>
                    </select>
                </div>

                {/* Title */}
                <div className="input-group">
                    <label className="input-label">
                        {type === 'zoom' ? 'Meeting Name' : 'Schedule'}
                    </label>
                    <input
                        className="input-field"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        placeholder={type === 'zoom' ? 'e.g., Weekly Lecture' : 'e.g., Monday 2-4 PM'}
                    />
                </div>

                {/* Location (for office hours) */}
                {type === 'office_hours' && (
                    <div className="input-group">
                        <label className="input-label">Location</label>
                        <input
                            className="input-field"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="e.g., Room 301, Building A"
                        />
                    </div>
                )}

                {/* URL (for zoom) */}
                {type === 'zoom' && (
                    <div className="input-group">
                        <label className="input-label">Zoom Link</label>
                        <input
                            className="input-field"
                            type="url"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            required
                            placeholder="https://zoom.us/j/..."
                        />
                    </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        Add {type === 'zoom' ? 'Zoom Link' : 'Office Hours'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CourseHub;
