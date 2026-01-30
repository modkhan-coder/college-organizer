-- PHASE 22: XP & LEVELING SYSTEM

-- 1. Add XP columns to user_stats if they don't exist
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;

-- 2. Create Helper Function to Add XP (with Plan Multiplier)
CREATE OR REPLACE FUNCTION add_xp(target_user_id UUID, base_amount INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_xp INT;
  current_level INT;
  new_xp INT;
  new_level INT;
  multiplier INT := 1;
  user_plan TEXT;
  leveled_up BOOLEAN := FALSE;
BEGIN
  -- A. Get current stats & plan
  SELECT plan INTO user_plan FROM profiles WHERE id = target_user_id;
  SELECT xp, level INTO current_xp, current_level FROM user_stats WHERE user_id = target_user_id;

  -- Default if null
  IF current_xp IS NULL THEN current_xp := 0; END IF;
  IF current_level IS NULL THEN current_level := 1; END IF;

  -- B. Determine Multiplier (Marketing Hook)
  IF user_plan IN ('pro', 'premium') THEN
    multiplier := 2;
  END IF;

  -- C. Calculate New State
  -- Formula: Level = (XP / 500) + 1
  new_xp := current_xp + (base_amount * multiplier);
  new_level := FLOOR(new_xp / 500) + 1;

  IF new_level > current_level THEN
    leveled_up := TRUE;
  END IF;

  -- D. Update DB
  UPDATE user_stats
  SET xp = new_xp, level = new_level, updated_at = NOW()
  WHERE user_id = target_user_id;

  -- E. Return result for frontend toast/animation
  RETURN json_build_object(
    'new_xp', new_xp,
    'new_level', new_level,
    'leveled_up', leveled_up,
    'xp_gained', (base_amount * multiplier),
    'multiplier', multiplier
  );
END;
$$;
