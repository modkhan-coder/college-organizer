-- PHASE 6b: SOCIAL CONNECTIONS (Friends, Following, etc.)

-- 1. Create Connections Table
create table if not exists social_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null, -- The person who accepted the invite
  target_user_id uuid references auth.users(id) on delete cascade not null, -- The person who sent the invite
  type text not null, -- 'friend', 'schedule_viewer', 'study_buddy'
  status text default 'active',
  created_at timestamptz default now(),
  unique(user_id, target_user_id, type)
);

-- 2. Enable RLS
alter table social_connections enable row level security;

-- 3. RLS Policies
-- Users can see their own connections (who they follow/friended)
create policy "Users can view their own connections" on social_connections for select using (auth.uid() = user_id);

-- Users can also see who connected to them (who follows them)
create policy "Users can view their followers" on social_connections for select using (auth.uid() = target_user_id);

-- Users can delete their own connections
create policy "Users can delete their own connections" on social_connections for delete using (auth.uid() = user_id);

-- Insert policy: usually handled via RPC or specialized flow, but for now allow strict inserts from authenticated users
create policy "Users can insert connections" on social_connections for insert with check (auth.uid() = user_id);
