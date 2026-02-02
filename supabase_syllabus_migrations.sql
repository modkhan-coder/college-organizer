-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Combines Phase 0 and Phase 1 migrations
-- ============================================

-- PHASE 0: Add syllabus tracking columns
-- ============================================

ALTER TABLE pdf_files 
ADD COLUMN IF NOT EXISTS is_syllabus BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS doc_type TEXT CHECK (doc_type IN ('syllabus', 'textbook', 'notes', 'assignment', 'other'));

-- Create index for faster syllabus queries
CREATE INDEX IF NOT EXISTS idx_pdf_files_syllabus ON pdf_files(is_syllabus) WHERE is_syllabus = TRUE;

COMMENT ON COLUMN pdf_files.is_syllabus IS 'Marks this PDF as the course syllabus for syllabus import feature';
COMMENT ON COLUMN pdf_files.doc_type IS 'Type of document: syllabus, textbook, notes, assignment, or other';


-- PHASE 1: Syllabus Extraction Table
-- ============================================

CREATE TABLE IF NOT EXISTS syllabus_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    pdf_id UUID REFERENCES pdf_files(id) ON DELETE CASCADE NOT NULL,
    extracted_json JSONB NOT NULL,
    status TEXT CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_extractions_course ON syllabus_extractions(course_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_extractions_user ON syllabus_extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_extractions_pdf ON syllabus_extractions(pdf_id);

-- RLS Policies
ALTER TABLE syllabus_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own extractions" ON syllabus_extractions;
CREATE POLICY "Users can view their own extractions"
    ON syllabus_extractions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own extractions" ON syllabus_extractions;
CREATE POLICY "Users can insert their own extractions"
    ON syllabus_extractions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own extractions" ON syllabus_extractions;
CREATE POLICY "Users can update their own extractions"
    ON syllabus_extractions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own extractions" ON syllabus_extractions;
CREATE POLICY "Users can delete their own extractions"
    ON syllabus_extractions FOR DELETE
    USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE syllabus_extractions IS 'Stores AI-extracted data from syllabus PDFs before user confirmation';
COMMENT ON COLUMN syllabus_extractions.extracted_json IS 'Structured JSON with course info, grading, dates, assignments, policies';
COMMENT ON COLUMN syllabus_extractions.status IS 'Extraction status: pending, success, or failed';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Phase 0 and Phase 1 migrations completed!' AS status;
SELECT COUNT(*) AS syllabus_count FROM pdf_files WHERE is_syllabus = TRUE;
SELECT COUNT(*) AS extractions_count FROM syllabus_extractions;
