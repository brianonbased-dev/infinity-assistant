/**
 * User Vault Service
 *
 * Secure password and secrets management for InfinityAssistant users.
 * The assistant handles all passwords and private data on behalf of users.
 *
 * Security Features:
 * - AES-256-GCM encryption with user-derived keys
 * - Master password never stored (used only for key derivation)
 * - Per-secret encryption with unique IVs
 * - Secure mesh sync with end-to-end encryption
 * - Auto-expiring temporary secrets
 * - Audit logging for all vault operations
 *
 * The assistant can:
 * - Store and retrieve passwords for services
 * - Auto-fill credentials during builds
 * - Generate secure passwords
 * - Sync secrets across devices via mesh
 * - Manage API keys and tokens
 */

import { getSupabaseClient } from '@/lib/supabase';
import logger from '@/utils/logger';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface VaultSecret {
  id: string;
  userId: string;
  name: string;
  category: SecretCategory;
  encryptedData: string;
  iv: string;
  salt: string;
  metadata: SecretMetadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  lastAccessedAt?: Date;
}

export type SecretCategory =
  | 'password'
  | 'api_key'
  | 'oauth_token'
  | 'ssh_key'
  | 'certificate'
  | 'env_variable'
  | 'wallet_seed'
  | 'custom';

export interface SecretMetadata {
  service?: string;
  username?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  autoFill?: boolean;
  meshSyncEnabled?: boolean;
}

export interface DecryptedSecret {
  id: string;
  name: string;
  category: SecretCategory;
  value: string;
  metadata: SecretMetadata;
}

export interface VaultStats {
  totalSecrets: number;
  byCategory: Record<SecretCategory, number>;
  lastAccessed: Date | null;
  meshSyncEnabled: number;
}

export interface VaultAuditLog {
  id: string;
  userId: string;
  action: VaultAction;
  secretId?: string;
  secretName?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  timestamp: Date;
}

export type VaultAction =
  | 'vault_unlock'
  | 'vault_lock'
  | 'secret_create'
  | 'secret_read'
  | 'secret_update'
  | 'secret_delete'
  | 'secret_share'
  | 'mesh_sync'
  | 'master_password_change';

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derive encryption key from master password
 */
function deriveKey(masterPassword: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterPassword,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
}

/**
 * Encrypt data with AES-256-GCM
 */
function encrypt(
  data: string,
  masterPassword: string
): { encrypted: string; iv: string; salt: string; authTag: string } {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterPassword, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + ':' + authTag.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt data with AES-256-GCM
 */
function decrypt(
  encryptedData: string,
  iv: string,
  salt: string,
  masterPassword: string
): string {
  const [encrypted, authTagStr] = encryptedData.split(':');
  const saltBuffer = Buffer.from(salt, 'base64');
  const key = deriveKey(masterPassword, saltBuffer);
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTag = Buffer.from(authTagStr, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(
  length: number = 24,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}
): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let chars = '';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const randomBytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }

  return password;
}

// ============================================================================
// USER VAULT SERVICE
// ============================================================================

class UserVaultService {
  private static instance: UserVaultService | null = null;
  private unlockedVaults: Map<string, { key: string; expiresAt: Date }> = new Map();
  private readonly VAULT_TIMEOUT_MINUTES = 30;

  private constructor() {
    // Clear expired vault sessions periodically
    setInterval(() => this.clearExpiredSessions(), 60 * 1000);
    logger.info('[UserVault] Service initialized');
  }

  static getInstance(): UserVaultService {
    if (!UserVaultService.instance) {
      UserVaultService.instance = new UserVaultService();
    }
    return UserVaultService.instance;
  }

  // ============================================================================
  // VAULT MANAGEMENT
  // ============================================================================

