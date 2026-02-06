-- Create feedback table
create table if not exists public.user_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  category text not null check (category in ('suggestion', 'bug', 'support', 'other')),
  subject text not null,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'new'
);

-- Enable RLS
alter table public.user_feedback enable row level security;

-- Policies
create policy "Users can insert their own feedback"
  on public.user_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feedback"
  on public.user_feedback for select
  using (auth.uid() = user_id);
