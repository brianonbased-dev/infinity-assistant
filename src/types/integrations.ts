/**
 * Integration Types
 *
 * Defines the structure for OAuth-connected integrations stored in user profiles.
 * These integrations allow agents to:
 * - Use APIs with stored tokens
 * - Access browser sessions for deeper automation
 * - Manage resources on behalf of the user
 */

// ============================================================================
// PROVIDER DEFINITIONS
// ============================================================================

export type IntegrationProvider =
  | 'supabase'
  | 'vercel'
  | 'github'
  | 'stripe'
  | 'openai'
  | 'anthropic'
  | 'discord'
  | 'telegram'
  | 'slack'
  | 'notion'
  | 'google'
  | 'aws'
  | 'cloudflare'
  | 'resend'
  | 'twilio'
  | 'sendgrid'
  | 'firebase'
  | 'planetscale'
  | 'railway'
  | 'render'
  | 'netlify'
  | 'figma'
  | 'linear'
  | 'jira'
  // Enterprise/WhiteGlove service providers
  | 'mongodb'
  | 'redis'
  | 'digitalocean';

export type IntegrationCategory =
  | 'database'
  | 'hosting'
  | 'ai'
  | 'communication'
  | 'storage'
  | 'analytics'
  | 'payment'
  | 'design'
  | 'project_management'
  | 'version_control';

export type ConnectionStatus =
  | 'connected'
  | 'expired'
  | 'revoked'
  | 'pending'
  | 'error';

export type AuthMethod =
  | 'oauth2'
  | 'api_key'
  | 'bot_token'
  | 'browser_session';

// ============================================================================
// INTEGRATION CONFIGURATION
// ============================================================================

export interface IntegrationConfig {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  category: IntegrationCategory;
  authMethod: AuthMethod;
  /** OAuth configuration if applicable */
  oauth?: OAuthConfig;
  /** What capabilities this integration provides */
  capabilities: IntegrationCapability[];
  /** Scopes/permissions typically needed */
  defaultScopes: string[];
  /** Can agents use browser automation with this? */
  supportsBrowserAccess: boolean;
  /** Documentation URL */
  docsUrl: string;
  /** Is this a free service? */
  hasFreeOption: boolean;
}

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  /** Additional params needed for auth */
  additionalParams?: Record<string, string>;
}

export type IntegrationCapability =
  | 'database_read'
  | 'database_write'
  | 'file_storage'
  | 'deploy'
  | 'deployment'
  | 'compute'
  | 'authentication'
  | 'send_messages'
  | 'ai_inference'
  | 'payment_processing'
  | 'email_send'
  | 'sms_send'
  | 'analytics'
  | 'user_management'
  | 'project_management'
  | 'design_access'
  | 'code_repository';

// ============================================================================
// USER INTEGRATION (STORED IN PROFILE)
// ============================================================================

export interface UserIntegration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: ConnectionStatus;
  /** Display name for this connection (e.g., "Work GitHub") */
  displayName: string;
  /** When the connection was established */
  connectedAt: Date;
  /** When tokens expire (if applicable) */
  expiresAt?: Date;
  /** Last time we successfully used this integration */
  lastUsedAt?: Date;
  /** OAuth tokens (encrypted) */
  credentials: EncryptedCredentials;
  /** Provider-specific metadata */
  metadata: IntegrationMetadata;
  /** Scopes granted by user */
  grantedScopes: string[];
  /** Can agents access browser session? */
  browserAccessEnabled: boolean;
  /** Browser session data (encrypted) - cookies, localStorage, etc. */
  browserSession?: EncryptedBrowserSession;
}

export interface EncryptedCredentials {
  /** Encrypted access token */
  accessToken: string;
  /** Encrypted refresh token (if applicable) */
  refreshToken?: string;
  /** Encrypted API key (for api_key auth) */
  apiKey?: string;
  /** Token type (e.g., "Bearer") */
  tokenType?: string;
  /** IV for decryption */
  iv: string;
}

