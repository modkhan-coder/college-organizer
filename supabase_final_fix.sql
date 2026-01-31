-- =====================================================
-- CORRECTED FIX: get_pdf_chunks with correct data types
-- =====================================================

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
    cd.pdf_id,  -- Use pdf_id as chunk_id instead of cd.id
    pf.file_name,
    COALESCE(cd.page_number, 1),
    cd.content,
    cd.pdf_id
  FROM course_docs cd
  INNER JOIN pdf_files pf ON cd.pdf_id = pf.id
  WHERE 
    cd.course_id = p_course_id
    AND cd.user_id = p_user_id
    AND cd.pdf_id IS NOT NULL
    AND (p_pdf_ids IS NULL OR cd.pdf_id = ANY(p_pdf_ids))
    AND (p_page_start IS NULL OR COALESCE(cd.page_number, 1) >= p_page_start)
    AND (p_page_end IS NULL OR COALESCE(cd.page_number, 1) <= p_page_end)
    AND (p_query IS NULL OR cd.content ILIKE '%' || p_query || '%')
  ORDER BY COALESCE(cd.page_number, 1) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pdf_chunks(UUID, UUID, UUID[], INT, INT, TEXT) TO authenticated;

-- =====================================================
-- CRITICAL: After running this:
-- 1. Delete the PDF from Studio sidebar (trash icon)
-- 2. Re-upload via "Add PDF" button
-- 3. Wait for processing
-- 4. Try quiz/notes/chat
-- =====================================================
