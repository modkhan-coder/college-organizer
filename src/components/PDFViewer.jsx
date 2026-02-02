import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PDFViewer = ({ fileUrl, onJumpToPage }) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const canvasRef = useRef(null);
    const viewerRef = useRef(null);

    // Load PDF
    useEffect(() => {
        if (!fileUrl) return;

        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(fileUrl);

        loadingTask.promise.then(pdf => {
            setPdfDoc(pdf);
            setNumPages(pdf.numPages);
            setLoading(false);
        }).catch(err => {
            console.error('PDF load error:', err);
            setLoading(false);
        });
    }, [fileUrl]);

    // Render current page
    useEffect(() => {
        if (!pdfDoc) return;

        pdfDoc.getPage(currentPage).then(page => {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            const viewport = page.getViewport({ scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            page.render(renderContext);
        });
    }, [pdfDoc, currentPage, scale]);

    // Jump to page API (called by citations)
    useEffect(() => {
        if (onJumpToPage) {
            window.jumpToPDFPage = (pageNum) => {
                setCurrentPage(Math.min(Math.max(1, pageNum), numPages));
                viewerRef.current?.scrollIntoView({ behavior: 'smooth' });
            };
        }
    }, [onJumpToPage, numPages]);

    // Search functionality
    const handleSearch = async () => {
        if (!searchQuery || !pdfDoc) return;

        const query = searchQuery.toLowerCase();

        // Search through all pages
        for (let pageNum = currentPage; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ').toLowerCase();

            if (text.includes(query)) {
                setCurrentPage(pageNum);
                return;
            }
        }

        // If not found from current page onwards, search from beginning
        for (let pageNum = 1; pageNum < currentPage; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ').toLowerCase();

            if (text.includes(query)) {
                setCurrentPage(pageNum);
                return;
            }
        }

        // Not found
        alert('Text not found in PDF');
    };

    const handleSearchKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, numPages));

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px', color: 'var(--text-secondary)' }}>
                Loading PDF...
            </div>
        );
    }

    if (!fileUrl) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px', color: 'var(--text-secondary)' }}>
                Select a PDF to view
            </div>
        );
    }

    return (
        <div ref={viewerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                flexWrap: 'wrap'
            }}>
                {/* Page Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        style={{ padding: '6px 12px' }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', minWidth: '80px', textAlign: 'center' }}>
                        Page {currentPage} / {numPages}
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={handleNextPage}
                        disabled={currentPage === numPages}
                        style={{ padding: '6px 12px' }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Zoom Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleZoomOut}
                        style={{ padding: '6px 12px' }}
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '50px', textAlign: 'center' }}>
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={handleZoomIn}
                        style={{ padding: '6px 12px' }}
                    >
                        <ZoomIn size={18} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '300px' }}>
                    <Search size={16} color="var(--text-secondary)" />
                    <input
                        className="input-field"
                        placeholder="Search in PDF..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyPress={handleSearchKeyPress}
                        style={{ padding: '6px 12px', fontSize: '0.9rem', flex: 1 }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={handleSearch}
                        disabled={!searchQuery}
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                        Find
                    </button>
                </div>
            </div>

            {/* PDF Canvas */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                padding: '20px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                background: '#f5f5f5',
                minHeight: 0 // Important for flex scrolling
            }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        background: 'white',
                        maxWidth: '100%',
                        height: 'auto',
                        display: 'block'
                    }}
                />
            </div>
        </div>
    );
};

export default PDFViewer;
