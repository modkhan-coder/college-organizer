-- Phase 0: Syllabus Import - Mark PDFs as Syllabus
-- Add columns to distinguish syllabus PDFs from other course materials

-- Add syllabus tracking columns to pdf_files
ALTER TABLE pdf_files 
ADD COLUMN IF NOT EXISTS is_syllabus BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS doc_type TEXT CHECK (doc_type IN ('syllabus', 'slides', 'textbook', 'handout', 'notes', 'other'));

-- Create index for quick syllabus lookup
CREATE INDEX IF NOT EXISTS idx_pdf_files_syllabus ON pdf_files(course_id, is_syllabus) WHERE is_syllabus = TRUE;

-- Update existing PDFs to have a default doc_type
UPDATE pdf_files 
SET doc_type = 'other' 
WHERE doc_type IS NULL;

-- Add constraint to ensure only one syllabus per course (optional, can be removed if multiple syllabi allowed)
-- CREATE UNIQUE INDEX idx_one_syllabus_per_course ON pdf_files(course_id) WHERE is_syllabus = TRUE;

-- Comments
COMMENT ON COLUMN pdf_files.is_syllabus IS 'Marks this PDF as the course syllabus for auto-import features';
COMMENT ON COLUMN pdf_files.doc_type IS 'Type of document: syllabus, slides, textbook, handout, notes, or other';