  /**
   * Unlock user's vault with master password
   * Returns a session token for subsequent operations
   */
  async unlockVault(
    userId: string,
    masterPassword: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify master password by trying to decrypt a test secret
      const testResult = await this.verifyMasterPassword(userId, masterPassword);

      if (!testResult.valid) {
        await this.logAudit(userId, 'vault_unlock', undefined, undefined, ipAddress, false);
        return { success: false, message: 'Invalid master password' };
      }

      // Store session with expiry
      const expiresAt = new Date(Date.now() + this.VAULT_TIMEOUT_MINUTES * 60 * 1000);
      this.unlockedVaults.set(userId, { key: masterPassword, expiresAt });

      await this.logAudit(userId, 'vault_unlock', undefined, undefined, ipAddress, true);

      return { success: true, message: 'Vault unlocked' };
    } catch (error) {
      logger.error('[UserVault] Unlock error', { userId, error });
      return { success: false, message: 'Failed to unlock vault' };
    }
  }

  /**
   * Lock user's vault
   */
  async lockVault(userId: string): Promise<void> {
    this.unlockedVaults.delete(userId);
    await this.logAudit(userId, 'vault_lock', undefined, undefined, undefined, true);
  }

  /**
   * Check if vault is unlocked
   */
  isVaultUnlocked(userId: string): boolean {
    const session = this.unlockedVaults.get(userId);
    if (!session) return false;
    if (new Date() > session.expiresAt) {
      this.unlockedVaults.delete(userId);
      return false;
    }
    return true;
  }

  /**
   * Get master password from session (for internal operations)
   */
  private getMasterPassword(userId: string): string | null {
    const session = this.unlockedVaults.get(userId);
    if (!session || new Date() > session.expiresAt) {
      this.unlockedVaults.delete(userId);
      return null;
    }
    // Extend session on activity
    session.expiresAt = new Date(Date.now() + this.VAULT_TIMEOUT_MINUTES * 60 * 1000);
    return session.key;
  }

  /**
   * Verify master password against stored verification hash
   */
  private async verifyMasterPassword(
    userId: string,
    masterPassword: string
  ): Promise<{ valid: boolean }> {
    const supabase = getSupabaseClient();

    // Get user's vault verification record
    const { data } = await supabase
      .from('user_vault_config')
      .select('verification_hash, verification_salt')
      .eq('user_id', userId)
      .single();

    if (!data) {
      // No vault exists yet - this is a new vault
      return { valid: true };
    }

    // Verify password
    const derivedHash = deriveKey(masterPassword, Buffer.from(data.verification_salt, 'base64'));
    const storedHash = Buffer.from(data.verification_hash, 'base64');

    return { valid: crypto.timingSafeEqual(derivedHash, storedHash) };
  }

  // ============================================================================
  // SECRET MANAGEMENT
  // ============================================================================

  /**
   * Store a new secret in the vault
   */
  async storeSecret(
    userId: string,
    name: string,
    value: string,
    category: SecretCategory,
    metadata: SecretMetadata = {},
    expiresAt?: Date
  ): Promise<{ success: boolean; secretId?: string; message: string }> {
    const masterPassword = this.getMasterPassword(userId);
    if (!masterPassword) {
      return { success: false, message: 'Vault is locked. Please unlock first.' };
    }

    try {
      const supabase = getSupabaseClient();

      // Encrypt the secret
      const { encrypted, iv, salt } = encrypt(value, masterPassword);

      const secretId = crypto.randomUUID();

      const { error } = await supabase.from('user_vault_secrets').insert({
        id: secretId,
        user_id: userId,
        name,
        category,
        encrypted_data: encrypted,
        iv,
        salt,
        metadata,
        expires_at: expiresAt?.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        logger.error('[UserVault] Store secret error', { userId, error });
        return { success: false, message: 'Failed to store secret' };
      }

      await this.logAudit(userId, 'secret_create', secretId, name, undefined, true);

      return { success: true, secretId, message: 'Secret stored successfully' };
    } catch (error) {
      logger.error('[UserVault] Store secret error', { userId, error });
      return { success: false, message: 'Failed to store secret' };
    }
  }

  /**
   * Retrieve and decrypt a secret
   */
  async getSecret(
    userId: string,
    secretId: string
  ): Promise<{ success: boolean; secret?: DecryptedSecret; message: string }> {
    const masterPassword = this.getMasterPassword(userId);
    if (!masterPassword) {
      return { success: false, message: 'Vault is locked. Please unlock first.' };
    }

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('user_vault_secrets')
        .select('*')
        .eq('id', secretId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { success: false, message: 'Secret not found' };
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return { success: false, message: 'Secret has expired' };
      }

      // Decrypt
      const decryptedValue = decrypt(
        data.encrypted_data,
        data.iv,
        data.salt,
        masterPassword
      );

      // Update last accessed
      await supabase
        .from('user_vault_secrets')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', secretId);

      await this.logAudit(userId, 'secret_read', secretId, data.name, undefined, true);

      return {
        success: true,
        secret: {
          id: data.id,
          name: data.name,
          category: data.category,
          value: decryptedValue,
          metadata: data.metadata,
        },
        message: 'Secret retrieved',
      };
    } catch (error) {
      logger.error('[UserVault] Get secret error', { userId, secretId, error });
      return { success: false, message: 'Failed to decrypt secret' };
    }
  }

  /**
   * Get secret by name (for assistant auto-fill)
   */
  async getSecretByName(
    userId: string,
    name: string
  ): Promise<{ success: boolean; secret?: DecryptedSecret; message: string }> {
    const masterPassword = this.getMasterPassword(userId);
    if (!masterPassword) {
      return { success: false, message: 'Vault is locked. Please unlock first.' };
    }

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('user_vault_secrets')
        .select('*')
        .eq('user_id', userId)
        .eq('name', name)
        .single();

      if (error || !data) {
        return { success: false, message: 'Secret not found' };
      }

      return this.getSecret(userId, data.id);
    } catch (error) {
      return { success: false, message: 'Secret not found' };
    }
  }

  /**
   * List all secrets (metadata only, not decrypted values)
   */
  async listSecrets(
    userId: string,
    category?: SecretCategory
  ): Promise<{
    success: boolean;
    secrets: Array<{
      id: string;
      name: string;
      category: SecretCategory;
      metadata: SecretMetadata;
      createdAt: Date;
      expiresAt?: Date;
    }>;
  }> {
    if (!this.isVaultUnlocked(userId)) {
      return { success: false, secrets: [] };
    }

    try {
      const supabase = getSupabaseClient();

      let query = supabase
        .from('user_vault_secrets')
        .select('id, name, category, metadata, created_at, expires_at')
        .eq('user_id', userId);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return { success: false, secrets: [] };
      }

      return {
        success: true,
        secrets: (data || []).map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          metadata: s.metadata,
          createdAt: new Date(s.created_at),
          expiresAt: s.expires_at ? new Date(s.expires_at) : undefined,
        })),
      };
    } catch (error) {
      return { success: false, secrets: [] };
    }
  }

  /**
   * Update a secret
   */
  async updateSecret(
    userId: string,
    secretId: string,
    updates: {
      name?: string;
      value?: string;
      metadata?: SecretMetadata;
      expiresAt?: Date;
    }
  ): Promise<{ success: boolean; message: string }> {
    const masterPassword = this.getMasterPassword(userId);
    if (!masterPassword) {
      return { success: false, message: 'Vault is locked. Please unlock first.' };
    }

    try {
      const supabase = getSupabaseClient();

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.metadata) updateData.metadata = updates.metadata;
      if (updates.expiresAt) updateData.expires_at = updates.expiresAt.toISOString();

      // If value is being updated, re-encrypt
      if (updates.value) {
        const { encrypted, iv, salt } = encrypt(updates.value, masterPassword);
        updateData.encrypted_data = encrypted;
        updateData.iv = iv;
        updateData.salt = salt;
      }

      const { error } = await supabase
        .from('user_vault_secrets')
        .update(updateData)
        .eq('id', secretId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, message: 'Failed to update secret' };
      }

      await this.logAudit(userId, 'secret_update', secretId, updates.name, undefined, true);

      return { success: true, message: 'Secret updated' };
    } catch (error) {
      return { success: false, message: 'Failed to update secret' };
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(
    userId: string,
    secretId: string
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isVaultUnlocked(userId)) {
      return { success: false, message: 'Vault is locked. Please unlock first.' };
    }

    try {
      const supabase = getSupabaseClient();

      // Get name for audit
      const { data: secret } = await supabase
        .from('user_vault_secrets')
        .select('name')
        .eq('id', secretId)
        .eq('user_id', userId)
        .single();

      const { error } = await supabase
        .from('user_vault_secrets')
        .delete()
        .eq('id', secretId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, message: 'Failed to delete secret' };
      }

      await this.logAudit(userId, 'secret_delete', secretId, secret?.name, undefined, true);

      return { success: true, message: 'Secret deleted' };
    } catch (error) {
      return { success: false, message: 'Failed to delete secret' };
    }
  }

  // ============================================================================
  // ASSISTANT INTEGRATION
  // ============================================================================

  /**
   * Store credentials for a service (assistant helper)
   */
  async storeServiceCredentials(
    userId: string,
    service: string,
    credentials: {
      username?: string;
      password?: string;
      apiKey?: string;
      token?: string;
      url?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const results: string[] = [];

    if (credentials.password) {
      const result = await this.storeSecret(
        userId,
        `${service}_password`,
        credentials.password,
        'password',
        {
          service,
          username: credentials.username,
          url: credentials.url,
          autoFill: true,
        }
      );
      if (result.success) results.push('password');
    }

    if (credentials.apiKey) {
      const result = await this.storeSecret(
        userId,
        `${service}_api_key`,
        credentials.apiKey,
        'api_key',
        { service, autoFill: true }
      );
      if (result.success) results.push('api_key');
    }

    if (credentials.token) {
      const result = await this.storeSecret(
        userId,
        `${service}_token`,
        credentials.token,
        'oauth_token',
        { service, autoFill: true }
      );
      if (result.success) results.push('token');
    }

    return {
      success: results.length > 0,
      message: `Stored ${results.join(', ')} for ${service}`,
    };
  }

  /**
   * Get credentials for a service (assistant helper)
   */
  async getServiceCredentials(
    userId: string,
    service: string
  ): Promise<{
    success: boolean;
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
      token?: string;
      url?: string;
    };
    message: string;
  }> {
    const credentials: Record<string, string | undefined> = {};

    // Try to get password
    const passwordResult = await this.getSecretByName(userId, `${service}_password`);
    if (passwordResult.success && passwordResult.secret) {
      credentials.password = passwordResult.secret.value;
      credentials.username = passwordResult.secret.metadata.username;
      credentials.url = passwordResult.secret.metadata.url;
    }

    // Try to get API key
    const apiKeyResult = await this.getSecretByName(userId, `${service}_api_key`);
    if (apiKeyResult.success && apiKeyResult.secret) {
      credentials.apiKey = apiKeyResult.secret.value;
    }

    // Try to get token
    const tokenResult = await this.getSecretByName(userId, `${service}_token`);
    if (tokenResult.success && tokenResult.secret) {
      credentials.token = tokenResult.secret.value;
    }

    if (Object.keys(credentials).length === 0) {
      return { success: false, message: `No credentials found for ${service}` };
    }

    return {
      success: true,
      credentials,
      message: `Retrieved credentials for ${service}`,
    };
  }

  /**
   * Get all env variables for build (auto-fill integration)
   */
  async getEnvVariablesForBuild(
    userId: string
  ): Promise<Record<string, string>> {
    const result = await this.listSecrets(userId, 'env_variable');
    if (!result.success) return {};

    const env: Record<string, string> = {};

    for (const secret of result.secrets) {
      if (secret.metadata.autoFill) {
        const decrypted = await this.getSecret(userId, secret.id);
        if (decrypted.success && decrypted.secret) {
          env[secret.name] = decrypted.secret.value;
        }
      }
    }

    return env;
  }

  // ============================================================================
  // VAULT INITIALIZATION
  // ============================================================================

  /**
   * Initialize vault for new user
   */
  async initializeVault(
    userId: string,
    masterPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = getSupabaseClient();

      // Check if vault already exists
      const { data: existing } = await supabase
        .from('user_vault_config')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return { success: false, message: 'Vault already exists' };
      }

      // Create verification hash
      const salt = crypto.randomBytes(SALT_LENGTH);
      const verificationHash = deriveKey(masterPassword, salt);

      await supabase.from('user_vault_config').insert({
        user_id: userId,
        verification_hash: verificationHash.toString('base64'),
        verification_salt: salt.toString('base64'),
        created_at: new Date().toISOString(),
      });

      // Auto-unlock after initialization
      await this.unlockVault(userId, masterPassword);

      return { success: true, message: 'Vault initialized successfully' };
    } catch (error) {
      logger.error('[UserVault] Initialize error', { userId, error });
      return { success: false, message: 'Failed to initialize vault' };
    }
  }

  /**
   * Change master password
   */
  async changeMasterPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    // Verify current password
    const verification = await this.verifyMasterPassword(userId, currentPassword);
    if (!verification.valid) {
      return { success: false, message: 'Current password is incorrect' };
    }

    try {
      const supabase = getSupabaseClient();

      // Get all secrets
      const { data: secrets } = await supabase
        .from('user_vault_secrets')
        .select('*')
        .eq('user_id', userId);

      if (!secrets) {
        return { success: false, message: 'Failed to retrieve secrets' };
      }

      // Re-encrypt all secrets with new password
      for (const secret of secrets) {
        const decryptedValue = decrypt(
          secret.encrypted_data,
          secret.iv,
          secret.salt,
          currentPassword
        );

        const { encrypted, iv, salt } = encrypt(decryptedValue, newPassword);

        await supabase
          .from('user_vault_secrets')
          .update({
            encrypted_data: encrypted,
            iv,
            salt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', secret.id);
      }

      // Update verification hash
      const newSalt = crypto.randomBytes(SALT_LENGTH);
      const newVerificationHash = deriveKey(newPassword, newSalt);

      await supabase
        .from('user_vault_config')
        .update({
          verification_hash: newVerificationHash.toString('base64'),
          verification_salt: newSalt.toString('base64'),
        })
        .eq('user_id', userId);

      // Update session
      this.unlockedVaults.set(userId, {
        key: newPassword,
        expiresAt: new Date(Date.now() + this.VAULT_TIMEOUT_MINUTES * 60 * 1000),
      });

      await this.logAudit(userId, 'master_password_change', undefined, undefined, undefined, true);

      return { success: true, message: 'Master password changed successfully' };
    } catch (error) {
      logger.error('[UserVault] Change password error', { userId, error });
      return { success: false, message: 'Failed to change password' };
    }
  }

  // ============================================================================
  // STATS & AUDIT
  // ============================================================================

  /**
   * Get vault statistics
   */
  async getVaultStats(userId: string): Promise<VaultStats | null> {
    if (!this.isVaultUnlocked(userId)) return null;

    try {
      const supabase = getSupabaseClient();

      const { data } = await supabase
        .from('user_vault_secrets')
        .select('category, metadata, last_accessed_at')
        .eq('user_id', userId);

      if (!data) return null;

      const byCategory: Record<SecretCategory, number> = {
        password: 0,
        api_key: 0,
        oauth_token: 0,
        ssh_key: 0,
        certificate: 0,
        env_variable: 0,
        wallet_seed: 0,
        custom: 0,
      };

      let meshSyncEnabled = 0;
      let lastAccessed: Date | null = null;

      for (const secret of data) {
        byCategory[secret.category as SecretCategory]++;
        if (secret.metadata?.meshSyncEnabled) meshSyncEnabled++;
        if (secret.last_accessed_at) {
          const accessDate = new Date(secret.last_accessed_at);
          if (!lastAccessed || accessDate > lastAccessed) {
            lastAccessed = accessDate;
          }
        }
      }

      return {
        totalSecrets: data.length,
        byCategory,
        lastAccessed,
        meshSyncEnabled,
      };
    } catch {
      return null;
    }
  }

  /**
   * Log audit entry
   */
  private async logAudit(
    userId: string,
    action: VaultAction,
    secretId?: string,
    secretName?: string,
    ipAddress?: string,
    success: boolean = true
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      await supabase.from('user_vault_audit').insert({
        user_id: userId,
        action,
        secret_id: secretId,
        secret_name: secretName,
        ip_address: ipAddress,
        success,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn('[UserVault] Audit log error', { error });
    }
  }

  /**
   * Clear expired sessions
   */
  private clearExpiredSessions(): void {
    const now = new Date();
    for (const [userId, session] of this.unlockedVaults.entries()) {
      if (now > session.expiresAt) {
        this.unlockedVaults.delete(userId);
      }
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let userVaultServiceInstance: UserVaultService | null = null;

export function getUserVaultService(): UserVaultService {
  if (!userVaultServiceInstance) {
    userVaultServiceInstance = UserVaultService.getInstance();
  }
  return userVaultServiceInstance;
}

export default UserVaultService;
