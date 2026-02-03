-- ============================================
-- SQL: Prepare for Infinite-Scale AI Analysis
-- ============================================

-- 1. Add openai_file_id to pdf_files to reuse uploaded files across AI functions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdf_files' AND column_name='openai_file_id') THEN
        ALTER TABLE pdf_files ADD COLUMN openai_file_id TEXT;
    END IF;
END $$;

-- 2. Add polling columns to syllabus_extractions to support long-running analysis
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='syllabus_extractions' AND column_name='run_id') THEN
        ALTER TABLE syllabus_extractions ADD COLUMN run_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='syllabus_extractions' AND column_name='thread_id') THEN
        ALTER TABLE syllabus_extractions ADD COLUMN thread_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='syllabus_extractions' AND column_name='assistant_id') THEN
        ALTER TABLE syllabus_extractions ADD COLUMN assistant_id TEXT;
    END IF;
END $$;

COMMENT ON COLUMN pdf_files.openai_file_id IS 'Stored ID for OpenAI Assistant sessions to avoid re-uploading large PDF files.';
