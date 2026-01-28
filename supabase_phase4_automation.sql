-- PHASE 4: AUTOMATION & DATA INTEGRITY SETUP

-- 1. Enable Required Extensions (if not already)
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Add Unique Constraints to prevent duplicates during sync
-- This ensures that for a given user and provider, we only have one record per LMS ID
alter table courses 
add constraint unique_user_course_lms unique (user_id, lms_id);

alter table assignments 
add constraint unique_user_assignment_lms unique (user_id, lms_id);

-- 3. Schedule the Nightly Sync (3 AM UTC daily)
-- This calls our Edge Function via the pg_net extension
select cron.schedule(
    'nightly-lms-sync', 
    '0 3 * * *', 
    $$
    select
      net.http_post(
        url := 'https://jpggbgvbfeuadlhonslu.supabase.co/functions/v1/lms-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key') -- Requires setting this in Supabase
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
);

-- NOTE: You'll need to set the service role key in your Supabase DB settings 
-- if you haven't already for the cron to work perfectly.
