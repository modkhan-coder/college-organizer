-- =====================================================
-- COMPREHENSIVE FIX: All Foreign Key Constraints for User Deletion
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- 1. Fix profiles table (must have CASCADE to auth.users)
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Fix lms_connections table
ALTER TABLE lms_connections 
DROP CONSTRAINT IF EXISTS lms_connections_user_id_fkey;

ALTER TABLE lms_connections 
ADD CONSTRAINT lms_connections_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Fix friend_requests table (references profiles)
ALTER TABLE friend_requests 
DROP CONSTRAINT IF EXISTS friend_requests_sender_id_fkey;

ALTER TABLE friend_requests 
DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;

ALTER TABLE friend_requests 
ADD CONSTRAINT friend_requests_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE friend_requests 
ADD CONSTRAINT friend_requests_receiver_id_fkey 
FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Fix study_activity table (references profiles)
ALTER TABLE study_activity 
DROP CONSTRAINT IF EXISTS study_activity_user_id_fkey;

ALTER TABLE study_activity 
ADD CONSTRAINT study_activity_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. Fix courses table (if it has user_id)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'user_id') THEN
        ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_user_id_fkey;
        ALTER TABLE courses ADD CONSTRAINT courses_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Fix assignments table (if it has user_id)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'user_id') THEN
        ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_user_id_fkey;
        ALTER TABLE assignments ADD CONSTRAINT assignments_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Fix tasks table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'user_id') THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 8. Fix pdf_files table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pdf_files') THEN
        ALTER TABLE pdf_files DROP CONSTRAINT IF EXISTS pdf_files_user_id_fkey;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pdf_files' AND column_name = 'user_id') THEN
            ALTER TABLE pdf_files ADD CONSTRAINT pdf_files_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 9. Fix saved_content table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_content') THEN
        ALTER TABLE saved_content DROP CONSTRAINT IF EXISTS saved_content_user_id_fkey;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_content' AND column_name = 'user_id') THEN
            ALTER TABLE saved_content ADD CONSTRAINT saved_content_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 10. Fix activity_logs table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
        ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'user_id') THEN
            ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 11. Fix syllabus_extractions table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'syllabus_extractions') THEN
        ALTER TABLE syllabus_extractions DROP CONSTRAINT IF EXISTS syllabus_extractions_user_id_fkey;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'syllabus_extractions' AND column_name = 'user_id') THEN
            ALTER TABLE syllabus_extractions ADD CONSTRAINT syllabus_extractions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 12. Fix course_ai_content table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_ai_content') THEN
        ALTER TABLE course_ai_content DROP CONSTRAINT IF EXISTS course_ai_content_user_id_fkey;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_ai_content' AND column_name = 'user_id') THEN
            ALTER TABLE course_ai_content ADD CONSTRAINT course_ai_content_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- =====================================================
-- VERIFICATION: Show all remaining constraints without CASCADE
-- =====================================================
SELECT 
    tc.table_name, 
    kcu.column_name,
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND rc.delete_rule != 'CASCADE'
ORDER BY tc.table_name;

-- If the above query returns no rows, all constraints are fixed!
-- You should now be able to delete any user.
