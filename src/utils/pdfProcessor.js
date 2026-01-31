import * as pdfjsLib from 'pdfjs-dist';

// Use a more robust worker loading method for Vite
// This approach uses the bundled worker from the package
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractTextFromPdf = async (file) => {
    try {
        console.log('Antigravity Debug: Starting PDF parsing for:', file.name);
        const arrayBuffer = await file.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false
        });

        const pdf = await loadingTask.promise;
        console.log(`Antigravity Debug: PDF loaded. Pages: ${pdf.numPages}`);

        const pages = []; // Array of { pageNumber, text }

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').trim();

            pages.push({
                pageNumber: i,
                text: pageText
            });
        }

        // Check if at least some pages have text
        const totalText = pages.map(p => p.text).join('');
        if (!totalText.trim()) {
            throw new Error('PDF appears to be empty or contains only images (OCR not supported).');
        }

        console.log('Antigravity Debug: PDF text extraction complete.');
        return {
            numPages: pdf.numPages,
            pages // [{ pageNumber: 1, text: "..." }, ...]
        };
    } catch (error) {
        console.error('Antigravity Debug: PDF Parser Error:', error);
        throw new Error(`PDF Error: ${error.message || 'Unknown parsing error'}`);
    }
};


// Chunk text per page (for retrieval)
// Each page can be split into multiple chunks if too long
export const chunkTextByPage = (pages, maxTokens = 800) => {
    const chunks = [];
    const maxChars = maxTokens * 4; // rough estimate

    pages.forEach(({ pageNumber, text }) => {
        if (text.length <= maxChars) {
            // Page fits in one chunk
            chunks.push({
                pageNumber,
                content: text,
                charStart: 0,
                charEnd: text.length
            });
        } else {
            // Split long page into multiple chunks
            const numChunks = Math.ceil(text.length / maxChars);
            for (let i = 0; i < numChunks; i++) {
                const start = i * maxChars;
                const end = Math.min(start + maxChars, text.length);
                chunks.push({
                    pageNumber,
                    content: text.substring(start, end),
                    charStart: start,
                    charEnd: end
                });
            }
        }
    });

    return chunks;
};

// Legacy function for backward compatibility
export const chunkText = (text, maxTokens = 1000) => {
    const chunkSize = maxTokens * 4;
    const chunks = [];
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
        if (currentChunk.length + para.length > chunkSize) {
            chunks.push(currentChunk);
            currentChunk = para;
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
    }
    if (currentChunk) chunks.push(currentChunk);

    return chunks;
};

