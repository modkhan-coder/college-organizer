-- Friend Requests Table
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id) NOT NULL,
    receiver_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);

-- Study Activity Table (for Feed/Leaderboard)
CREATE TABLE IF NOT EXISTS study_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    type TEXT NOT NULL, -- 'study_session', 'task_complete', 'achievement'
    details TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies

-- Friend Requests
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create requests" 
ON friend_requests FOR INSERT 
TO authenticated 
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can view requests sent to or by them" 
ON friend_requests FOR SELECT 
TO authenticated 
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can update requests sent to them" 
ON friend_requests FOR UPDATE 
TO authenticated 
USING (receiver_id = auth.uid());

-- Study Activity
ALTER TABLE study_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own activity" 
ON study_activity FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view public activity" 
ON study_activity FOR SELECT 
TO authenticated 
USING (true); -- Ideally, limit to friends, but for MVP public is easier to debug/display
