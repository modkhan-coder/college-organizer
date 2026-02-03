-- ============================================
-- FIX: Add Unique Constraint for AI Extraction (v2)
-- ============================================

-- First, ensure the columns exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='course_docs' AND column_name='pdf_id') THEN
        ALTER TABLE course_docs ADD COLUMN pdf_id UUID REFERENCES pdf_files(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='course_docs' AND column_name='page_number') THEN
        ALTER TABLE course_docs ADD COLUMN page_number INT DEFAULT 1;
    END IF;
END $$;

-- 1. Remove duplicates before adding the constraint
-- We keep only the first record for each combination
DELETE FROM course_docs
WHERE ctid NOT IN (
    SELECT MIN(ctid)
    FROM course_docs
    GROUP BY user_id, course_id, pdf_id, page_number
);

-- 2. Add the unique constraint
ALTER TABLE course_docs 
DROP CONSTRAINT IF EXISTS course_docs_upsert_key;

ALTER TABLE course_docs
ADD CONSTRAINT course_docs_upsert_key UNIQUE (user_id, course_id, pdf_id, page_number);

COMMENT ON CONSTRAINT course_docs_upsert_key ON course_docs IS 'Enables upsert logic for AI extraction and page-level processing';
