-- PHASE 5: GAMIFICATION & ENGAGEMENT SCHEMA

-- 1. Create User Stats Table
create table if not exists user_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  current_streak int default 0,
  best_streak int default 0,
  last_activity_date timestamptz,
  streak_freeze_count int default 0,
  total_tasks_completed int default 0,
  total_study_minutes int default 0,
  status text default 'active',
  updated_at timestamptz default now()
);

-- 2. Create Badges Reference Table
create table if not exists badges (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  description text,
  icon_name text,
  category text, -- 'productivity', 'focus', 'academic', 'fun'
  requirement_type text, -- 'task_count', 'streak_count', 'grade_improvement'
  requirement_value int
);

-- 3. Create User Badges Junction
create table if not exists user_badges (
  user_id uuid references auth.users(id) on delete cascade,
  badge_id uuid references badges(id) on delete cascade,
  awarded_at timestamptz default now(),
  primary key (user_id, badge_id)
);

-- 4. Enable RLS
alter table user_stats enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;

-- 5. RLS Policies
create policy "Users can view their own stats" on user_stats for select using (auth.uid() = user_id);
create policy "Users can update their own stats" on user_stats for update using (auth.uid() = user_id);
create policy "Users can insert their own stats" on user_stats for insert with check (auth.uid() = user_id);

create policy "Everyone can view badges" on badges for select using (true);

create policy "Users can view their own badges" on user_badges for select using (auth.uid() = user_id);
create policy "Users can insert their own badges" on user_badges for insert with check (auth.uid() = user_id);

-- 6. Seed Default Badges
insert into badges (slug, title, description, icon_name, category, requirement_type, requirement_value) values
('first-week', 'First Week Strong', 'Complete tasks for 7 consecutive days', 'Flame', 'productivity', 'streak_count', 7),
('task-slayer', 'Task Slayer', 'Complete 50 tasks', 'Target', 'productivity', 'task_count', 50),
('on-time-hero', 'On-Time Hero', 'Submit 10 assignments before the due date', 'Clock', 'productivity', 'on_time_count', 10),
('pomodoro-pro', 'Pomodoro Pro', 'Complete 20 focus sessions', 'Timer', 'focus', 'focus_session_count', 20),
('night-owl', 'Night Owl', 'Most work completed after 10 PM', 'Moon', 'fun', 'time_bucket', 22);

-- 7. Auto-create user_stats on profile creation
create or replace function public.handle_new_user_stats()
returns trigger as $$
begin
  insert into public.user_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_stats
  after insert on auth.users
  for each row execute procedure public.handle_new_user_stats();

