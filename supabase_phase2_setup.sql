-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table if not exists course_docs (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  course_id uuid references courses(id) on delete cascade not null,
  file_name text not null,
  content text, -- The text chunk
  metadata jsonb, -- Page number, section, etc.
  embedding vector(1536) -- OpenAI embeddings are 1536 dimensions
);

-- Enable RLS on the documents table
alter table course_docs enable row level security;

-- Policy: Users can only see their own documents
create policy "Users can see their own documents"
on course_docs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own documents"
on course_docs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own documents"
on course_docs for delete
to authenticated
using (auth.uid() = user_id);

-- STORAGE BUCKET SETUP
-- Note: You usually create buckets in the Dashboard, but we can try to do it via SQL or manual instructions.
-- If the bucket 'course_materials' doesn't exist, you must create it in the Dashboard > Storage.

-- Storage Policies (Run this getting the bucket_id usually, but generic RLS below)
-- Allow authenticated uploads to 'course_materials' bucket
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'course_materials' and auth.uid() = owner );

-- Allow users to view their own files
create policy "Allow users to view own files"
on storage.objects for select
to authenticated
using ( bucket_id = 'course_materials' and auth.uid() = owner );

-- Allow users to delete their own files
create policy "Allow users to delete own files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'course_materials' and auth.uid() = owner );

-- AI CONTENT PERSISTENCE
-- Stores generated study guides, quizzes, and chat history
create table if not exists course_ai_content (
  course_id uuid references courses(id) on delete cascade primary key,
  study_guide text,
  quiz_data jsonb,
  chat_history jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table course_ai_content enable row level security;

-- Policy: Users can manage their own AI content
create policy "Users can manage their own course AI content"
on course_ai_content for all
to authenticated
using (
  exists (
    select 1 from courses 
    where id = course_ai_content.course_id 
    and user_id = auth.uid()
  )
);
