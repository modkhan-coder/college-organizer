-- Phase 11: Calendar & Schedules

-- 1. Add schedule to courses
-- We store it as a JSONB array: [{ day: 'MO', start: '10:00', end: '11:30', location: 'Hall A' }]
alter table courses 
add column if not exists schedule jsonb default '[]'::jsonb;

-- 2. Add recurrence to tasks
-- We store it as JSONB: { frequency: 'weekly', interval: 1, days: ['MO'], until: '2026-05-01' }
alter table tasks
add column if not exists recurrence jsonb default null;

-- 3. Add location to assignments?
-- Assignments usually belong to a course, so location might not be needed (implied class location or online). 
-- But deadlines are specific. We can leave assignments as is.

-- 4. Enable Realtime for these columns if not already auto-enabled
-- (Supabase usually handles this if table replica identity is full or defaults)
