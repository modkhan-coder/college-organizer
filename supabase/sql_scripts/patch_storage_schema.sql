-- Manually patch storage.buckets to add CORS support

-- 1. Add the missing allowed_origins column
ALTER TABLE storage.buckets 
ADD COLUMN IF NOT EXISTS allowed_origins text[];

-- 2. Update the origins for course_materials
UPDATE storage.buckets
SET allowed_origins = ARRAY[
    'https://collegeorganizer.org', 
    'https://www.collegeorganizer.org', 
    'http://localhost:5173'
]
WHERE id = 'course_materials';

-- 3. Verify
SELECT id, allowed_origins FROM storage.buckets WHERE id = 'course_materials';
