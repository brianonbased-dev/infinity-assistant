-- ============================================================================
-- User Vault Tables
--
-- Secure password and secrets management for InfinityAssistant users.
-- The assistant handles all passwords and private data.
--
-- Security:
-- - Encrypted at rest with AES-256-GCM
-- - Master password never stored (only verification hash)
-- - Per-secret encryption with unique IVs
-- - Audit logging for all operations
-- ============================================================================

-- Vault configuration (master password verification)
CREATE TABLE IF NOT EXISTS user_vault_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_hash VARCHAR(100) NOT NULL, -- PBKDF2 hash of master password
  verification_salt VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_vault UNIQUE (user_id)
);

-- Vault secrets
CREATE TABLE IF NOT EXISTS user_vault_secrets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (
    category IN ('password', 'api_key', 'oauth_token', 'ssh_key', 'certificate', 'env_variable', 'wallet_seed', 'custom')
  ),
  encrypted_data TEXT NOT NULL, -- AES-256-GCM encrypted
  iv VARCHAR(50) NOT NULL, -- Initialization vector
  salt VARCHAR(100) NOT NULL, -- Key derivation salt
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  CONSTRAINT unique_user_secret_name UNIQUE (user_id, name)
);

-- Vault audit log
CREATE TABLE IF NOT EXISTS user_vault_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (
    action IN ('vault_unlock', 'vault_lock', 'secret_create', 'secret_read', 'secret_update', 'secret_delete', 'secret_share', 'mesh_sync', 'master_password_change')
  ),
  secret_id UUID,
  secret_name VARCHAR(255),
  ip_address VARCHAR(50),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vault_config_user ON user_vault_config(user_id);

CREATE INDEX IF NOT EXISTS idx_vault_secrets_user ON user_vault_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_secrets_category ON user_vault_secrets(category);
CREATE INDEX IF NOT EXISTS idx_vault_secrets_name ON user_vault_secrets(user_id, name);
CREATE INDEX IF NOT EXISTS idx_vault_secrets_expires ON user_vault_secrets(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_audit_user ON user_vault_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_action ON user_vault_audit(action);
CREATE INDEX IF NOT EXISTS idx_vault_audit_timestamp ON user_vault_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_vault_audit_secret ON user_vault_audit(secret_id) WHERE secret_id IS NOT NULL;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE user_vault_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vault_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vault_audit ENABLE ROW LEVEL SECURITY;

-- Vault config: users can only access their own
CREATE POLICY "Users can view their own vault config"
  ON user_vault_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vault config"
  ON user_vault_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vault config"
  ON user_vault_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Vault secrets: users can only access their own
CREATE POLICY "Users can view their own secrets"
  ON user_vault_secrets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own secrets"
  ON user_vault_secrets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own secrets"
  ON user_vault_secrets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own secrets"
  ON user_vault_secrets FOR DELETE
  USING (auth.uid() = user_id);

-- Vault audit: users can only view their own
CREATE POLICY "Users can view their own audit logs"
  ON user_vault_audit FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- Service role policies (for API operations)
-- ============================================================================

CREATE POLICY "Service role has full access to vault config"
  ON user_vault_config FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to vault secrets"
  ON user_vault_secrets FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to vault audit"
  ON user_vault_audit FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vault_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vault_config_updated
  BEFORE UPDATE ON user_vault_config
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_updated_at();

CREATE TRIGGER trigger_vault_secrets_updated
  BEFORE UPDATE ON user_vault_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_updated_at();

-- Clean up expired secrets (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_vault_secrets()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_vault_secrets
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
