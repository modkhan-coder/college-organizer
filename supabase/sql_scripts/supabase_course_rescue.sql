-- EMERGENCY RESCUE: Set all NULL or missing status courses to 'active'
UPDATE courses SET status = 'active' WHERE status IS NULL;

-- Also verify if any were accidentally marked as draft
-- (Just in case, though unlikely unless they were named TEMP)
-- UPDATE courses SET status = 'active' WHERE status = 'draft' AND code != 'TEMP';
