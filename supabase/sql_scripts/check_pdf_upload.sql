-- =====================================================
-- CHECK: Did you upload the PDF through Studio or Materials tab?
-- =====================================================

-- Check your course_docs records for this PDF
SELECT 
  id,
  file_name,
  pdf_id,
  page_number,
  char_start,
  char_end,
  created_at
FROM course_docs
WHERE file_name LIKE '%1200%' OR file_name LIKE '%Chapter%'
ORDER BY created_at DESC
LIMIT 10;

-- Check if this PDF exists in pdf_files table
SELECT * FROM pdf_files
WHERE file_name LIKE '%1200%' OR file_name LIKE '%Chapter%'
ORDER BY uploaded_at DESC;

-- =====================================================
-- IMPORTANT FINDINGS:
-- If pdf_id is NULL in course_docs → This PDF was uploaded via OLD Materials tab
-- Solution: You must re-upload it through the PDF Studio "Add PDF" button
-- =====================================================
