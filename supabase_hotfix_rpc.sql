-- =====================================================
-- HOTFIX: Recreate get_pdf_chunks function
-- This fixes the "structure of query does not match function result type" error
-- =====================================================

-- Drop and recreate the function
DROP FUNCTION IF EXISTS get_pdf_chunks(UUID, UUID, UUID[], INT, INT, TEXT);

CREATE OR REPLACE FUNCTION get_pdf_chunks(
  p_course_id UUID,
  p_user_id UUID,
  p_pdf_ids UUID[] DEFAULT NULL,
  p_page_start INT DEFAULT NULL,
  p_page_end INT DEFAULT NULL,
  p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  pdf_name TEXT,
  page_number INT,
  content TEXT,
  pdf_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cd.id,
    pf.file_name,
    cd.page_number,
    cd.content,
    cd.pdf_id
  FROM course_docs cd
  INNER JOIN pdf_files pf ON cd.pdf_id = pf.id
  WHERE 
    cd.course_id = p_course_id
    AND cd.user_id = p_user_id
    AND (p_pdf_ids IS NULL OR cd.pdf_id = ANY(p_pdf_ids))
    AND (p_page_start IS NULL OR cd.page_number >= p_page_start)
    AND (p_page_end IS NULL OR cd.page_number <= p_page_end)
    AND (p_query IS NULL OR cd.content ILIKE '%' || p_query || '%')
  ORDER BY cd.page_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pdf_chunks(UUID, UUID, UUID[], INT, INT, TEXT) TO authenticated;

-- Test the function (optional - uncomment and fill in your IDs)
-- SELECT * FROM get_pdf_chunks(
--   'your-course-id'::UUID,
--   'your-user-id'::UUID,
--   NULL, NULL, NULL, NULL
-- ) LIMIT 5;
