-- Combined Course Resource Hub Migration
-- Run this in Supabase SQL Editor

-- Part 1: course_resources table
create table if not exists course_resources (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Resource type enum
  type text not null check (type in ('link', 'file', 'note', 'textbook', 'zoom', 'office_hours')),
  
  title text not null,
  url text,
  file_id uuid,
  content jsonb,
  tags text[] default '{}',
  
  pinned boolean default false,
  sort_order integer default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on course_resources
alter table course_resources enable row level security;

create policy "Users can view their own course resources"
  on course_resources for select
  using (auth.uid() = user_id);

create policy "Users can insert their own course resources"
  on course_resources for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own course resources"
  on course_resources for update
  using (auth.uid() = user_id);

create policy "Users can delete their own course resources"
  on course_resources for delete
  using (auth.uid() = user_id);

-- Indexes for course_resources
create index idx_course_resources_course on course_resources(course_id);
create index idx_course_resources_user on course_resources(user_id);
create index idx_course_resources_pinned on course_resources(course_id, pinned) where pinned = true;
create index idx_course_resources_type on course_resources(course_id, type);

-- Updated_at trigger for course_resources
create or replace function update_course_resources_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger course_resources_updated_at
  before update on course_resources
  for each row
  execute function update_course_resources_updated_at();

-- Part 2: course_checklist_items table
create table if not exists course_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  text text not null,
  source text not null default 'manual' check (source in ('manual', 'ai', 'imported')),
  
  related_resource_id uuid,
  related_assignment_id uuid,
  
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer default 0,
  
  created_at timestamptz default now()
);

-- Enable RLS on course_checklist_items
alter table course_checklist_items enable row level security;

create policy "Users can view their own checklist items"
  on course_checklist_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own checklist items"
  on course_checklist_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own checklist items"
  on course_checklist_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own checklist items"
  on course_checklist_items for delete
  using (auth.uid() = user_id);

-- Indexes for course_checklist_items
create index idx_checklist_course on course_checklist_items(course_id);
create index idx_checklist_user on course_checklist_items(user_id);
create index idx_checklist_incomplete on course_checklist_items(course_id, user_id) where completed_at is null;
create index idx_checklist_sort on course_checklist_items(course_id, sort_order);
