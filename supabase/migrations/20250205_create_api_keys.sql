-- Create api_keys table for Infinity Assistant API keys
-- Stores hashed API keys for programmatic access

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the API key
  prefix TEXT NOT NULL, -- First 12 chars for display (ia_...)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Indexes for performance
  CONSTRAINT api_keys_user_id_key UNIQUE (user_id, name) DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at ON api_keys(last_used_at);

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own keys
CREATE POLICY "Users can manage their own API keys"
  ON api_keys
  FOR ALL
  USING (auth.uid()::text = user_id OR current_setting('request.jwt.claims', true)::json->>'user_id' = user_id);

-- Policy: Service role can access all keys (for backend operations)
CREATE POLICY "Service role can manage all API keys"
  ON api_keys
  FOR ALL
  USING (true); -- Service role bypasses RLS

COMMENT ON TABLE api_keys IS 'Infinity Assistant API keys for programmatic access';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key (never store plain keys)';
COMMENT ON COLUMN api_keys.prefix IS 'First 12 characters of key for display (ia_...)';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of last API key usage';

