-- Add PDF Studio credits tracking to profiles table

-- Add credits column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pdf_credits INT DEFAULT 50,
ADD COLUMN IF NOT EXISTS pdf_credits_reset_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 month');

-- Update existing premium users to have credits
UPDATE profiles 
SET pdf_credits = 50,
    pdf_credits_reset_at = (NOW() + INTERVAL '1 month')
WHERE plan = 'premium' AND (pdf_credits IS NULL OR pdf_credits = 0);

-- Create function to reset credits monthly
CREATE OR REPLACE FUNCTION reset_pdf_credits()
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET 
        pdf_credits = 50,
        pdf_credits_reset_at = (NOW() + INTERVAL '1 month')
    WHERE 
        plan = 'premium' 
        AND pdf_credits_reset_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to consume credits
CREATE OR REPLACE FUNCTION consume_pdf_credit(user_id_param UUID, credits_to_consume INT DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INT;
    reset_time TIMESTAMP;
BEGIN
    -- Get current credits and reset time
    SELECT pdf_credits, pdf_credits_reset_at 
    INTO current_credits, reset_time
    FROM profiles
    WHERE id = user_id_param;

    -- Reset if needed
    IF reset_time < NOW() THEN
        UPDATE profiles
        SET 
            pdf_credits = 50,
            pdf_credits_reset_at = (NOW() + INTERVAL '1 month')
        WHERE id = user_id_param;
        current_credits := 50;
    END IF;

    -- Check if enough credits
    IF current_credits >= credits_to_consume THEN
        UPDATE profiles
        SET pdf_credits = pdf_credits - credits_to_consume
        WHERE id = user_id_param;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION consume_pdf_credit TO authenticated;
GRANT EXECUTE ON FUNCTION reset_pdf_credits TO authenticated;

COMMENT ON COLUMN profiles.pdf_credits IS 'Monthly AI credits for PDF Studio (50 per month for premium users)';
COMMENT ON COLUMN profiles.pdf_credits_reset_at IS 'Timestamp when PDF credits will reset';
COMMENT ON FUNCTION consume_pdf_credit IS 'Consumes PDF Studio credits and returns true if successful';
COMMENT ON FUNCTION reset_pdf_credits IS 'Resets credits for users whose reset time has passed';
