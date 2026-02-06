-- More Badges for Phase 5
insert into badges (slug, title, description, icon_name, category, requirement_type, requirement_value) values
('century-club', 'Century Club', 'Complete 100 tasks', 'Trophy', 'productivity', 'task_count', 100),
('streak-master', 'Streak Master', 'Maintain a 30-day streak', 'Flame', 'productivity', 'streak_count', 30),
('focus-guru', 'Focus Guru', 'Log 1000 minutes of study time', 'Clock', 'focus', 'study_minutes', 1000),
('getting-started', 'Getting Started', 'Complete your first task', 'CheckCircle', 'productivity', 'task_count', 1)
on conflict (slug) do nothing;
