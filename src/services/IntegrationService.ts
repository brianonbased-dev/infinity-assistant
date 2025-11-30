/**
 * Integration Service
 *
 * Manages OAuth connections and API integrations for user profiles.
 * Enables agents to access connected services via API or browser sessions.
 *
 * Key features:
 * - OAuth 2.0 flow handling
 * - Token refresh and management
 * - Browser session capture for deeper automation
 * - Integration event logging
 */

import { createClient } from '@supabase/supabase-js';
import {
  type IntegrationProvider,
  type UserIntegration,
  type IntegrationEvent,
  type IntegrationEventType,
  type EncryptedCredentials,
  type EncryptedBrowserSession,
  type IntegrationMetadata,
  type ConnectionStatus,
  INTEGRATION_CONFIGS,
  getIntegrationConfig,
} from '@/types/integrations';

// ============================================================================
// TYPES
// ============================================================================

export interface OAuthStartResult {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  integration?: UserIntegration;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newExpiry?: Date;
  error?: string;
}

export interface BrowserSessionCapture {
  cookies: string;
  localStorage?: string;
  sessionStorage?: string;
  userAgent: string;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

async function getEncryptionKey(): Promise<CryptoKey> {
  // In production, this would use a proper key management service
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.INTEGRATION_ENCRYPTION_KEY || 'default-dev-key-32-bytes-long!!'),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('infinity-integrations'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(data: string): Promise<{ encrypted: string; iv: string }> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  };
}

