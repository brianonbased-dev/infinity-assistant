/**
 * Secure Variable Storage Service
 *
 * Handles secure storage and retrieval of sensitive credentials
 * used during the build process.
 *
 * Security features:
 * - Encryption at rest using AES-256-GCM
 * - Session-based storage (credentials cleared after build)
 * - No plaintext storage in localStorage or cookies
 * - Secure memory handling
 *
 * Flow:
 * 1. User provides credentials in BuilderRequirementsForm
 * 2. Credentials are encrypted and stored temporarily
 * 3. Build process retrieves credentials as needed
 * 4. Credentials are cleared after build completion
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface StoredVariable {
  id: string;
  key: string;
  encryptedValue: string;
  iv: string;
  sensitive: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface VariableSet {
  workspaceId: string;
  templateId: string;
  variables: StoredVariable[];
  createdAt: Date;
  status: 'active' | 'used' | 'expired' | 'cleared';
}

export interface StoreVariableInput {
  key: string;
  value: string;
  sensitive?: boolean;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Generate a random encryption key for the session
 */
async function generateSessionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a value using AES-256-GCM
 */
async function encryptValue(
  value: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    encrypted: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt a value using AES-256-GCM
 */
async function decryptValue(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedData = base64ToBuffer(encrypted);
  const ivData = base64ToBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivData },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================================================
// SECURE VARIABLE STORAGE SERVICE
// ============================================================================

class SecureVariableStorageService {
  private sessionKey: CryptoKey | null = null;
  private variableSets: Map<string, VariableSet> = new Map();
  private readonly EXPIRY_HOURS = 1; // Variables expire after 1 hour

  /**
   * Initialize the service with a new session key
   */
  async initialize(): Promise<void> {
    this.sessionKey = await generateSessionKey();
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<CryptoKey> {
    if (!this.sessionKey) {
      await this.initialize();
    }
    return this.sessionKey!;
  }

  /**
   * Store variables for a workspace build
   */
  async storeVariables(
    workspaceId: string,
    templateId: string,
    variables: StoreVariableInput[]
  ): Promise<void> {
    const key = await this.ensureInitialized();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRY_HOURS * 60 * 60 * 1000);

    const storedVariables: StoredVariable[] = await Promise.all(
      variables.map(async (v) => {
        const { encrypted, iv } = await encryptValue(v.value, key);
        return {
          id: crypto.randomUUID(),
          key: v.key,
          encryptedValue: encrypted,
          iv,
          sensitive: v.sensitive ?? true,
          createdAt: now,
          expiresAt,
        };
      })
    );

    const variableSet: VariableSet = {
      workspaceId,
      templateId,
      variables: storedVariables,
      createdAt: now,
      status: 'active',
    };

    this.variableSets.set(workspaceId, variableSet);
  }

  /**
   * Retrieve a specific variable value
   */
  async getVariable(workspaceId: string, key: string): Promise<string | null> {
    const variableSet = this.variableSets.get(workspaceId);
    if (!variableSet || variableSet.status !== 'active') {
      return null;
    }

    const variable = variableSet.variables.find((v) => v.key === key);
    if (!variable) {
      return null;
    }

    // Check expiry
    if (new Date() > variable.expiresAt) {
      await this.clearVariables(workspaceId);
      return null;
    }

    const cryptoKey = await this.ensureInitialized();
    return await decryptValue(variable.encryptedValue, variable.iv, cryptoKey);
  }

  /**
   * Retrieve all variables for a workspace as an env object
   */
  async getVariablesAsEnv(workspaceId: string): Promise<Record<string, string>> {
    const variableSet = this.variableSets.get(workspaceId);
    if (!variableSet || variableSet.status !== 'active') {
      return {};
    }

    const cryptoKey = await this.ensureInitialized();
    const env: Record<string, string> = {};

    for (const variable of variableSet.variables) {
      // Check expiry
      if (new Date() > variable.expiresAt) {
        continue;
      }

      const value = await decryptValue(
        variable.encryptedValue,
        variable.iv,
        cryptoKey
      );
      env[variable.key] = value;
    }

    return env;
  }

  /**
   * Mark variables as used (after build starts)
   */
  markAsUsed(workspaceId: string): void {
    const variableSet = this.variableSets.get(workspaceId);
    if (variableSet) {
      variableSet.status = 'used';
    }
  }

  /**
   * Clear all variables for a workspace
   */
  async clearVariables(workspaceId: string): Promise<void> {
    const variableSet = this.variableSets.get(workspaceId);
    if (variableSet) {
      // Overwrite sensitive data before clearing
      for (const variable of variableSet.variables) {
        variable.encryptedValue = '';
        variable.iv = '';
      }
      variableSet.status = 'cleared';
      variableSet.variables = [];
    }
    this.variableSets.delete(workspaceId);
  }

  /**
   * Clear all expired variable sets
   */
  async clearExpired(): Promise<number> {
    const now = new Date();
    let cleared = 0;

    for (const [workspaceId, variableSet] of this.variableSets.entries()) {
      const hasExpired = variableSet.variables.some(
        (v) => now > v.expiresAt
      );

      if (hasExpired) {
        await this.clearVariables(workspaceId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get status of variable set
   */
  getStatus(workspaceId: string): VariableSet['status'] | null {
    const variableSet = this.variableSets.get(workspaceId);
    return variableSet?.status ?? null;
  }

  /**
   * Check if variables exist and are valid for a workspace
   */
  hasValidVariables(workspaceId: string): boolean {
    const variableSet = this.variableSets.get(workspaceId);
    if (!variableSet || variableSet.status !== 'active') {
      return false;
    }

    const now = new Date();
    return variableSet.variables.every((v) => now <= v.expiresAt);
  }

  /**
   * Get list of variable keys (not values) for a workspace
   */
  getVariableKeys(workspaceId: string): string[] {
    const variableSet = this.variableSets.get(workspaceId);
    if (!variableSet) {
      return [];
    }
    return variableSet.variables.map((v) => v.key);
  }

  /**
   * Rotate the session key (security measure)
   * Re-encrypts all active variables with new key
   */
  async rotateSessionKey(): Promise<void> {
    const oldKey = this.sessionKey;
    if (!oldKey) {
      await this.initialize();
      return;
    }

    const newKey = await generateSessionKey();

    // Re-encrypt all active variables
    for (const [workspaceId, variableSet] of this.variableSets.entries()) {
      if (variableSet.status !== 'active') continue;

      const reEncryptedVars: StoredVariable[] = [];

      for (const variable of variableSet.variables) {
        // Decrypt with old key
        const value = await decryptValue(
          variable.encryptedValue,
          variable.iv,
          oldKey
        );

        // Encrypt with new key
        const { encrypted, iv } = await encryptValue(value, newKey);

        reEncryptedVars.push({
          ...variable,
          encryptedValue: encrypted,
          iv,
        });
      }

      variableSet.variables = reEncryptedVars;
    }

    this.sessionKey = newKey;
  }

  /**
   * Destroy the service and clear all data
   */
  async destroy(): Promise<void> {
    for (const workspaceId of this.variableSets.keys()) {
      await this.clearVariables(workspaceId);
    }
    this.sessionKey = null;
  }
}

// Export singleton instance
export const secureVariableStorage = new SecureVariableStorageService();

// Export class for testing
export { SecureVariableStorageService };
