-- Phase 20: AI Usage Limits
-- Add ai_usage_count to user_stats to track total AI generations

ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS ai_usage_count integer DEFAULT 0;

-- Optional: Reset Monthly? 
-- For now, we track TOTAL. We can add a "reset_date" later if needed.
-- Or we can just let it run up for now and manually reset via cron.

-- Allow Edge Function (Service Role) to update this
GRANT UPDATE ON user_stats TO service_role;
GRANT SELECT ON user_stats TO service_role;
