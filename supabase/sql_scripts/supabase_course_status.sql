-- Add status column to courses to support drafts/processing states
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived'));

-- Update existing "TEMP" courses to draft status (for cleanup safety)
UPDATE courses SET status = 'draft' WHERE code = 'TEMP';

COMMENT ON COLUMN courses.status IS 'Status of the course: active (visible), draft (import in progress), or archived.';
