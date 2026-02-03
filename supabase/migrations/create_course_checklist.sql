-- Course Resource Hub - Database Schema
-- Part 2: course_checklist_items table

-- This table stores the "What to study next" checklist items

create table if not exists course_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  text text not null,
  source text not null default 'manual' check (source in ('manual', 'ai', 'imported')),
  
  -- Optional relationships
  related_resource_id uuid, -- references course_resources(id)
  related_assignment_id uuid, -- references assignments(id) if exists
  
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer default 0,
  
  created_at timestamptz default now()
);

-- Enable RLS
alter table course_checklist_items enable row level security;

-- RLS Policy: Users can only access their own checklist items
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

-- Indexes for performance
create index idx_checklist_course on course_checklist_items(course_id);
create index idx_checklist_user on course_checklist_items(user_id);
create index idx_checklist_incomplete on course_checklist_items(course_id, user_id) where completed_at is null;
create index idx_checklist_sort on course_checklist_items(course_id, sort_order);
