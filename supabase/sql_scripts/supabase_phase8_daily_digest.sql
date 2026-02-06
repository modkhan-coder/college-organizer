-- Add email_digest_enabled to profiles
alter table profiles
add column if not exists email_digest_enabled boolean default false;

-- Add comment
comment on column profiles.email_digest_enabled is 'User preference for receiving daily email summaries of tasks.';

-- Create a cron job to run the daily digest at 6:00 AM UTC (adjust as needed for user timezones later)
-- For now, we'll just schedule it. Note: This requires pg_cron extension which is enabled in phase 4.
select cron.schedule(
  'daily-digest-morning',
  '0 6 * * *', -- 6:00 AM every day
  $$
  select
    net.http_post(
        url:='https://project-ref.supabase.co/functions/v1/daily-digest',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
