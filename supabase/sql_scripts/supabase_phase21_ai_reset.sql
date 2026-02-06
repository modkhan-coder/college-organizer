-- Phase 21: AI Usage Monthly Reset
-- Add reset date column to user_stats

ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS ai_last_reset date DEFAULT CURRENT_DATE;

-- No need to change permissions (service_role already has UPDATE on table)
