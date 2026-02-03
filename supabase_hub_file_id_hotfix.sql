-- Hotfix for course_resources.file_id column
-- The file_id field was originally UUID but needs to store storage paths (text)
-- Run this in Supabase SQL Editor

ALTER TABLE course_resources 
ALTER COLUMN file_id TYPE TEXT;

-- Update the column comment for clarity
COMMENT ON COLUMN course_resources.file_id IS 'Storage path for uploaded files (e.g., user_id/course_id/filename.pdf)';
