import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, Layers, FileText } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PDFViewer = ({ fileUrl, onJumpToPage }) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchHighlights, setSearchHighlights] = useState([]);
    const [viewMode, setViewMode] = useState('scroll'); // 'single' | 'scroll'
    const [pageInput, setPageInput] = useState('');
    const [isEditingPage, setIsEditingPage] = useState(false);

    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const pageCanvasRefs = useRef({});
    const renderedPages = useRef(new Set());
    const observerRef = useRef(null);

    // Load PDF
    useEffect(() => {
        if (!fileUrl) return;

        setLoading(true);
        renderedPages.current = new Set();
        const loadingTask = pdfjsLib.getDocument(fileUrl);

        loadingTask.promise.then(pdf => {
            setPdfDoc(pdf);
            setNumPages(pdf.numPages);
            setCurrentPage(1);
            setLoading(false);
        }).catch(err => {
            console.error('PDF load error:', err);
            setLoading(false);
        });
    }, [fileUrl]);

    // Render a single page to a canvas
    const renderPage = useCallback(async (pageNum, canvas) => {
        if (!pdfDoc || !canvas) return;
        if (renderedPages.current.has(pageNum)) return;
        renderedPages.current.add(pageNum);

        try {
            const page = await pdfDoc.getPage(pageNum);
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({ scale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;
        } catch (err) {
            console.error(`Error rendering page ${pageNum}:`, err);
            renderedPages.current.delete(pageNum);
        }
    }, [pdfDoc, scale]);

    // Single page mode: render current page
    useEffect(() => {
        if (viewMode !== 'single' || !pdfDoc) return;
        renderedPages.current = new Set();

        pdfDoc.getPage(currentPage).then(page => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({ scale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            page.render({ canvasContext: context, viewport }).promise.then(() => {
                if (searchHighlights.length > 0) {
                    context.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    searchHighlights.forEach(highlight => {
                        context.fillRect(highlight.x, highlight.y, highlight.width, highlight.height);
                    });
                }
            });
        });
    }, [pdfDoc, currentPage, scale, searchHighlights, viewMode]);

    // Scroll mode: use IntersectionObserver for lazy rendering
    useEffect(() => {
        if (viewMode !== 'scroll' || !pdfDoc) return;

        renderedPages.current = new Set();

        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const pageNum = parseInt(entry.target.dataset.page);
                        const canvas = entry.target.querySelector('canvas');
                        if (canvas && !renderedPages.current.has(pageNum)) {
                            renderPage(pageNum, canvas);
                        }
                    }
                });
            },
            {
                root: scrollContainerRef.current,
                rootMargin: '200px 0px', // Pre-render pages 200px before they become visible
                threshold: 0.01
            }
        );

        observerRef.current = observer;

        // Observe all page wrappers
        setTimeout(() => {
            const pageWrappers = scrollContainerRef.current?.querySelectorAll('[data-page]');
            pageWrappers?.forEach(wrapper => observer.observe(wrapper));
        }, 100);

        return () => observer.disconnect();
    }, [pdfDoc, viewMode, scale, renderPage]);

    // Track current page during scroll
    useEffect(() => {
        if (viewMode !== 'scroll' || !scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        let ticking = false;

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;

            requestAnimationFrame(() => {
                const containerRect = container.getBoundingClientRect();
                const centerY = containerRect.top + containerRect.height / 3;

                const pageWrappers = container.querySelectorAll('[data-page]');
                for (const wrapper of pageWrappers) {
                    const rect = wrapper.getBoundingClientRect();
                    if (rect.top <= centerY && rect.bottom >= centerY) {
                        const pageNum = parseInt(wrapper.dataset.page);
                        if (pageNum !== currentPage) {
                            setCurrentPage(pageNum);
                        }
                        break;
                    }
                }
                ticking = false;
            });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [viewMode, currentPage]);

    // Jump to page API (called by citations)
    useEffect(() => {
        if (onJumpToPage) {
            window.jumpToPDFPage = (pageNum) => {
                const targetPage = Math.min(Math.max(1, pageNum), numPages);
                setCurrentPage(targetPage);

                if (viewMode === 'scroll') {
                    setTimeout(() => {
                        const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${targetPage}"]`);
                        if (pageEl) {
                            pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 100);
                }

                viewerRef.current?.scrollIntoView({ behavior: 'smooth' });
            };
        }
    }, [onJumpToPage, numPages, viewMode]);

    // Handle page input submit
    const handlePageInputSubmit = () => {
        const pageNum = parseInt(pageInput);
        if (pageNum >= 1 && pageNum <= numPages) {
            setCurrentPage(pageNum);
            if (viewMode === 'scroll') {
                setTimeout(() => {
                    const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${pageNum}"]`);
                    if (pageEl) {
                        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 50);
            }
        }
        setIsEditingPage(false);
    };

    // Search functionality
    const handleSearch = async () => {
        if (!searchQuery || !pdfDoc) return;
        const query = searchQuery.toLowerCase();

        for (let pageNum = currentPage; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale });
            const text = textContent.items.map(item => item.str).join(' ').toLowerCase();

            if (text.includes(query)) {
                const highlights = [];
                textContent.items.forEach(item => {
                    if (item.str.toLowerCase().includes(query)) {
                        const transform = item.transform;
                        const x = transform[4];
                        const y = transform[5];
                        const height = Math.abs(transform[3]) || 12;
                        const width = item.width;
                        const [canvasX, canvasY] = viewport.convertToViewportPoint(x, y);
                        highlights.push({ x: canvasX, y: canvasY - height, width: width * scale, height });
                    }
                });
                setSearchHighlights(highlights);
                setCurrentPage(pageNum);

                if (viewMode === 'scroll') {
                    const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${pageNum}"]`);
                    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }
        }

        for (let pageNum = 1; pageNum < currentPage; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale });
            const text = textContent.items.map(item => item.str).join(' ').toLowerCase();

            if (text.includes(query)) {
                const highlights = [];
                textContent.items.forEach(item => {
                    if (item.str.toLowerCase().includes(query)) {
                        const transform = item.transform;
                        const x = transform[4];
                        const y = transform[5];
                        const height = Math.abs(transform[3]) || 12;
                        const width = item.width;
                        const [canvasX, canvasY] = viewport.convertToViewportPoint(x, y);
                        highlights.push({ x: canvasX, y: canvasY - height, width: width * scale, height });
                    }
                });
                setSearchHighlights(highlights);
                setCurrentPage(pageNum);

                if (viewMode === 'scroll') {
                    const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${pageNum}"]`);
                    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }
        }

        setSearchHighlights([]);
        alert('Text not found in PDF');
    };

    const handleSearchKeyPress = (e) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleZoomIn = () => {
        renderedPages.current = new Set();
        setScale(prev => Math.min(prev + 0.25, 3));
    };
    const handleZoomOut = () => {
        renderedPages.current = new Set();
        setScale(prev => Math.max(prev - 0.25, 0.5));
    };
    const handlePrevPage = () => {
        setSearchHighlights([]);
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };
    const handleNextPage = () => {
        setSearchHighlights([]);
        setCurrentPage(prev => Math.min(prev + 1, numPages));
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                Loading PDF...
            </div>
        );
    }

    if (!fileUrl) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
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
                gap: '8px',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                flexWrap: 'wrap',
                flexShrink: 0
            }}>
                {/* Page Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {viewMode === 'single' && (
                        <button
                            className="btn btn-secondary"
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            style={{ padding: '6px 10px', minHeight: '36px' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                    )}

                    {/* Tappable page number / input */}
                    {isEditingPage ? (
                        <input
                            type="number"
                            className="input-field"
                            value={pageInput}
                            onChange={e => setPageInput(e.target.value)}
                            onBlur={handlePageInputSubmit}
                            onKeyDown={e => { if (e.key === 'Enter') handlePageInputSubmit(); }}
                            autoFocus
                            min={1}
                            max={numPages}
                            style={{
                                width: '50px',
                                padding: '4px 6px',
                                fontSize: '0.85rem',
                                textAlign: 'center'
                            }}
                        />
                    ) : (
                        <button
                            onClick={() => { setPageInput(String(currentPage)); setIsEditingPage(true); }}
                            style={{
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: 'var(--text-main)',
                                minHeight: '36px',
                                WebkitTapHighlightColor: 'transparent'
                            }}
                            title="Tap to jump to a page"
                        >
                            {currentPage} / {numPages}
                        </button>
                    )}

                    {viewMode === 'single' && (
                        <button
                            className="btn btn-secondary"
                            onClick={handleNextPage}
                            disabled={currentPage === numPages}
                            style={{ padding: '6px 10px', minHeight: '36px' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}
                </div>

                {/* View Mode Toggle */}
                <button
                    onClick={() => {
                        renderedPages.current = new Set();
                        setViewMode(prev => prev === 'single' ? 'scroll' : 'single');
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        background: viewMode === 'scroll' ? 'var(--primary-light)' : 'var(--bg-app)',
                        border: `1px solid ${viewMode === 'scroll' ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: viewMode === 'scroll' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        minHeight: '36px',
                        WebkitTapHighlightColor: 'transparent'
                    }}
                    title={viewMode === 'scroll' ? 'Switch to single page' : 'Switch to scroll view'}
                >
                    {viewMode === 'scroll' ? <Layers size={14} /> : <FileText size={14} />}
                    {viewMode === 'scroll' ? 'Scroll' : 'Page'}
                </button>

                {/* Zoom Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                    <button className="btn btn-secondary" onClick={handleZoomOut} style={{ padding: '6px 10px', minHeight: '36px' }}>
                        <ZoomOut size={16} />
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'center' }}>
                        {Math.round(scale * 100)}%
                    </span>
                    <button className="btn btn-secondary" onClick={handleZoomIn} style={{ padding: '6px 10px', minHeight: '36px' }}>
                        <ZoomIn size={16} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '150px', maxWidth: '280px' }}>
                    <Search size={14} color="var(--text-secondary)" />
                    <input
                        className="input-field"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyPress={handleSearchKeyPress}
                        style={{ padding: '4px 8px', fontSize: '0.85rem', flex: 1 }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={handleSearch}
                        disabled={!searchQuery}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '36px' }}
                    >
                        Find
                    </button>
                </div>
            </div>

            {/* PDF Content */}
            {viewMode === 'single' ? (
                /* Single Page Mode */
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    background: '#f5f5f5',
                    minHeight: 0
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
            ) : (
                /* Continuous Scroll Mode */
                <div
                    ref={scrollContainerRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'auto',
                        padding: '12px',
                        background: '#e8e8e8',
                        minHeight: 0,
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                        <div
                            key={pageNum}
                            data-page={pageNum}
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginBottom: '8px',
                                position: 'relative'
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <canvas
                                    ref={el => { if (el) pageCanvasRefs.current[pageNum] = el; }}
                                    style={{
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                        background: 'white',
                                        display: 'block',
                                        maxWidth: '100%',
                                        height: 'auto'
                                    }}
                                />
                                {/* Page number label */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '4px',
                                    right: '8px',
                                    background: 'rgba(0,0,0,0.5)',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem'
                                }}>
                                    {pageNum}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PDFViewer;