export interface EncryptedBrowserSession {
  /** Encrypted cookies */
  cookies: string;
  /** Encrypted localStorage data */
  localStorage?: string;
  /** Encrypted sessionStorage data */
  sessionStorage?: string;
  /** User agent used */
  userAgent: string;
  /** Last captured timestamp */
  capturedAt: Date;
  /** IV for decryption */
  iv: string;
}

export interface IntegrationMetadata {
  /** Provider-specific user/account ID */
  accountId?: string;
  /** Account email */
  email?: string;
  /** Account name/username */
  accountName?: string;
  /** Organization/team if applicable */
  organization?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Plan/tier info */
  plan?: string;
  /** Any provider-specific data */
  extra?: Record<string, unknown>;
}

// ============================================================================
// INTEGRATION EVENTS
// ============================================================================

export interface IntegrationEvent {
  id: string;
  integrationId: string;
  userId: string;
  type: IntegrationEventType;
  timestamp: Date;
  details: string;
  success: boolean;
  /** Which agent/build used this */
  triggeredBy?: {
    type: 'user' | 'agent' | 'build';
    id: string;
    name?: string;
  };
}

export type IntegrationEventType =
  | 'connected'
  | 'disconnected'
  | 'token_refreshed'
  | 'token_expired'
  | 'api_call'
  | 'browser_action'
  | 'error'
  | 'scope_updated';

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

