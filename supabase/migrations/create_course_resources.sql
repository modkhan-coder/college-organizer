-- Course Resource Hub - Database Schema
-- Part 1: course_resources table

-- This table consolidates all non-assignment/non-task course materials
-- (links, files, notes, textbooks, zoom links, office hours)

create table if not exists course_resources (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Resource type enum
  type text not null check (type in ('link', 'file', 'note', 'textbook', 'zoom', 'office_hours')),
  
  title text not null,
  url text, -- for links, zoom
  file_id uuid, -- references pdf_files or other file storage
  content jsonb, -- for notes, office hours (structured data)
  tags text[] default '{}',
  
  pinned boolean default false,
  sort_order integer default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table course_resources enable row level security;

-- RLS Policy: Users can only access their own course resources
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

-- Indexes for performance
create index idx_course_resources_course on course_resources(course_id);
create index idx_course_resources_user on course_resources(user_id);
create index idx_course_resources_pinned on course_resources(course_id, pinned) where pinned = true;
create index idx_course_resources_type on course_resources(course_id, type);

-- Updated_at trigger
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
