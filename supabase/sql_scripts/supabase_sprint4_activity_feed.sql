-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- e.g., 'course_added', 'assignment_completed', 'study_session'
    details TEXT NOT NULL, -- Human readable summary
    metadata JSONB DEFAULT '{}'::jsonb, -- Store related IDs (course_id, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own activity
CREATE POLICY "Users can view their own activity"
    ON public.activity_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can create their own activity logs
CREATE POLICY "Users can create activity logs"
    ON public.activity_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their friends' activity (Future proofing for Social)
-- For now, we'll keep it simple, but this is where social queries would go.
-- A simple "public" profile approach might act differently, but 'friends' logic usually requires a join on the friendship table.
-- Let's stick to "Own Activity" first, and we can add a "View Friends Activity" policy later when strict social privacy is needed.
-- Creating a broad "read" policy for now if we want to show it on a public leaderboard/feed, 
-- but normally activity feeds are private or friends-only. 
-- Let's add a rudimentary "Friends can view" policy based on the 'connections' table if it exists, or just leave it closed for MVP (User only).
-- Actually, the user wants a "Facebook style" feed, so friends need to see it.

CREATE POLICY "Users can view friends activity"
    ON public.activity_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.social_connections
            WHERE (user_id = auth.uid() AND target_user_id = activity_logs.user_id AND status = 'accepted')
            OR (target_user_id = auth.uid() AND user_id = activity_logs.user_id AND status = 'accepted')
        )
        OR user_id = auth.uid() -- Users can always see their own
    );

-- Index for performance
CREATE INDEX activity_logs_user_id_idx ON public.activity_logs(user_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs(created_at DESC);