export const INTEGRATION_CONFIGS: Record<IntegrationProvider, IntegrationConfig> = {
  supabase: {
    provider: 'supabase',
    name: 'Supabase',
    description: 'Database, authentication, storage, and real-time subscriptions',
    icon: '⚡',
    category: 'database',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://api.supabase.com/v1/oauth/authorize',
      tokenUrl: 'https://api.supabase.com/v1/oauth/token',
      clientIdEnvVar: 'SUPABASE_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'SUPABASE_OAUTH_CLIENT_SECRET',
    },
    capabilities: ['database_read', 'database_write', 'file_storage', 'user_management'],
    defaultScopes: ['all'],
    supportsBrowserAccess: true,
    docsUrl: 'https://supabase.com/docs',
    hasFreeOption: true,
  },
  vercel: {
    provider: 'vercel',
    name: 'Vercel',
    description: 'Deployment and hosting platform',
    icon: '▲',
    category: 'hosting',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://vercel.com/oauth/authorize',
      tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
      clientIdEnvVar: 'VERCEL_CLIENT_ID',
      clientSecretEnvVar: 'VERCEL_CLIENT_SECRET',
    },
    capabilities: ['deploy'],
    defaultScopes: ['user:read', 'project:read', 'project:write', 'deployment:read', 'deployment:write'],
    supportsBrowserAccess: true,
    docsUrl: 'https://vercel.com/docs',
    hasFreeOption: true,
  },
  github: {
    provider: 'github',
    name: 'GitHub',
    description: 'Code repository and version control',
    icon: '🐙',
    category: 'version_control',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      clientIdEnvVar: 'GITHUB_CLIENT_ID',
      clientSecretEnvVar: 'GITHUB_CLIENT_SECRET',
    },
    capabilities: ['code_repository'],
    defaultScopes: ['repo', 'read:user', 'user:email'],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.github.com',
    hasFreeOption: true,
  },
  stripe: {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Payment processing',
    icon: '💳',
    category: 'payment',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://connect.stripe.com/oauth/authorize',
      tokenUrl: 'https://connect.stripe.com/oauth/token',
      clientIdEnvVar: 'STRIPE_CLIENT_ID',
      clientSecretEnvVar: 'STRIPE_CLIENT_SECRET',
      additionalParams: { response_type: 'code', scope: 'read_write' },
    },
    capabilities: ['payment_processing'],
    defaultScopes: ['read_write'],
    supportsBrowserAccess: true,
    docsUrl: 'https://stripe.com/docs',
    hasFreeOption: true,
  },
  openai: {
    provider: 'openai',
    name: 'OpenAI',
    description: 'GPT and AI model access',
    icon: '🤖',
    category: 'ai',
    authMethod: 'api_key',
    capabilities: ['ai_inference'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://platform.openai.com/docs',
    hasFreeOption: false,
  },
  anthropic: {
    provider: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI access',
    icon: '🧠',
    category: 'ai',
    authMethod: 'api_key',
    capabilities: ['ai_inference'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.anthropic.com',
    hasFreeOption: false,
  },
  discord: {
    provider: 'discord',
    name: 'Discord',
    description: 'Discord bot and server management',
    icon: '🎮',
    category: 'communication',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      clientIdEnvVar: 'DISCORD_CLIENT_ID',
      clientSecretEnvVar: 'DISCORD_CLIENT_SECRET',
    },
    capabilities: ['send_messages'],
    defaultScopes: ['bot', 'applications.commands', 'guilds', 'messages.read'],
    supportsBrowserAccess: true,
    docsUrl: 'https://discord.com/developers/docs',
    hasFreeOption: true,
  },
  telegram: {
    provider: 'telegram',
    name: 'Telegram',
    description: 'Telegram bot integration',
    icon: '✈️',
    category: 'communication',
    authMethod: 'bot_token',
    capabilities: ['send_messages'],
    defaultScopes: [],
    supportsBrowserAccess: false,
    docsUrl: 'https://core.telegram.org/bots',
    hasFreeOption: true,
  },
  slack: {
    provider: 'slack',
    name: 'Slack',
    description: 'Slack workspace integration',
    icon: '💬',
    category: 'communication',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      clientIdEnvVar: 'SLACK_CLIENT_ID',
      clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
    },
    capabilities: ['send_messages'],
    defaultScopes: ['chat:write', 'channels:read', 'users:read'],
    supportsBrowserAccess: true,
    docsUrl: 'https://api.slack.com/docs',
    hasFreeOption: true,
  },
  notion: {
    provider: 'notion',
    name: 'Notion',
    description: 'Notion workspace access',
    icon: '📝',
    category: 'project_management',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      clientIdEnvVar: 'NOTION_CLIENT_ID',
      clientSecretEnvVar: 'NOTION_CLIENT_SECRET',
    },
    capabilities: ['project_management', 'database_read', 'database_write'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://developers.notion.com',
    hasFreeOption: true,
  },
  google: {
    provider: 'google',
    name: 'Google',
    description: 'Google services (Drive, Gmail, Calendar, etc.)',
    icon: '🔍',
    category: 'storage',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      additionalParams: { access_type: 'offline', prompt: 'consent' },
    },
    capabilities: ['file_storage', 'email_send', 'analytics'],
    defaultScopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive'],
    supportsBrowserAccess: true,
    docsUrl: 'https://developers.google.com',
    hasFreeOption: true,
  },
  aws: {
    provider: 'aws',
    name: 'AWS',
    description: 'Amazon Web Services',
    icon: '☁️',
    category: 'hosting',
    authMethod: 'api_key',
    capabilities: ['deploy', 'file_storage', 'database_read', 'database_write'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.aws.amazon.com',
    hasFreeOption: true,
  },
  cloudflare: {
    provider: 'cloudflare',
    name: 'Cloudflare',
    description: 'CDN, DNS, and edge computing',
    icon: '🌐',
    category: 'hosting',
    authMethod: 'api_key',
    capabilities: ['deploy'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://developers.cloudflare.com',
    hasFreeOption: true,
  },
  resend: {
    provider: 'resend',
    name: 'Resend',
    description: 'Email API for developers',
    icon: '📧',
    category: 'communication',
    authMethod: 'api_key',
    capabilities: ['email_send'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://resend.com/docs',
    hasFreeOption: true,
  },
  twilio: {
    provider: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice, and communication APIs',
    icon: '📱',
    category: 'communication',
    authMethod: 'api_key',
    capabilities: ['sms_send', 'send_messages'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://www.twilio.com/docs',
    hasFreeOption: true,
  },
  sendgrid: {
    provider: 'sendgrid',
    name: 'SendGrid',
    description: 'Email delivery service',
    icon: '✉️',
    category: 'communication',
    authMethod: 'api_key',
    capabilities: ['email_send'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.sendgrid.com',
    hasFreeOption: true,
  },
  firebase: {
    provider: 'firebase',
    name: 'Firebase',
    description: 'Google Firebase platform',
    icon: '🔥',
    category: 'database',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    },
    capabilities: ['database_read', 'database_write', 'file_storage', 'user_management'],
    defaultScopes: ['https://www.googleapis.com/auth/firebase'],
    supportsBrowserAccess: true,
    docsUrl: 'https://firebase.google.com/docs',
    hasFreeOption: true,
  },
  planetscale: {
    provider: 'planetscale',
    name: 'PlanetScale',
    description: 'Serverless MySQL platform',
    icon: '🌍',
    category: 'database',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://auth.planetscale.com/oauth/authorize',
      tokenUrl: 'https://auth.planetscale.com/oauth/token',
      clientIdEnvVar: 'PLANETSCALE_CLIENT_ID',
      clientSecretEnvVar: 'PLANETSCALE_CLIENT_SECRET',
    },
    capabilities: ['database_read', 'database_write'],
    defaultScopes: ['read_organization', 'write_organization'],
    supportsBrowserAccess: true,
    docsUrl: 'https://planetscale.com/docs',
    hasFreeOption: true,
  },
  railway: {
    provider: 'railway',
    name: 'Railway',
    description: 'Infrastructure platform',
    icon: '🚂',
    category: 'hosting',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://railway.app/oauth/authorize',
      tokenUrl: 'https://railway.app/oauth/token',
      clientIdEnvVar: 'RAILWAY_CLIENT_ID',
      clientSecretEnvVar: 'RAILWAY_CLIENT_SECRET',
    },
    capabilities: ['deploy'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.railway.app',
    hasFreeOption: true,
  },
  render: {
    provider: 'render',
    name: 'Render',
    description: 'Cloud application hosting',
    icon: '🎨',
    category: 'hosting',
    authMethod: 'api_key',
    capabilities: ['deploy'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://render.com/docs',
    hasFreeOption: true,
  },
  netlify: {
    provider: 'netlify',
    name: 'Netlify',
    description: 'Web deployment platform',
    icon: '🌊',
    category: 'hosting',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://app.netlify.com/authorize',
      tokenUrl: 'https://api.netlify.com/oauth/token',
      clientIdEnvVar: 'NETLIFY_CLIENT_ID',
      clientSecretEnvVar: 'NETLIFY_CLIENT_SECRET',
    },
    capabilities: ['deploy'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.netlify.com',
    hasFreeOption: true,
  },
  figma: {
    provider: 'figma',
    name: 'Figma',
    description: 'Design and prototyping',
    icon: '🎨',
    category: 'design',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://www.figma.com/oauth',
      tokenUrl: 'https://www.figma.com/api/oauth/token',
      clientIdEnvVar: 'FIGMA_CLIENT_ID',
      clientSecretEnvVar: 'FIGMA_CLIENT_SECRET',
    },
    capabilities: ['design_access'],
    defaultScopes: ['file_read'],
    supportsBrowserAccess: true,
    docsUrl: 'https://www.figma.com/developers/api',
    hasFreeOption: true,
  },
  linear: {
    provider: 'linear',
    name: 'Linear',
    description: 'Issue tracking and project management',
    icon: '📊',
    category: 'project_management',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://linear.app/oauth/authorize',
      tokenUrl: 'https://api.linear.app/oauth/token',
      clientIdEnvVar: 'LINEAR_CLIENT_ID',
      clientSecretEnvVar: 'LINEAR_CLIENT_SECRET',
    },
    capabilities: ['project_management'],
    defaultScopes: ['read', 'write'],
    supportsBrowserAccess: true,
    docsUrl: 'https://developers.linear.app',
    hasFreeOption: true,
  },
  jira: {
    provider: 'jira',
    name: 'Jira',
    description: 'Atlassian project management',
    icon: '📋',
    category: 'project_management',
    authMethod: 'oauth2',
    oauth: {
      authorizationUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      clientIdEnvVar: 'ATLASSIAN_CLIENT_ID',
      clientSecretEnvVar: 'ATLASSIAN_CLIENT_SECRET',
      additionalParams: { audience: 'api.atlassian.com' },
    },
    capabilities: ['project_management'],
    defaultScopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
    supportsBrowserAccess: true,
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/',
    hasFreeOption: true,
  },
  mongodb: {
    provider: 'mongodb',
    name: 'MongoDB',
    description: 'NoSQL document database',
    icon: '🍃',
    category: 'database',
    authMethod: 'api_key',
    capabilities: ['database_read', 'database_write'],
    defaultScopes: [],
    supportsBrowserAccess: false,
    docsUrl: 'https://www.mongodb.com/docs/',
    hasFreeOption: true,
  },
  redis: {
    provider: 'redis',
    name: 'Redis',
    description: 'In-memory data structure store',
    icon: '🔴',
    category: 'database',
    authMethod: 'api_key',
    capabilities: ['database_read', 'database_write'],
    defaultScopes: [],
    supportsBrowserAccess: false,
    docsUrl: 'https://redis.io/docs/',
    hasFreeOption: true,
  },
  digitalocean: {
    provider: 'digitalocean',
    name: 'DigitalOcean',
    description: 'Cloud infrastructure provider',
    icon: '🌊',
    category: 'hosting',
    authMethod: 'api_key',
    capabilities: ['deployment', 'compute'],
    defaultScopes: [],
    supportsBrowserAccess: true,
    docsUrl: 'https://docs.digitalocean.com/',
    hasFreeOption: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getIntegrationConfig(provider: IntegrationProvider): IntegrationConfig {
  return INTEGRATION_CONFIGS[provider];
}

export function getIntegrationsByCategory(category: IntegrationCategory): IntegrationConfig[] {
  return Object.values(INTEGRATION_CONFIGS).filter((config) => config.category === category);
}

export function getOAuthProviders(): IntegrationConfig[] {
  return Object.values(INTEGRATION_CONFIGS).filter((config) => config.authMethod === 'oauth2');
}

export function getApiKeyProviders(): IntegrationConfig[] {
  return Object.values(INTEGRATION_CONFIGS).filter((config) => config.authMethod === 'api_key');
}

export function getBrowserAccessProviders(): IntegrationConfig[] {
  return Object.values(INTEGRATION_CONFIGS).filter((config) => config.supportsBrowserAccess);
}

export const INTEGRATION_CATEGORIES: { id: IntegrationCategory; name: string; icon: string }[] = [
  { id: 'database', name: 'Database', icon: '🗄️' },
  { id: 'hosting', name: 'Hosting', icon: '☁️' },
  { id: 'ai', name: 'AI', icon: '🤖' },
  { id: 'communication', name: 'Communication', icon: '💬' },
  { id: 'storage', name: 'Storage', icon: '📁' },
  { id: 'payment', name: 'Payment', icon: '💳' },
  { id: 'design', name: 'Design', icon: '🎨' },
  { id: 'project_management', name: 'Project Management', icon: '📊' },
  { id: 'version_control', name: 'Version Control', icon: '🐙' },
  { id: 'analytics', name: 'Analytics', icon: '📈' },
];
