-- PHASE 3: LMS INTEGRATIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create table for LMS connections
CREATE TABLE IF NOT EXISTS lms_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('canvas', 'blackboard', 'moodle')),
    instance_url TEXT NOT NULL,
    access_token TEXT, -- Ideally encrypted at rest
    refresh_token TEXT, 
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on lms_connections
ALTER TABLE lms_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own LMS connections" 
ON lms_connections FOR ALL 
TO authenticated 
USING (auth.uid() = user_id);

-- Update courses table for LMS tracking
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lms_provider TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lms_id TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT TRUE;

-- Update assignments table for LMS tracking
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lms_id TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lms_source BOOLEAN DEFAULT FALSE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lms_status TEXT; -- missing, submitted, graded

-- Index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_courses_lms_id ON courses(lms_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lms_id ON assignments(lms_id);

-- Prevent duplicates at the DB level
-- NOTE: If you already have duplicates, these commands might fail until you run the cleanup below.
ALTER TABLE courses ADD CONSTRAINT unique_course_lms_id UNIQUE (user_id, lms_id);
ALTER TABLE assignments ADD CONSTRAINT unique_assignment_lms_id UNIQUE (user_id, lms_id);

/* 
  CLEANUP SCRIPT (Run this first if you have duplicates):
  
  -- Remove duplicate courses, keeping the oldest one
  DELETE FROM courses a USING (
      SELECT MIN(created_at) as min_ct, user_id, lms_id
      FROM courses
      WHERE lms_id IS NOT NULL
      GROUP BY user_id, lms_id
      HAVING COUNT(*) > 1
  ) b
  WHERE a.user_id = b.user_id 
  AND a.lms_id = b.lms_id 
  AND a.created_at > b.min_ct;

  -- Remove duplicate assignments
  DELETE FROM assignments a USING (
      SELECT MIN(id) as min_id, user_id, lms_id
      FROM assignments
      WHERE lms_id IS NOT NULL
      GROUP BY user_id, lms_id
      HAVING COUNT(*) > 1
  ) b
  WHERE a.user_id = b.user_id 
  AND a.lms_id = b.lms_id 
  AND a.id <> b.min_id;
*/
