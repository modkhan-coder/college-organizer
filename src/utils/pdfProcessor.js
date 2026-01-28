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

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        if (!fullText.trim()) {
            throw new Error('PDF appears to be empty or contains only images (OCR not supported in MVP).');
        }

        console.log('Antigravity Debug: PDF text extraction complete.');
        return fullText;
    } catch (error) {
        console.error('Antigravity Debug: PDF Parser Error:', error);
        // Throw the original error message so the UI alert is more helpful
        throw new Error(`PDF Error: ${error.message || 'Unknown parsing error'}`);
    }
};

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
