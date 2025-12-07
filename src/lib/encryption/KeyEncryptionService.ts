/**
 * Key Encryption Service
 * 
 * Encrypts and decrypts API keys using AES-256-GCM
 * Uses environment variable for encryption key
 */

import crypto from 'crypto';
import logger from '@/utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * Falls back to a default for development (NOT for production)
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.PROVIDER_KEYS_ENCRYPTION_KEY;
  
  if (!envKey) {
    // Development fallback - warn in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PROVIDER_KEYS_ENCRYPTION_KEY environment variable is required in production');
    }
    logger.warn('[KeyEncryption] Using default encryption key - NOT SECURE FOR PRODUCTION');
    // Default key for development (32 bytes)
    return crypto.scryptSync('dev-key-change-in-production', 'salt', KEY_LENGTH);
  }
  
  // Convert hex string to buffer, or use as-is if already correct length
  if (envKey.length === 64) {
    // Hex encoded (32 bytes = 64 hex chars)
    return Buffer.from(envKey, 'hex');
  }
  
  // Derive key from string using scrypt
  return crypto.scryptSync(envKey, 'provider-keys-salt', KEY_LENGTH);
}

/**
 * Encrypt API key
 */
export function encryptApiKey(plainKey: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plainKey, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV + tag + encrypted data
    // Format: base64(iv) + ':' + base64(tag) + ':' + base64(encrypted)
    const ivBase64 = iv.toString('base64');
    const tagBase64 = tag.toString('base64');
    
    return `${ivBase64}:${tagBase64}:${encrypted}`;
  } catch (error) {
    logger.error('[KeyEncryption] Failed to encrypt key:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt API key
 */
export function decryptApiKey(encryptedKey: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedKey.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted key format');
    }
    
    const [ivBase64, tagBase64, encrypted] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('[KeyEncryption] Failed to decrypt key:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Hash API key for validation/display
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Mask API key for display
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

