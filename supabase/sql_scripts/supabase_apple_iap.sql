ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'none';

-- Add index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_profiles_apple_txn ON profiles(apple_original_transaction_id) WHERE apple_original_transaction_id IS NOT NULL;
