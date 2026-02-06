-- Inspect columns in storage.buckets to find where CORS settings might be hiding
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'storage' 
  AND table_name = 'buckets';
