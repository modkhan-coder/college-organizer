-- FIX: Missing RLS policies for gamification
-- Run this in the Supabase SQL Editor to enable achievement tracking

-- 1. Allow users to insert their own initial stats row
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_stats' AND policyname = 'Users can insert their own stats'
    ) THEN
        CREATE POLICY "Users can insert their own stats" ON user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Allow users to insert their own earned badges
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' AND policyname = 'Users can insert their own badges'
    ) THEN
        CREATE POLICY "Users can insert their own badges" ON user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
