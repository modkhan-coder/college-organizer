-- Update CORS for course_materials bucket to allow custom domain

-- 1. Ensure the bucket exists (idempotent check)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('course_materials', 'course_materials', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 2. Update CORS to allow collegeorganizer.org
UPDATE storage.buckets
SET allowed_origins = ARRAY[
    'https://collegeorganizer.org', 
    'https://www.collegeorganizer.org', 
    'http://localhost:5173',
    'http://127.0.0.1:5173'
]
WHERE id = 'course_materials';

-- 3. Verify the change (Output for debugging)
SELECT id, allowed_origins FROM storage.buckets WHERE id = 'course_materials';
