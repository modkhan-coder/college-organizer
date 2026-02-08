-- =====================================================
-- FIX: Update unique constraint to support multi-chunk pages
-- The old constraint was: (user_id, course_id, pdf_id, page_number)
-- But pages with lots of text get split into multiple chunks,
-- so we need to include char_start to make each chunk unique.
-- =====================================================

-- Drop the old constraint
ALTER TABLE course_docs 
DROP CONSTRAINT IF EXISTS course_docs_upsert_key;

-- Add new constraint that includes char_start
ALTER TABLE course_docs
ADD CONSTRAINT course_docs_upsert_key UNIQUE (user_id, course_id, pdf_id, page_number, char_start);

COMMENT ON CONSTRAINT course_docs_upsert_key ON course_docs IS 'Enables upsert logic - includes char_start for multi-chunk pages';
