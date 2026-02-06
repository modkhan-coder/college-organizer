-- Add "Starter" badges to provide immediate feedback
INSERT INTO badges (slug, title, description, icon_name, category, requirement_type, requirement_value)
VALUES 
('rookie', 'Academic Rookie', 'Complete your very first task! The journey begins.', 'Target', 'productivity', 'task_count', 1),
('high-five', 'High Five!', 'Successfully completed 5 tasks. You''re on a roll.', 'Award', 'productivity', 'task_count', 5)
ON CONFLICT (slug) DO NOTHING;
