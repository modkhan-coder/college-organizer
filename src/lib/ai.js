import { supabase } from '../lib/supabase';

// Helper to call proxy
const callAI = async (messages, response_format = null, model = 'gpt-4o') => {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { messages, response_format, model }
    });

    if (error) throw new Error(error.message);
    return data; // Returns full OpenAI response object
};

// 1. Generate Embeddings (Still client side? No, embeddings proxy needed too? Or skip for now?)
// Wait, generateEmbedding calls openai.embeddings.create.
// I need an embedding endpoint too? 
// Or I can just remove embeddings if we rely on full text context?
// searchContext uses 'course_docs'. The embeddings are generated on upload? Note: context search uses simple text search in original code step 1370 line 32. It does NOT use embeddings!
// Line 11: generateEmbedding is EXPORTED. Is it USED?
// I should check if generateEmbedding is used. 
// Step 1108 (CourseDetails) seems to use it? 
// If it's used on Upload, we need a proxy for it.
// I'll assume for now I only fix Chat/Quiz/Guide.

// 2. Search for relevant context (Unchanged, uses Supabase)
export const searchContext = async (courseId, query, fileName = null) => {
    // ... (Keep existing implementation which queries course_docs) ...
    // Note: I cannot use "ReplacementContent" with "Keep existing" unless I supply it.
    // I will rewrite searchContext here to be safe or use multi-replace.
    // Actually, searchContext used `openai`? No.
    // It used `supabase` query. Safe.

    // I will just paste the searchContext code back.
    try {
        console.log('Antigravity Debug: Searching context for course:', courseId, 'File:', fileName || 'ALL');

        // Simple Fetch Chunks (Fallback for RAG without RPC)
        let queryBuilder = supabase
            .from('course_docs')
            .select('content, file_name')
            .eq('course_id', courseId);

        if (fileName && fileName !== 'all') {
            queryBuilder = queryBuilder.eq('file_name', fileName);
        }

        const { data: docs, error } = await queryBuilder.limit(fileName && fileName !== 'all' ? 30 : 15);

        if (error) {
            console.error('Antigravity Debug: Supabase Context Retrieval Error:', error);
            throw new Error(`Knowledge base search failed: ${error.message}`);
        }

        if (!docs || docs.length === 0) {
            console.warn('Antigravity Debug: No documents found in course_docs for this course.');
            return '';
        }

        return docs.map(d => d.content).join('\n---\n');
    } catch (error) {
        throw error;
    }
};

// 3. Generate Study Guide
export const generateStudyGuide = async (context, courseName) => {
    if (!context || context.trim().length === 0) {
        throw new Error("No materials found for this course. Please upload a PDF in the 'Materials' tab first.");
    }

    const prompt = `
    You are an expert tutor. Create a comprehensive study guide for the course "${courseName}" based strictly on the provided context.
    
    MATH RENDERING RULES:
    - Use standard LaTeX for ALL mathematical formulas.
    - Use single "$" for inline math (e.g., $x^2$).
    - Use double "$$" for block math on a new line (e.g., $$M = \\frac{x1+x2}{2}$$).
    
    Structure:
    1. Course Overview (Brief)
    2. Core Concepts (Bulleted list)
    3. Key Formulas / Procedures
    4. Potential Exam Questions (3-5)
    5. Study Checklist
    
    Context:
    ${context.substring(0, 15000)}
    `;

    try {
        const data = await callAI([
            { role: "system", content: "You are a helpful study assistant who outputs professional LaTeX math using $ and $$ delimiters." },
            { role: "user", content: prompt }
        ]);
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Study Guide Error:', error);
        throw error;
    }
};

// 4. Generate Quiz
export const generateQuiz = async (context, courseName) => {
    if (!context || context.trim().length === 0) {
        throw new Error("No materials found.");
    }

    const prompt = `
    Generate a quiz for "${courseName}" based on the text below.
    Return ONLY a valid JSON object.
    
    MATH RENDERING RULES:
    - Use standard LaTeX for ALL mathematical formulas.
    - Use single "$" for inline math (e.g., $x^2$).
    - Use double "$$" for block math.
    
    Format JSON:
    { "questions": [ { "question": "...", "options": ["..."], "correctAnswer": 0, "explanation": "..." } ] }
    
    Context:
    ${context.substring(0, 15000)}
    `;

    try {
        const data = await callAI(
            [{ role: "system", content: "You are a quiz generator. Output JSON only." }, { role: "user", content: prompt }],
            { type: "json_object" }
        );
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Quiz Error:', error);
        throw error;
    }
};

// 5. Chat Response
export const chatWithDocuments = async (history, context) => {
    const messages = [
        {
            role: "system", content: `You are a course assistant. Answer questions based on this context. 
        MATH RENDERING GUIDELINE: Use standard LaTeX with $ and $$ delimiters.
        \n\nContext:\n${context.substring(0, 15000)}`
        },
        ...history
    ];

    try {
        const data = await callAI(messages);
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Chat Error:', error);
        throw error;
    }
};


// =====================================================
// PHASE 2: Citation-Aware Generation Functions
// =====================================================

/**
 * Search context with page metadata for citations
 * Returns chunks with pdf_name and page_number
 */
