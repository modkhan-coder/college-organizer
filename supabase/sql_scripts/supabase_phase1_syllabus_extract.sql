-- Phase 1: Syllabus Extraction Table
-- Stores extracted data from syllabus PDFs for review and confirmation

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

CREATE POLICY "Users can view their own extractions"
    ON syllabus_extractions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extractions"
    ON syllabus_extractions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extractions"
    ON syllabus_extractions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extractions"
    ON syllabus_extractions FOR DELETE
    USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE syllabus_extractions IS 'Stores AI-extracted data from syllabus PDFs before user confirmation';
COMMENT ON COLUMN syllabus_extractions.extracted_json IS 'Structured JSON with course info, grading, dates, assignments, policies';
COMMENT ON COLUMN syllabus_extractions.status IS 'Extraction status: pending, success, or failed';
