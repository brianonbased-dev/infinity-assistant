/**
 * Provider Key Service
 * 
 * Manages user LLM provider API keys (BYOK)
 * Uses database storage with encryption
 */

import crypto from 'crypto';
import { getSupabaseClient } from '@/lib/supabase';
import { encryptApiKey, decryptApiKey, hashApiKey, maskApiKey } from '@/lib/encryption';
import { validateProviderKey } from './KeyValidationService';
import logger from '@/utils/logger';

export interface ProviderKeyRecord {
  id: string;
  userId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral';
  name: string;
  keyHash: string; // For validation/display
  encryptedKey: string; // AES-256-GCM encrypted key
  maskedKey: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

/**
 * Provider Key Service
 */
export class ProviderKeyService {
  /**
   * Store provider key in database with encryption
   */
  async storeProviderKey(
    userId: string,
    keyId: string,
    provider: string,
    fullKey: string,
    name: string,
    maskedKey: string
  ): Promise<void> {
    const keyHash = hashApiKey(fullKey);
    const encryptedKey = encryptApiKey(fullKey);
    
    const supabase = getSupabaseClient();
    
    // Deactivate any existing active key for this provider
    await supabase
      .from('provider_keys')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true);
    
    // Insert new key
    const { error } = await supabase
      .from('provider_keys')
      .insert({
        id: keyId,
        user_id: userId,
        provider,
        name: name.trim(),
        encrypted_key: encryptedKey,
        key_hash: keyHash,
        masked_key: maskedKey,
        is_active: true,
      });

    if (error) {
      logger.error('[ProviderKeyService] Failed to store provider key:', error);
      throw new Error(`Failed to store provider key: ${error.message}`);
    }

    logger.info('[ProviderKeyService] Stored provider key:', {
      userId,
      keyId,
      provider,
      name,
    });
  }

  /**
   * Get user's provider keys from database
   */
  async getUserProviderKeys(userId: string): Promise<ProviderKeyRecord[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('provider_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[ProviderKeyService] Failed to get provider keys:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      name: row.name,
      keyHash: row.key_hash,
      encryptedKey: row.encrypted_key,
      maskedKey: row.masked_key,
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used_at ? new Date(row.last_used_at) : undefined,
      isActive: row.is_active,
    }));
  }

  /**
   * Get active provider key for a specific provider
   */
  async getActiveProviderKey(userId: string, provider: string): Promise<ProviderKeyRecord | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('provider_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      provider: data.provider,
      name: data.name,
      keyHash: data.key_hash,
      encryptedKey: data.encrypted_key,
      maskedKey: data.masked_key,
      createdAt: new Date(data.created_at),
      lastUsed: data.last_used_at ? new Date(data.last_used_at) : undefined,
      isActive: data.is_active,
    };
  }

  /**
   * Delete provider key from database
   */
  async deleteProviderKey(userId: string, keyId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('provider_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[ProviderKeyService] Failed to delete provider key:', error);
      return false;
    }

    logger.info('[ProviderKeyService] Deleted provider key:', { userId, keyId });
    return true;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(userId: string, provider: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('provider_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true);
  }

  /**
   * Get actual API key for a provider (for LLM usage)
   * Decrypts from database
   */
  async getActualKey(userId: string, provider: string): Promise<string | null> {
    const keyRecord = await this.getActiveProviderKey(userId, provider);
    if (!keyRecord) return null;
    
    try {
      const decrypted = decryptApiKey(keyRecord.encryptedKey);
      await this.updateLastUsed(userId, provider);
      return decrypted;
    } catch (error) {
      logger.error('[ProviderKeyService] Failed to decrypt key:', error);
      return null;
    }
  }

  /**
   * Validate provider key before storing
   */
  async validateAndStoreKey(
    userId: string,
    provider: string,
    apiKey: string,
    name: string
  ): Promise<{ success: boolean; keyId?: string; error?: string; validationResult?: any }> {
    // Validate key format first
    const maskedKey = maskApiKey(apiKey);
    
    // Test the key with actual API call
    logger.info(`[ProviderKeyService] Validating ${provider} key...`);
    const validationResult = await validateProviderKey(provider, apiKey);
    
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error || 'Key validation failed',
        validationResult,
      };
    }
    
    // Store the key
    const keyId = crypto.randomUUID();
    try {
      await this.storeProviderKey(userId, keyId, provider, apiKey, name, maskedKey);
      return {
        success: true,
        keyId,
        validationResult,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to store key',
      };
    }
  }
}

// Singleton instance
let providerKeyServiceInstance: ProviderKeyService | null = null;

export function getProviderKeyService(): ProviderKeyService {
  if (!providerKeyServiceInstance) {
    providerKeyServiceInstance = new ProviderKeyService();
  }
  return providerKeyServiceInstance;
}

