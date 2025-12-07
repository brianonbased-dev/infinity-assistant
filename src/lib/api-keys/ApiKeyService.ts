/**
 * API Key Service
 * 
 * Centralized API key management and validation
 * Uses database storage with proper tracking
 */

import crypto from 'crypto';
import { getSupabaseClient } from '@/lib/supabase';
import logger from '@/utils/logger';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyHash: string; // Hashed version of key for lookup
  prefix: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

// In-memory cache for quick lookups (backed by database)
const apiKeysCache: Map<string, ApiKeyRecord[]> = new Map();

/**
 * Hash API key for storage
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * API Key Service
 */
export class ApiKeyService {
  /**
   * Store API key in database
   */
  async storeApiKey(userId: string, keyId: string, fullKey: string, name: string, prefix: string): Promise<void> {
    const keyHash = hashApiKey(fullKey);
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('api_keys')
      .insert({
        id: keyId,
        user_id: userId,
        name: name.trim(),
        key_hash: keyHash,
        prefix,
        is_active: true,
      });

    if (error) {
      logger.error('[ApiKeyService] Failed to store API key:', error);
      throw new Error(`Failed to store API key: ${error.message}`);
    }

    // Update cache
    const record: ApiKeyRecord = {
      id: keyId,
      userId,
      name,
      keyHash,
      prefix,
      createdAt: new Date(),
      isActive: true
    };

    const userKeys = apiKeysCache.get(userId) || [];
    userKeys.push(record);
    apiKeysCache.set(userId, userKeys);

    logger.info('[ApiKeyService] Stored API key:', {
      userId,
      keyId,
      name,
      prefix
    });
  }

  /**
   * Validate API key and return user ID
   * Updates last_used_at in database
   */
  async validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string; keyId?: string }> {
    if (!apiKey || !apiKey.startsWith('ia_')) {
      return { valid: false };
    }

    const keyHash = hashApiKey(apiKey);
    const supabase = getSupabaseClient();

    // Search in database
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, user_id, is_active')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { valid: false };
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    // Update cache
    const userKeys = apiKeysCache.get(data.user_id) || [];
    const cachedKey = userKeys.find(k => k.id === data.id);
    if (cachedKey) {
      cachedKey.lastUsed = new Date();
    }

    return {
      valid: true,
      userId: data.user_id,
      keyId: data.id
    };
  }

  /**
   * Get user's API keys from database
   */
  async getUserKeys(userId: string): Promise<ApiKeyRecord[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[ApiKeyService] Failed to get API keys:', error);
      return [];
    }

    const records = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      keyHash: row.key_hash,
      prefix: row.prefix,
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used_at ? new Date(row.last_used_at) : undefined,
      isActive: row.is_active,
    }));

    // Update cache
    apiKeysCache.set(userId, records);

    return records;
  }

  /**
   * Revoke API key in database
   */
  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[ApiKeyService] Failed to revoke API key:', error);
      return false;
    }

    // Update cache
    const userKeys = apiKeysCache.get(userId) || [];
    const key = userKeys.find(k => k.id === keyId);
    if (key) {
      key.isActive = false;
    }

    logger.info('[ApiKeyService] Revoked API key:', { userId, keyId });
    return true;
  }
}

// Singleton instance
let apiKeyServiceInstance: ApiKeyService | null = null;

export function getApiKeyService(): ApiKeyService {
  if (!apiKeyServiceInstance) {
    apiKeyServiceInstance = new ApiKeyService();
  }
  return apiKeyServiceInstance;
}

