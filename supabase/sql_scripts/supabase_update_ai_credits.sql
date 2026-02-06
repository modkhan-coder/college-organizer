-- Change ai_usage_count to NUMERIC to support fractional credits (e.g. 0.1 for chat)
ALTER TABLE public.user_stats 
ALTER COLUMN ai_usage_count TYPE NUMERIC(10, 1);

-- Note: existing integers will cast fine.
