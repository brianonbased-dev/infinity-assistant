-- Create provider_keys table for user LLM provider API keys (BYOK)
-- Stores encrypted API keys for OpenAI, Anthropic, Google, Cohere, Mistral

CREATE TABLE IF NOT EXISTS provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'cohere', 'mistral')),
  name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL, -- AES-256-GCM encrypted API key
  key_hash TEXT NOT NULL, -- SHA-256 hash for validation/display
  masked_key TEXT NOT NULL, -- For display (e.g., sk-...abcd)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Constraints
  CONSTRAINT provider_keys_user_provider_unique UNIQUE (user_id, provider, is_active) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_keys_user_id ON provider_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider);
CREATE INDEX IF NOT EXISTS idx_provider_keys_user_provider ON provider_keys(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_provider_keys_is_active ON provider_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_provider_keys_key_hash ON provider_keys(key_hash);

-- RLS Policies
ALTER TABLE provider_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own keys
CREATE POLICY "Users can manage their own provider keys"
  ON provider_keys
  FOR ALL
  USING (auth.uid()::text = user_id OR current_setting('request.jwt.claims', true)::json->>'user_id' = user_id);

-- Policy: Service role can access all keys (for backend operations)
CREATE POLICY "Service role can manage all provider keys"
  ON provider_keys
  FOR ALL
  USING (true); -- Service role bypasses RLS

COMMENT ON TABLE provider_keys IS 'User-provided LLM provider API keys (BYOK - Bring Your Own Key)';
COMMENT ON COLUMN provider_keys.encrypted_key IS 'AES-256-GCM encrypted API key (encrypted at rest)';
COMMENT ON COLUMN provider_keys.key_hash IS 'SHA-256 hash of the API key (for validation/display)';
COMMENT ON COLUMN provider_keys.masked_key IS 'Masked version of key for display (e.g., sk-...abcd)';
COMMENT ON COLUMN provider_keys.provider IS 'LLM provider: openai, anthropic, google, cohere, mistral';