async function decrypt(encrypted: string, iv: string): Promise<string> {
  const key = await getEncryptionKey();
  const ivBuffer = Buffer.from(iv, 'base64');
  const encryptedBuffer = Buffer.from(encrypted, 'base64');

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// INTEGRATION SERVICE
// ============================================================================

class IntegrationServiceImpl {
  private pendingOAuthStates: Map<string, { userId: string; provider: IntegrationProvider; timestamp: Date }> = new Map();
  private integrations: Map<string, UserIntegration[]> = new Map(); // userId -> integrations

  // In production, this would use Supabase
  private supabase = typeof window !== 'undefined' ? null : null;

  /**
   * Start OAuth flow for a provider
   */
  async startOAuthFlow(
    userId: string,
    provider: IntegrationProvider,
    redirectUri: string
  ): Promise<OAuthStartResult> {
    const config = getIntegrationConfig(provider);

    if (config.authMethod !== 'oauth2' || !config.oauth) {
      throw new Error(`Provider ${provider} does not support OAuth`);
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    this.pendingOAuthStates.set(state, {
      userId,
      provider,
      timestamp: new Date(),
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: process.env[config.oauth.clientIdEnvVar] || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: config.defaultScopes.join(' '),
      ...config.oauth.additionalParams,
    });

    const authUrl = `${config.oauth.authorizationUrl}?${params.toString()}`;

    return { authUrl, state };
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult> {
    const pendingState = this.pendingOAuthStates.get(state);

    if (!pendingState) {
      return { success: false, error: 'Invalid or expired state' };
    }

    // Check state age (max 10 minutes)
    const stateAge = Date.now() - pendingState.timestamp.getTime();
    if (stateAge > 10 * 60 * 1000) {
      this.pendingOAuthStates.delete(state);
      return { success: false, error: 'OAuth state expired' };
    }

    const { userId, provider } = pendingState;
    const config = getIntegrationConfig(provider);

    if (!config.oauth) {
      return { success: false, error: 'Invalid provider configuration' };
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(config.oauth.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: process.env[config.oauth.clientIdEnvVar] || '',
          client_secret: process.env[config.oauth.clientSecretEnvVar] || '',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        return { success: false, error: `Token exchange failed: ${errorData}` };
      }

      const tokens = await tokenResponse.json();

      // Encrypt tokens
      const { encrypted: accessToken, iv: accessIv } = await encrypt(tokens.access_token);
      const refreshToken = tokens.refresh_token
        ? (await encrypt(tokens.refresh_token)).encrypted
        : undefined;

      // Get user info from provider (provider-specific)
      const metadata = await this.fetchProviderMetadata(provider, tokens.access_token);

      // Create integration record
      const integration: UserIntegration = {
        id: crypto.randomUUID(),
        userId,
        provider,
        status: 'connected',
        displayName: metadata.accountName || config.name,
        connectedAt: new Date(),
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        credentials: {
          accessToken,
          refreshToken,
          tokenType: tokens.token_type || 'Bearer',
          iv: accessIv,
        },
        metadata,
        grantedScopes: tokens.scope?.split(' ') || config.defaultScopes,
        browserAccessEnabled: config.supportsBrowserAccess,
      };

      // Store integration
      await this.saveIntegration(integration);

      // Log event
      await this.logEvent(integration.id, userId, 'connected', `Connected to ${config.name}`);

      // Clean up state
      this.pendingOAuthStates.delete(state);

      return { success: true, integration };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Connect via API key (for non-OAuth providers)
   */
  async connectWithApiKey(
    userId: string,
    provider: IntegrationProvider,
    apiKey: string,
    displayName?: string
  ): Promise<OAuthCallbackResult> {
    const config = getIntegrationConfig(provider);

    if (config.authMethod !== 'api_key') {
      return { success: false, error: `Provider ${provider} does not use API keys` };
    }

    try {
      // Validate API key by making a test request
      const isValid = await this.validateApiKey(provider, apiKey);
      if (!isValid) {
        return { success: false, error: 'Invalid API key' };
      }

      // Encrypt API key
      const { encrypted, iv } = await encrypt(apiKey);

      // Get metadata if possible
      const metadata = await this.fetchApiKeyMetadata(provider, apiKey);

      const integration: UserIntegration = {
        id: crypto.randomUUID(),
        userId,
        provider,
        status: 'connected',
        displayName: displayName || config.name,
        connectedAt: new Date(),
        credentials: {
          accessToken: '', // Not used for API key auth
          apiKey: encrypted,
          iv,
        },
        metadata,
        grantedScopes: [],
        browserAccessEnabled: config.supportsBrowserAccess,
      };

      await this.saveIntegration(integration);
      await this.logEvent(integration.id, userId, 'connected', `Connected to ${config.name} with API key`);

      return { success: true, integration };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Connect Telegram bot
   */
  async connectTelegramBot(
    userId: string,
    botToken: string,
    displayName?: string
  ): Promise<OAuthCallbackResult> {
    try {
      // Validate bot token
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!response.ok) {
        return { success: false, error: 'Invalid bot token' };
      }

      const botInfo = await response.json();
      if (!botInfo.ok) {
        return { success: false, error: 'Invalid bot token' };
      }

      const { encrypted, iv } = await encrypt(botToken);

      const integration: UserIntegration = {
        id: crypto.randomUUID(),
        userId,
        provider: 'telegram',
        status: 'connected',
        displayName: displayName || `@${botInfo.result.username}`,
        connectedAt: new Date(),
        credentials: {
          accessToken: encrypted,
          iv,
        },
        metadata: {
          accountId: botInfo.result.id.toString(),
          accountName: botInfo.result.username,
          extra: {
            firstName: botInfo.result.first_name,
            canJoinGroups: botInfo.result.can_join_groups,
            canReadMessages: botInfo.result.can_read_all_group_messages,
          },
        },
        grantedScopes: [],
        browserAccessEnabled: false,
      };

      await this.saveIntegration(integration);
      await this.logEvent(integration.id, userId, 'connected', `Connected Telegram bot @${botInfo.result.username}`);

      return { success: true, integration };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Capture browser session for an integration
   */
  async captureBrowserSession(
    integrationId: string,
    session: BrowserSessionCapture
  ): Promise<boolean> {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration) return false;

    const config = getIntegrationConfig(integration.provider);
    if (!config.supportsBrowserAccess) return false;

    try {
      const { encrypted: cookies, iv } = await encrypt(session.cookies);
      const localStorage = session.localStorage
        ? (await encrypt(session.localStorage)).encrypted
        : undefined;
      const sessionStorage = session.sessionStorage
        ? (await encrypt(session.sessionStorage)).encrypted
        : undefined;

      integration.browserSession = {
        cookies,
        localStorage,
        sessionStorage,
        userAgent: session.userAgent,
        capturedAt: new Date(),
        iv,
      };

      await this.saveIntegration(integration);
      await this.logEvent(
        integrationId,
        integration.userId,
        'browser_action',
        'Browser session captured'
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get decrypted access token for an integration
   */
  async getAccessToken(integrationId: string): Promise<string | null> {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration) return null;

    // Check if token is expired
    if (integration.expiresAt && new Date() > integration.expiresAt) {
      // Try to refresh
      const refreshed = await this.refreshToken(integrationId);
      if (!refreshed.success) {
        integration.status = 'expired';
        await this.saveIntegration(integration);
        return null;
      }
    }

    const config = getIntegrationConfig(integration.provider);

    if (config.authMethod === 'api_key' && integration.credentials.apiKey) {
      return await decrypt(integration.credentials.apiKey, integration.credentials.iv);
    }

    return await decrypt(integration.credentials.accessToken, integration.credentials.iv);
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(integrationId: string): Promise<TokenRefreshResult> {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration || !integration.credentials.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const config = getIntegrationConfig(integration.provider);
    if (!config.oauth) {
      return { success: false, error: 'Provider does not support token refresh' };
    }

    try {
      const refreshToken = await decrypt(
        integration.credentials.refreshToken,
        integration.credentials.iv
      );

      const response = await fetch(config.oauth.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env[config.oauth.clientIdEnvVar] || '',
          client_secret: process.env[config.oauth.clientSecretEnvVar] || '',
        }),
      });

      if (!response.ok) {
        integration.status = 'expired';
        await this.saveIntegration(integration);
        return { success: false, error: 'Token refresh failed' };
      }

      const tokens = await response.json();

      // Update credentials
      const { encrypted: newAccessToken, iv } = await encrypt(tokens.access_token);
      integration.credentials.accessToken = newAccessToken;
      integration.credentials.iv = iv;

      if (tokens.refresh_token) {
        integration.credentials.refreshToken = (await encrypt(tokens.refresh_token)).encrypted;
      }

      const newExpiry = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined;
      integration.expiresAt = newExpiry;
      integration.status = 'connected';

      await this.saveIntegration(integration);
      await this.logEvent(integrationId, integration.userId, 'token_refreshed', 'Access token refreshed');

      return { success: true, newExpiry };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disconnect an integration
   */
  async disconnect(integrationId: string): Promise<boolean> {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration) return false;

    // Clear credentials
    integration.status = 'revoked';
    integration.credentials = {
      accessToken: '',
      iv: '',
    };
    integration.browserSession = undefined;

    await this.saveIntegration(integration);
    await this.logEvent(
      integrationId,
      integration.userId,
      'disconnected',
      `Disconnected from ${getIntegrationConfig(integration.provider).name}`
    );

    return true;
  }

  /**
   * Get all integrations for a user
   */
  async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    return this.integrations.get(userId) || [];
  }

  /**
   * Get integration by ID
   */
  async getIntegrationById(integrationId: string): Promise<UserIntegration | null> {
    for (const userIntegrations of this.integrations.values()) {
      const found = userIntegrations.find((i) => i.id === integrationId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Get integrations by provider
   */
  async getIntegrationsByProvider(
    userId: string,
    provider: IntegrationProvider
  ): Promise<UserIntegration[]> {
    const userIntegrations = this.integrations.get(userId) || [];
    return userIntegrations.filter((i) => i.provider === provider && i.status === 'connected');
  }

  /**
   * Check if user has connected integration
   */
  async hasConnectedIntegration(userId: string, provider: IntegrationProvider): Promise<boolean> {
    const integrations = await this.getIntegrationsByProvider(userId, provider);
    return integrations.length > 0;
  }

  /**
   * Get integration events
   */
  async getIntegrationEvents(
    integrationId: string,
    limit: number = 50
  ): Promise<IntegrationEvent[]> {
    // In production, fetch from database
    return [];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async saveIntegration(integration: UserIntegration): Promise<void> {
    const userIntegrations = this.integrations.get(integration.userId) || [];
    const existingIndex = userIntegrations.findIndex((i) => i.id === integration.id);

    if (existingIndex >= 0) {
      userIntegrations[existingIndex] = integration;
    } else {
      userIntegrations.push(integration);
    }

    this.integrations.set(integration.userId, userIntegrations);

    // In production: Save to Supabase
  }

  private async logEvent(
    integrationId: string,
    userId: string,
    type: IntegrationEventType,
    details: string,
    success: boolean = true
  ): Promise<void> {
    const event: IntegrationEvent = {
      id: crypto.randomUUID(),
      integrationId,
      userId,
      type,
      timestamp: new Date(),
      details,
      success,
    };

    // In production: Save to Supabase
    console.log('Integration event:', event);
  }

  private async fetchProviderMetadata(
    provider: IntegrationProvider,
    accessToken: string
  ): Promise<IntegrationMetadata> {
    // Provider-specific user info fetching
    switch (provider) {
      case 'github': {
        const response = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const user = await response.json();
          return {
            accountId: user.id.toString(),
            accountName: user.login,
            email: user.email,
            avatarUrl: user.avatar_url,
          };
        }
        break;
      }
      case 'google': {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const user = await response.json();
          return {
            accountId: user.id,
            accountName: user.name,
            email: user.email,
            avatarUrl: user.picture,
          };
        }
        break;
      }
      case 'discord': {
        const response = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const user = await response.json();
          return {
            accountId: user.id,
            accountName: user.username,
            email: user.email,
            avatarUrl: user.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
              : undefined,
          };
        }
        break;
      }
      // Add more providers as needed
    }

    return {};
  }

  private async fetchApiKeyMetadata(
    provider: IntegrationProvider,
    apiKey: string
  ): Promise<IntegrationMetadata> {
    // Provider-specific validation and metadata
    switch (provider) {
      case 'openai': {
        // OpenAI doesn't have a user info endpoint
        return { accountName: 'OpenAI Account' };
      }
      case 'anthropic': {
        return { accountName: 'Anthropic Account' };
      }
      // Add more as needed
    }
    return {};
  }

  private async validateApiKey(provider: IntegrationProvider, apiKey: string): Promise<boolean> {
    switch (provider) {
      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
      }
      case 'anthropic': {
        // Anthropic doesn't have a simple validation endpoint
        // We'd need to make a minimal API call
        return apiKey.startsWith('sk-ant-');
      }
      case 'resend': {
        const response = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
      }
      default:
        return true; // Assume valid for unknown providers
    }
  }
}

// Export singleton
export const integrationService = new IntegrationServiceImpl();

// Export class for testing
export { IntegrationServiceImpl };
