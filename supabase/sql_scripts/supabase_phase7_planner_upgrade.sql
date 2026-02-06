-- PHASE 7: SMART PLANNER UPGRADE

-- 1. Add Recurrence & Reminders to Tasks
alter table tasks 
add column if not exists recurrence_rule jsonb, -- { frequency: 'daily'|'weekly', interval: 1, end_date: 'YYYY-MM-DD', days_of_week: [1,3] }
add column if not exists parent_task_id uuid references tasks(id) on delete set null,
add column if not exists reminders jsonb default '[]'::jsonb; -- [{ type: 'notification', offset: 60 (minutes) }]

-- 2. Add Reminders to Assignments
alter table assignments
add column if not exists reminders jsonb default '[]'::jsonb;

-- 3. Create Index for faster lookup of recurring tasks
create index if not exists idx_tasks_parent_id on tasks(parent_task_id);
create index if not exists idx_tasks_recurrence on tasks using gin(recurrence_rule);

-- 4. Enable PG_CRON for the new jobs (if not already)
-- Note: Requires `pg_cron` extension enabled in Dashboard

-- 5. Schedule Recurrence Generator (Run daily at midnight)
select cron.schedule(
    'nightly-planner-recurrence',
    '0 0 * * *', 
    $$
    select
      net.http_post(
        url := 'https://jpggbgvbfeuadlhonslu.supabase.co/functions/v1/planner-recurrence',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
);

-- 6. Schedule Reminder Checker (Run every hour)
select cron.schedule(
    'hourly-planner-reminders',
    '0 * * * *', 
    $$
    select
      net.http_post(
        url := 'https://jpggbgvbfeuadlhonslu.supabase.co/functions/v1/planner-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
);
