-- =====================================================
-- DIAGNOSTIC: Check PDF Study Studio Setup
-- Run this to diagnose the issue
-- =====================================================

-- 1. Check if pdf_files table has data
SELECT 'PDF Files Count:' as check_name, COUNT(*) as count FROM pdf_files;

-- 2. Check if course_docs have pdf_id set
SELECT 
  'Course Docs with PDF ID:' as check_name, 
  COUNT(*) as count 
FROM course_docs 
WHERE pdf_id IS NOT NULL;

-- 3. Check if course_docs are missing pdf_id
SELECT 
  'Course Docs WITHOUT PDF ID:' as check_name, 
  COUNT(*) as count 
FROM course_docs 
WHERE pdf_id IS NULL;

-- 4. Check if the RPC function exists
SELECT 
  'RPC Function Exists:' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_pdf_chunks'
  ) THEN 'YES' ELSE 'NO' END as status;

-- 5. Test the RPC function (replace with your actual user_id and course_id)
-- Uncomment and update these values:
-- SELECT * FROM get_pdf_chunks(
--   'YOUR_COURSE_ID'::UUID,
--   'YOUR_USER_ID'::UUID,
--   NULL,
--   NULL,
--   NULL,
--   NULL
-- ) LIMIT 5;

-- =====================================================
-- EXPECTED RESULTS:
-- - If PDF Files Count = 0: You haven't uploaded any PDFs yet
-- - If Course Docs WITHOUT PDF ID > 0: Old docs need migration
-- - If RPC Function Exists = NO: Function wasn't created properly
-- =====================================================
