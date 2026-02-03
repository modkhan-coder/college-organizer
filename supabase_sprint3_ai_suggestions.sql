-- Sprint 3: AI Study Suggestions - Database Migration
-- Add columns to course_checklist_items table to track AI-generated suggestions

-- Add new columns for AI suggestions
ALTER TABLE course_checklist_items
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER CHECK (estimated_time_minutes > 0),
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- Add index for filtering AI suggestions
CREATE INDEX IF NOT EXISTS idx_course_checklist_items_source ON course_checklist_items(source);

-- Add index for generated_at for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_course_checklist_items_generated_at ON course_checklist_items(generated_at);

-- Add comment for documentation
COMMENT ON COLUMN course_checklist_items.source IS 'Source of the checklist item: manual (user-created) or ai (AI-generated)';
COMMENT ON COLUMN course_checklist_items.ai_reasoning IS 'AI explanation for why this task was suggested (only for AI-generated items)';
COMMENT ON COLUMN course_checklist_items.estimated_time_minutes IS 'Estimated time in minutes to complete this task';
COMMENT ON COLUMN course_checklist_items.generated_at IS 'Timestamp when this item was generated (for AI suggestions)';
