import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

// Initialize OpenAI with the key from .env (dangerouslyAllowBrowser: true for this prototype)
const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

// 1. Generate Embeddings for a text chunk
export const generateEmbedding = async (text) => {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
};

// 2. Search for relevant context
export const searchContext = async (courseId, query, fileName = null) => {
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

        const { data: docs, error } = await queryBuilder.limit(fileName && fileName !== 'all' ? 30 : 15); // increased limit if specific file

        if (error) {
            console.error('Antigravity Debug: Supabase Context Retrieval Error:', error);
            throw new Error(`Knowledge base search failed: ${error.message}`);
        }

        if (!docs || docs.length === 0) {
            console.warn('Antigravity Debug: No documents found in course_docs for this course.');
            return '';
        }

        console.log(`Antigravity Debug: Found ${docs.length} document chunks for context.`);
        return docs.map(d => d.content).join('\n---\n');
    } catch (error) {
        console.error('Antigravity Debug: searchContext Exception:', error);
        throw error;
    }
};

// 3. Generate Study Guide
export const generateStudyGuide = async (context, courseName) => {
    if (!context || context.trim().length === 0) {
        throw new Error("No materials found for this course. Please upload a PDF in the 'Materials' tab first.");
    }

    try {
        console.log('Antigravity Debug: Requesting Study Guide from OpenAI...');
        const prompt = `
        You are an expert tutor. Create a comprehensive study guide for the course "${courseName}" based strictly on the provided context.
        
        MATH RENDERING RULES:
        - Use standard LaTeX for ALL mathematical formulas.
        - Use single "$" for inline math (e.g., $x^2$).
        - Use double "$$" for block math on a new line (e.g., $$M = \frac{x1+x2}{2}$$).
        - This ensures the app renders vertical fractions and subscripts beautifully.
        
        Structure:
        1. Course Overview (Brief)
        2. Core Concepts (Bulleted list with definitions)
        3. Key Formulas / Procedures (if applicable)
        4. Potential Exam Questions (3-5 practice questions)
        5. Study Checklist
        
        Context:
        ${context.substring(0, 15000)}
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are a helpful study assistant who outputs professional LaTeX math using $ and $$ delimiters." }, { role: "user", content: prompt }],
            model: "gpt-4o",
        });

        console.log('Antigravity Debug: Study Guide generation successful.');
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Antigravity Debug: OpenAI API Error (Study Guide):', error);
        throw new Error(`OpenAI Error: ${error.message}`);
    }
};

// 4. Generate Quiz
export const generateQuiz = async (context, courseName) => {
    if (!context || context.trim().length === 0) {
        throw new Error("No materials found for this course. Please upload a PDF in the 'Materials' tab first.");
    }

    try {
        console.log('Antigravity Debug: Requesting Quiz from OpenAI...');
        const prompt = `
        Generate a quiz for "${courseName}" based on the text below.
        Return ONLY a valid JSON object (no markdown formatting).
        
        MATH RENDERING RULES:
        - Use standard LaTeX for ALL mathematical formulas.
        - Use single "$" for inline math (e.g., $x^2$).
        - Use double "$$" for block math on a new line.
        
        Format:
        {
          "questions": [
            {
              "question": "Question text using LaTeX?",
              "options": ["Option A (LaTeX)", "Option B", "Option C", "Option D"],
              "correctAnswer": 0, // index of correct option
              "explanation": "Why this is correct (use LaTeX)..."
            }
          ]
        }
        
        Context:
        ${context.substring(0, 15000)}
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are a quiz generator. Output JSON only. Use professional LaTeX math notation." }, { role: "user", content: prompt }],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        console.log('Antigravity Debug: Quiz generation successful.');
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Antigravity Debug: OpenAI API Error (Quiz):', error);
        throw new Error(`OpenAI Error: ${error.message}`);
    }
};

// 5. Chat Response
export const chatWithDocuments = async (history, context) => {
    try {
        console.log('Antigravity Debug: Requesting Chat response from OpenAI...');
        const messages = [
            {
                role: "system", content: `You are a course assistant. Answer questions based on this context. 
            MATH RENDERING GUIDELINE: Use standard LaTeX with $ and $$ delimiters for all formulas to ensure they render as beautiful vertical fractions/equations. 
            Example: Use $$M = \\frac{x_1+x_2}{2}$$ for the midpoint formula.\n\nContext:\n${context.substring(0, 15000)}`
            },
            ...history
        ];

        const completion = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4o",
        });

        console.log('Antigravity Debug: Chat response successful.');
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Antigravity Debug: OpenAI API Error (Chat):', error);
        throw new Error(`OpenAI Error: ${error.message}`);
    }
};