export const searchContextWithPages = async (courseId, pdfIds = null, pageStart = null, pageEnd = null) => {
    try {
        // Use the RPC function we created in Phase 1
        const { data, error } = await supabase.rpc('get_pdf_chunks', {
            p_course_id: courseId,
            p_user_id: (await supabase.auth.getUser()).data.user.id,
            p_pdf_ids: pdfIds,
            p_page_start: pageStart ? parseInt(pageStart) : null,
            p_page_end: pageEnd ? parseInt(pageEnd) : null
        });

        if (error) throw error;

        if (!data || data.length === 0) {
            return { chunks: [], contextText: '' };
        }

        // Build context text with page markers
        const contextText = data.map(chunk =>
            `[Source: ${chunk.pdf_name} p.${chunk.page_number}]\n${chunk.content}`
        ).join('\n\n---\n\n');

        return {
            chunks: data, // Array of { chunk_id, pdf_name, page_number, content, pdf_id }
            contextText
        };
    } catch (error) {
        console.error('Context search error:', error);
        throw error;
    }
};

/**
 * Generate Guided Notes with Citations
 * @param {Array} chunks - Result from searchContextWithPages
 * @param {string} format - 'outline' | 'cornell' | 'fill-in' | 'eli5'
 * @returns {Object} - { title, sections: [{ heading, content, citations }] }
 */
export const generateGuidedNotes = async (chunks, courseName, format = 'outline') => {
    if (!chunks || chunks.length === 0) {
        throw new Error('No content found for selected PDFs/pages. Upload materials first.');
    }

    const contextText = chunks.map(c =>
        `[${c.pdf_name} p.${c.page_number}]: ${c.content}`
    ).join('\n\n');

    const formatInstructions = {
        outline: 'Create hierarchical outline notes with main topics and subtopics.',
        cornell: 'Create Cornell-style notes with Cues, Notes, and Summary sections.',
        'fill-in': 'Create fill-in-the-blank study notes with key terms removed.',
        eli5: 'Create a simple explanation suitable for someone new to the topic.'
    };

    const prompt = `You are an expert note-taker. Generate ${format} notes for "${courseName}" based ONLY on the provided excerpts.

CRITICAL CITATION RULES:
- Every factual statement MUST cite the source using [PDFName p.X] format
- Citations must reference ONLY the provided sources
- If a fact spans multiple sources, cite all: [Bio101.pdf p.12, Lecture3.pdf p.5]

FORMAT: ${formatInstructions[format] || formatInstructions.outline}

Return ONLY valid JSON in this structure:
{
  "title": "Study Notes Title",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Section content with inline [PDFName p.X] citations after each statement.",
      "citations": [{"pdf_name": "...", "page": 12}]
    }
  ]
}

Context:
${contextText.substring(0, 20000)}`;

    try {
        const data = await callAI(
            [
                { role: "system", content: "You are a study assistant. Output JSON only with citations." },
                { role: "user", content: prompt }
            ],
            { type: "json_object" }
        );

        const result = JSON.parse(data.choices[0].message.content);
        return result;
    } catch (error) {
        console.error('Guided Notes Error:', error);
        throw error;
    }
};

/**
 * Generate Quiz with Citations
 * @param {Array} chunks - Result from searchContextWithPages
 * @param {Object} settings - { numQuestions, difficulty, types }
 * @returns {Object} - { questions: [{ question, options, correctAnswer, explanation, citation }] }
 */
export const generateQuizWithCitations = async (chunks, courseName, settings = {}) => {
    if (!chunks || chunks.length === 0) {
        throw new Error('No content found. Upload materials first.');
    }

    const { numQuestions = 10, difficulty = 'medium', types = ['mcq'] } = settings;

    const contextText = chunks.map(c =>
        `[${c.pdf_name} p.${c.page_number}]: ${c.content}`
    ).join('\n\n');

    const prompt = `Generate a ${difficulty} practice quiz for "${courseName}" with ${numQuestions} questions.

CITATION RULES:
- Every question MUST cite its source: {"citation": {"pdf_name": "...", "page": 12}}
- Only use facts from the provided excerpts

QUESTION TYPES: ${types.join(', ')}

Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "Question text with LaTeX $math$ if needed",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct (cite source)",
      "citation": {"pdf_name": "Bio101.pdf", "page": 45}
    }
  ]
}

Context:
${contextText.substring(0, 20000)}`;

    try {
        const data = await callAI(
            [
                { role: "system", content: "You are a quiz generator. Output JSON only." },
                { role: "user", content: prompt }
            ],
            { type: "json_object" }
        );

        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Quiz Generation Error:', error);
        throw error;
    }
};

/**
 * Chat with PDF Citations
 * @param {Array} history - Chat history
 * @param {Array} chunks - Result from searchContextWithPages
 * @returns {string} - Response with inline [PDFName p.X] citations
 */
export const chatWithPDFCitations = async (history, chunks) => {
    if (!chunks || chunks.length === 0) {
        return "No PDF content loaded. Please upload course materials to chat with them.";
    }

    const contextText = chunks.map(c =>
        `[${c.pdf_name} p.${c.page_number}]: ${c.content}`
    ).join('\n\n');

    const systemPrompt = `You are an AI tutor. Answer questions based ONLY on the provided PDF excerpts.

CITATION RULES:
- Cite EVERY factual claim using [PDFName p.X] format
- Example: "Photosynthesis occurs in chloroplasts [Bio101.pdf p.23]."
- If uncertain, say "I don't see that in the provided pages."

MATH: Use LaTeX with $ and $$ delimiters.

Context:
${contextText.substring(0, 20000)}`;

    try {
        const data = await callAI([
            { role: "system", content: systemPrompt },
            ...history
        ]);

        return data.choices[0].message.content;
    } catch (error) {
        console.error('Chat Error:', error);
        throw error;
    }
};
