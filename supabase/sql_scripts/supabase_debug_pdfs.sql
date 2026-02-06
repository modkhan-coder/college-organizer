-- Debug: Check PDF naming consistency

-- See what's in pdf_files
SELECT id, file_name, course_id 
FROM pdf_files 
WHERE course_id IN (SELECT id FROM courses LIMIT 5)
ORDER BY created_at DESC
LIMIT 10;

-- See what's in course_docs and compare pdf_name
SELECT DISTINCT 
    cd.file_name as doc_file_name,
    pf.file_name as pdf_file_name,
    cd.pdf_id,
    pf.id as pdf_id_from_files
FROM course_docs cd
LEFT JOIN pdf_files pf ON cd.pdf_id = pf.id
WHERE cd.course_id IN (SELECT id FROM courses LIMIT 5)
LIMIT 20;

-- Check if there's a mismatch
SELECT 
    cd.file_name as in_course_docs,
    pf.file_name as in_pdf_files,
    CASE 
        WHEN cd.file_name = pf.file_name THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
FROM course_docs cd
JOIN pdf_files pf ON cd.pdf_id = pf.id
GROUP BY cd.file_name, pf.file_name
LIMIT 20;
