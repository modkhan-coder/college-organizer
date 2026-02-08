-- Migration: Add chat message tracking for AI credits
-- Purpose: Track chat messages separately so 10 messages = 1 credit
-- Date: 2026-02-07

-- Add column to track chat messages separately
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS ai_chat_count INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN user_stats.ai_chat_count IS 'Tracks chat messages. Every 10 messages deducts 1 from ai_usage_count (main credits).';
