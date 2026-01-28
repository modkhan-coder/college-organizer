-- PHASE 6: SOCIAL FOUNDATIONS

-- 1. Update Profiles Table
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists avatar_url text;

-- 2. Create Notifications Table
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'invite', 'reminder', 'achievement', 'social_action'
  title text not null,
  message text,
  data jsonb default '{}', -- additional info (e.g., invite_id, sender_id)
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 3. Create Invites Table
create table if not exists invites (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'schedule_share', 'study_group', 'partner_request'
  target_id uuid, -- ID of the course, group, etc. (if applicable)
  settings jsonb default '{}', -- { scope: 'availability_only', expiry: '...', etc. }
  is_active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- 4. Create Safety Tables (Blocks & Reports)
create table if not exists blocks (
  blocker_id uuid references auth.users(id) on delete cascade not null,
  blocked_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references auth.users(id) on delete cascade not null,
  target_id uuid not null, -- ID of whatever is being reported
  type text not null, -- 'user', 'content', 'group'
  reason text not null,
  details text,
  created_at timestamptz default now()
);

-- 5. Enable RLS
alter table notifications enable row level security;
alter table invites enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

-- 6. RLS Policies

-- Notifications: Users only see their own
create policy "Users can view their own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users can update their own notifications" on notifications for update using (auth.uid() = user_id);

-- Invites: Anyone can see an invite metadata (for landing page), but only owner can manage
create policy "Anyone can view active invites" on invites for select using (is_active = true and (expires_at is null or expires_at > now()));
create policy "Users can manage their own invites" on invites for all using (auth.uid() = creator_id);

-- Blocks: Private to the blocker
create policy "Users can view their own blocks" on blocks for select using (auth.uid() = blocker_id);
create policy "Users can manage their own blocks" on blocks for all using (auth.uid() = blocker_id);

-- Reports: Only owner can see their reports (Admin can see all, but for now just owner)
create policy "Users can view their own reports" on reports for select using (auth.uid() = reporter_id);
create policy "Users can insert reports" on reports for insert with check (auth.uid() = reporter_id);

-- 7. Real-time setup
-- Add tables to the 'supabase_realtime' publication if not already there
alter publication supabase_realtime add table notifications;
