-- =====================================================
-- PDF Study Studio v2 - Database Migration
-- Phase 23: Enhanced PDF system with citations
-- =====================================================

-- 1. Create pdf_files table for tracking uploaded PDFs
CREATE TABLE IF NOT EXISTS pdf_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  num_pages INT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  tags TEXT[], -- e.g., ['syllabus', 'lecture', 'textbook']
  UNIQUE(user_id, course_id, file_name)
);

-- 2. Update course_docs table for precise page tracking
-- Check if columns exist before adding them
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_docs' AND column_name = 'pdf_id'
  ) THEN
    ALTER TABLE course_docs ADD COLUMN pdf_id UUID REFERENCES pdf_files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_docs' AND column_name = 'page_number'
  ) THEN
    ALTER TABLE course_docs ADD COLUMN page_number INT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_docs' AND column_name = 'char_start'
  ) THEN
    ALTER TABLE course_docs ADD COLUMN char_start INT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_docs' AND column_name = 'char_end'
  ) THEN
    ALTER TABLE course_docs ADD COLUMN char_end INT;
  END IF;
END $$;

-- 3. Create saved_content table for reusable study assets
CREATE TABLE IF NOT EXISTS saved_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('note', 'quiz', 'flashcard', 'chat')),
  title TEXT,
  content JSONB NOT NULL,
  pdf_ids UUID[], -- array of source PDF IDs
  page_range INT[], -- [start, end] if applicable
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_files_course ON pdf_files(course_id, user_id);
CREATE INDEX IF NOT EXISTS idx_course_docs_pdf ON course_docs(pdf_id, page_number);
CREATE INDEX IF NOT EXISTS idx_saved_content_course ON saved_content(course_id, user_id, content_type);

-- 5. Create RPC function for retrieving chunks with page filtering
CREATE OR REPLACE FUNCTION get_pdf_chunks(
  p_course_id UUID,
  p_user_id UUID,
  p_pdf_ids UUID[] DEFAULT NULL,
  p_page_start INT DEFAULT NULL,
  p_page_end INT DEFAULT NULL,
  p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  pdf_name TEXT,
  page_number INT,
  content TEXT,
  pdf_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cd.id AS chunk_id,
    pf.file_name AS pdf_name,
    cd.page_number,
    cd.content,
    cd.pdf_id
  FROM course_docs cd
  JOIN pdf_files pf ON cd.pdf_id = pf.id
  WHERE 
    cd.course_id = p_course_id
    AND cd.user_id = p_user_id
    AND (p_pdf_ids IS NULL OR cd.pdf_id = ANY(p_pdf_ids))
    AND (p_page_start IS NULL OR cd.page_number >= p_page_start)
    AND (p_page_end IS NULL OR cd.page_number <= p_page_end)
    AND (p_query IS NULL OR cd.content ILIKE '%' || p_query || '%')
  ORDER BY cd.page_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Migration helper: Update existing course_docs to link with pdf_files
-- This creates pdf_files entries for existing PDFs and links them
DO $$
DECLARE
  doc_record RECORD;
  new_pdf_id UUID;
BEGIN
  -- For each unique file in course_docs that doesn't have a pdf_id
  FOR doc_record IN 
    SELECT DISTINCT user_id, course_id, file_name
    FROM course_docs
    WHERE pdf_id IS NULL AND file_name IS NOT NULL
  LOOP
    -- Create pdf_files entry
    INSERT INTO pdf_files (user_id, course_id, file_name, file_path)
    VALUES (
      doc_record.user_id,
      doc_record.course_id,
      doc_record.file_name,
      doc_record.user_id || '/' || doc_record.course_id || '/' || doc_record.file_name
    )
    ON CONFLICT (user_id, course_id, file_name) DO UPDATE 
    SET file_path = EXCLUDED.file_path
    RETURNING id INTO new_pdf_id;

    -- Update course_docs to link to the new pdf_files entry
    UPDATE course_docs
    SET pdf_id = new_pdf_id,
        page_number = COALESCE((metadata->>'page')::INT, 0) + 1 -- Convert chunk index to page
    WHERE user_id = doc_record.user_id
      AND course_id = doc_record.course_id
      AND file_name = doc_record.file_name
      AND pdf_id IS NULL;
  END LOOP;
END $$;

-- 7. Grant permissions (adjust based on your RLS policies)
-- Enable RLS on new tables
ALTER TABLE pdf_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_content ENABLE ROW LEVEL SECURITY;

-- Create policies for pdf_files
CREATE POLICY "Users can view their own PDFs"
  ON pdf_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PDFs"
  ON pdf_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PDFs"
  ON pdf_files FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for saved_content
CREATE POLICY "Users can view their own saved content"
  ON saved_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved content"
  ON saved_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved content"
  ON saved_content FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved content"
  ON saved_content FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Migration Complete!
-- Next: Run this script in Supabase SQL Editor
-- =====================================================
