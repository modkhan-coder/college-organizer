import PDFParser from 'npm:pdf-parse';

const pdfBuffer = await Deno.readFile('test.pdf'); // I need a test PDF
try {
    const data = await PDFParser(pdfBuffer);
    console.log('Text extracted:', data.text.substring(0, 100));
} catch (e) {
    console.error('Error:', e);
}
