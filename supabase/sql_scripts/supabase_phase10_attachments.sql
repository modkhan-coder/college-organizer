-- Add Notes and Attachments to Tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB;

-- Create Storage Bucket for Attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task_attachments', 'task_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated Users Can Upload Attachments" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'task_attachments');

-- Policy: Allow authenticated users to update their own files (if needed, though insert is main one)
CREATE POLICY "Users Can Update Own Attachments" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'task_attachments' AND owner = auth.uid());

-- Policy: Allow public access to view files (since bucket is public, but good to be explicit for authenticated users)
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'task_attachments');
