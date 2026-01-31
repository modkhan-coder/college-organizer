import { FileText } from 'lucide-react';

const PDFCitation = ({ pdfName, page, onClick, showSnippet }) => {
    return (
        <span
            className="pdf-citation"
            onClick={() => onClick && onClick(pdfName, page)}
            title={showSnippet || `Jump to ${pdfName}, page ${page}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '0.85rem',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s',
                marginLeft: '4px',
                marginRight: '4px',
                fontWeight: '500'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
        >
            <FileText size={12} />
            [{pdfName} p.{page}]
        </span>
    );
};

export default PDFCitation;
