/**
 * White Glove Service (OAuth-Based)
 *
 * Premium setup service that leverages OAuth integrations for seamless setup.
 * Instead of creating accounts (which most providers don't support via API),
 * we guide users through OAuth connections stored in their profile.
 *
 * Flow:
 * 1. Analyze template requirements
 * 2. Check user's existing OAuth integrations
 * 3. Guide user to connect missing integrations via OAuth/API key
 * 4. Extract credentials from connected integrations
 * 5. Configure build environment
 * 6. Build proceeds with real credentials
 *
 * Benefits:
 * - Uses real accounts user already has or creates manually
 * - OAuth tokens stored securely and refresh automatically
 * - Browser session capture enables deeper agent automation
 * - Single integration profile across all builds
 */

import { integrationService } from './IntegrationService';
import { secureVariableStorage } from './SecureVariableStorage';
import {
  type IntegrationProvider,
  type UserIntegration,
  INTEGRATION_CONFIGS,
  getIntegrationConfig,
} from '@/types/integrations';
import type { BuilderTemplate, AccountRequirement, VariableRequirement } from '@/types/builder-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface WhiteGloveSession {
  id: string;
  userId: string;
  templateId: string;
  status: WhiteGloveStatus;
  requiredIntegrations: RequiredIntegration[];
  connectedIntegrations: string[]; // integration IDs
  pendingIntegrations: IntegrationProvider[];
  configuredVariables: string[];
  auditLog: AuditLogEntry[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export type WhiteGloveStatus =
  | 'analyzing'
  | 'awaiting_integrations'
  | 'integrations_ready'
  | 'configuring_environment'
  | 'starting_build'
  | 'building'
  | 'completed'
  | 'failed';

export interface RequiredIntegration {
  /** The integration provider */
  provider: IntegrationProvider;
  /** Original account requirement from template */
  requirement: AccountRequirement;
  /** Whether this integration is required or optional */
  required: boolean;
  /** Reason why this integration is needed */
  purpose: string;
  /** Environment variables this integration provides */
  providesVariables: string[];
  /** Current connection status */
  status: 'connected' | 'pending' | 'not_available';
  /** Connected integration ID if connected */
  integrationId?: string;
}

export interface IntegrationSetupStatus {
  allRequiredConnected: boolean;
  connectedCount: number;
  requiredCount: number;
  optionalCount: number;
  connected: RequiredIntegration[];
  pending: RequiredIntegration[];
  notAvailable: RequiredIntegration[];
}

export interface AuditLogEntry {
  timestamp: Date;
  action: string;
  details: string;
  success: boolean;
  provider?: string;
}

export interface CredentialExtractionResult {
  success: boolean;
  credentials: Record<string, string>;
  missingVariables: string[];
  error?: string;
}

/** User input for white glove onboarding */
export interface WhiteGloveUserInput {
  templateId?: string;
  projectName?: string;
  customVariables?: Record<string, string>;
  email?: string;
  fullName?: string;
  phone?: string;
  masterPassword?: string;
  autoGeneratePasswords?: boolean;
  paymentMethod?: {
    type: string;
    cardToken: string;
  };
}

// ============================================================================
// PROVIDER TO VARIABLE MAPPING
// ============================================================================

/**
 * Maps integration providers to the environment variables they provide
 */
const PROVIDER_VARIABLE_MAP: Record<IntegrationProvider, string[]> = {
  supabase: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  vercel: ['VERCEL_TOKEN'],
  github: ['GITHUB_TOKEN', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  stripe: [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  discord: ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
  slack: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
  telegram: ['TELEGRAM_BOT_TOKEN'],
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
  sendgrid: ['SENDGRID_API_KEY'],
  resend: ['RESEND_API_KEY'],
  aws: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
  cloudflare: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID'],
  digitalocean: ['DIGITALOCEAN_TOKEN'],
  railway: ['RAILWAY_TOKEN'],
  planetscale: ['DATABASE_URL'],
  mongodb: ['MONGODB_URI'],
  redis: ['REDIS_URL'],
  figma: ['FIGMA_ACCESS_TOKEN'],
  notion: ['NOTION_API_KEY', 'NOTION_DATABASE_ID'],
  linear: ['LINEAR_API_KEY'],
  jira: ['JIRA_API_TOKEN', 'JIRA_BASE_URL'],
  firebase: ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'],
  render: ['RENDER_API_KEY'],
  netlify: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'],
};

/**
 * Maps template account provider names to integration providers
 */
function mapAccountToProvider(accountProvider: string): IntegrationProvider | null {
  const mapping: Record<string, IntegrationProvider> = {
    supabase: 'supabase',
    vercel: 'vercel',
    github: 'github',
    stripe: 'stripe',
    openai: 'openai',
    anthropic: 'anthropic',
    google: 'google',
    discord: 'discord',
    slack: 'slack',
    telegram: 'telegram',
    twilio: 'twilio',
    sendgrid: 'sendgrid',
    resend: 'resend',
    aws: 'aws',
    cloudflare: 'cloudflare',
    digitalocean: 'digitalocean',
    railway: 'railway',
    planetscale: 'planetscale',
    mongodb: 'mongodb',
    redis: 'redis',
    figma: 'figma',
    notion: 'notion',
    linear: 'linear',
    jira: 'jira',
  };

  return mapping[accountProvider.toLowerCase()] || null;
}

// ============================================================================
// WHITE GLOVE SERVICE
// ============================================================================

class WhiteGloveServiceImpl {
  private sessions: Map<string, WhiteGloveSession> = new Map();

  /**
   * Start a white glove setup session
   */
  async startSession(
    userId: string,
    template: BuilderTemplate
  ): Promise<WhiteGloveSession> {
    const sessionId = crypto.randomUUID();

    const session: WhiteGloveSession = {
      id: sessionId,
      userId,
      templateId: template.id,
      status: 'analyzing',
      requiredIntegrations: [],
      connectedIntegrations: [],
      pendingIntegrations: [],
      configuredVariables: [],
      auditLog: [],
      startedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.addAuditLog(session, 'session_started', `White glove session started for template: ${template.name}`);

    try {
      // Step 1: Analyze template requirements
      session.requiredIntegrations = await this.analyzeRequirements(template);
      this.addAuditLog(
        session,
        'requirements_analyzed',
        `Found ${session.requiredIntegrations.length} integration requirements`
      );

      // Step 2: Check existing integrations
      const status = await this.checkIntegrationStatus(userId, session.requiredIntegrations);

      session.connectedIntegrations = status.connected
        .filter((i) => i.integrationId)
        .map((i) => i.integrationId!);
      session.pendingIntegrations = status.pending.map((i) => i.provider);

      if (status.allRequiredConnected) {
        session.status = 'integrations_ready';
        this.addAuditLog(session, 'integrations_ready', 'All required integrations are connected');
      } else {
        session.status = 'awaiting_integrations';
        this.addAuditLog(
          session,
          'awaiting_integrations',
          `Waiting for ${status.pending.length} integrations: ${status.pending.map((p) => p.provider).join(', ')}`
        );
      }

      return session;
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditLog(session, 'analysis_failed', session.error, false);
      throw error;
    }
  }

  /**
   * Analyze template requirements and map to integrations
   */
  async analyzeRequirements(template: BuilderTemplate): Promise<RequiredIntegration[]> {
    const requirements: RequiredIntegration[] = [];

    for (const accountReq of template.requirements.accounts) {
      const provider = mapAccountToProvider(accountReq.provider);

      if (provider) {
        const config = getIntegrationConfig(provider);
        requirements.push({
          provider,
          requirement: accountReq,
          required: accountReq.required,
          purpose: accountReq.purpose,
          providesVariables: PROVIDER_VARIABLE_MAP[provider] || [],
          status: 'pending',
        });
      } else {
        // Provider not supported for OAuth - mark as not available
        requirements.push({
          provider: accountReq.provider.toLowerCase() as IntegrationProvider,
          requirement: accountReq,
          required: accountReq.required,
          purpose: accountReq.purpose,
          providesVariables: [],
          status: 'not_available',
        });
      }
    }

    return requirements;
  }

  /**
   * Check which integrations are already connected
   */
  async checkIntegrationStatus(
    userId: string,
    requirements: RequiredIntegration[]
  ): Promise<IntegrationSetupStatus> {
    const userIntegrations = await integrationService.getUserIntegrations(userId);
    const connected: RequiredIntegration[] = [];
    const pending: RequiredIntegration[] = [];
    const notAvailable: RequiredIntegration[] = [];

    for (const req of requirements) {
      if (req.status === 'not_available') {
        notAvailable.push(req);
        continue;
      }

      const existingIntegration = userIntegrations.find(
        (i) => i.provider === req.provider && i.status === 'connected'
      );

      if (existingIntegration) {
        req.status = 'connected';
        req.integrationId = existingIntegration.id;
        connected.push(req);
      } else {
        req.status = 'pending';
        pending.push(req);
      }
    }

    const requiredPending = pending.filter((p) => p.required);

    return {
      allRequiredConnected: requiredPending.length === 0,
      connectedCount: connected.length,
      requiredCount: requirements.filter((r) => r.required).length,
      optionalCount: requirements.filter((r) => !r.required).length,
      connected,
      pending,
      notAvailable,
    };
  }

  /**
   * Refresh session status (call after user connects integrations)
   */
  async refreshSessionStatus(sessionId: string): Promise<IntegrationSetupStatus> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const status = await this.checkIntegrationStatus(
      session.userId,
      session.requiredIntegrations
    );

    session.connectedIntegrations = status.connected
      .filter((i) => i.integrationId)
      .map((i) => i.integrationId!);
    session.pendingIntegrations = status.pending.map((i) => i.provider);

    if (status.allRequiredConnected && session.status === 'awaiting_integrations') {
      session.status = 'integrations_ready';
      this.addAuditLog(session, 'integrations_ready', 'All required integrations are now connected');
    }

    return status;
  }

  /**
   * Wait for all required integrations to be connected
   */
  async waitForIntegrations(
    sessionId: string,
    timeoutMs: number = 300000, // 5 minutes
    pollIntervalMs: number = 2000
  ): Promise<IntegrationSetupStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.refreshSessionStatus(sessionId);

      if (status.allRequiredConnected) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Timeout waiting for integrations');
  }

  /**
   * Extract credentials from connected integrations
   */
  async extractCredentials(sessionId: string): Promise<CredentialExtractionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, credentials: {}, missingVariables: [], error: 'Session not found' };
    }

    if (session.status !== 'integrations_ready') {
      return {
        success: false,
        credentials: {},
        missingVariables: [],
        error: 'Not all required integrations are connected',
      };
    }

    session.status = 'configuring_environment';
    this.addAuditLog(session, 'extracting_credentials', 'Extracting credentials from integrations');

    const credentials: Record<string, string> = {};
    const missingVariables: string[] = [];

    for (const req of session.requiredIntegrations) {
      if (req.status !== 'connected' || !req.integrationId) {
        if (req.required) {
          missingVariables.push(...req.providesVariables);
        }
        continue;
      }

      try {
        // Get the access token/API key from the integration
        const token = await integrationService.getAccessToken(req.integrationId);

        if (token) {
          // Map token to appropriate environment variables
          const vars = await this.mapTokenToVariables(req.provider, token, req.integrationId);
          Object.assign(credentials, vars);

          this.addAuditLog(
            session,
            'credentials_extracted',
            `Extracted credentials for ${req.provider}`,
            true,
            req.provider
          );
        } else {
          this.addAuditLog(
            session,
            'credential_extraction_failed',
            `Failed to get token for ${req.provider}`,
            false,
            req.provider
          );
          if (req.required) {
            missingVariables.push(...req.providesVariables);
          }
        }
      } catch (error) {
        this.addAuditLog(
          session,
          'credential_extraction_error',
          error instanceof Error ? error.message : 'Unknown error',
          false,
          req.provider
        );
        if (req.required) {
          missingVariables.push(...req.providesVariables);
        }
      }
    }

    session.configuredVariables = Object.keys(credentials);

    if (missingVariables.length > 0) {
      return {
        success: false,
        credentials,
        missingVariables,
        error: `Missing required variables: ${missingVariables.join(', ')}`,
      };
    }

    return { success: true, credentials, missingVariables: [] };
  }

  /**
   * Map integration token to environment variables
   */
  private async mapTokenToVariables(
    provider: IntegrationProvider,
    token: string,
    integrationId: string
  ): Promise<Record<string, string>> {
    const vars: Record<string, string> = {};
    const integration = await integrationService.getIntegrationById(integrationId);

    switch (provider) {
      case 'supabase':
        // For Supabase, we need project info from metadata
        if (integration?.metadata?.extra?.projectRef) {
          vars['NEXT_PUBLIC_SUPABASE_URL'] = `https://${integration.metadata.extra.projectRef}.supabase.co`;
        }
        vars['SUPABASE_SERVICE_ROLE_KEY'] = token;
        // Anon key would need to be fetched from Supabase Management API
        break;

      case 'openai':
        vars['OPENAI_API_KEY'] = token;
        break;

      case 'anthropic':
        vars['ANTHROPIC_API_KEY'] = token;
        break;

      case 'stripe':
        // Stripe OAuth returns a restricted API key
        vars['STRIPE_SECRET_KEY'] = token;
        break;

      case 'github':
        vars['GITHUB_TOKEN'] = token;
        break;

      case 'vercel':
        vars['VERCEL_TOKEN'] = token;
        break;

      case 'resend':
        vars['RESEND_API_KEY'] = token;
        break;

      case 'telegram':
        vars['TELEGRAM_BOT_TOKEN'] = token;
        break;

      case 'discord':
        vars['DISCORD_BOT_TOKEN'] = token;
        if (integration?.metadata?.extra?.clientId) {
          vars['DISCORD_CLIENT_ID'] = integration.metadata.extra.clientId as string;
        }
        break;

      case 'slack':
        vars['SLACK_BOT_TOKEN'] = token;
        break;

      case 'twilio':
        vars['TWILIO_AUTH_TOKEN'] = token;
        if (integration?.metadata?.accountId) {
          vars['TWILIO_ACCOUNT_SID'] = integration.metadata.accountId;
        }
        break;

      case 'sendgrid':
        vars['SENDGRID_API_KEY'] = token;
        break;

      case 'aws':
        // AWS OAuth would provide temporary credentials
        vars['AWS_ACCESS_KEY_ID'] = token;
        // Secret would need separate handling
        break;

      case 'cloudflare':
        vars['CLOUDFLARE_API_TOKEN'] = token;
        break;

      case 'notion':
        vars['NOTION_API_KEY'] = token;
        break;

      case 'figma':
        vars['FIGMA_ACCESS_TOKEN'] = token;
        break;

      case 'linear':
        vars['LINEAR_API_KEY'] = token;
        break;

      default:
        // Generic mapping - use the main variable from the provider map
        const mainVars = PROVIDER_VARIABLE_MAP[provider];
        if (mainVars && mainVars.length > 0) {
          vars[mainVars[0]] = token;
        }
    }

    return vars;
  }

  /**
   * Configure environment and prepare for build
   */
  async configureEnvironment(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const result = await this.extractCredentials(sessionId);
    if (!result.success) {
      session.status = 'failed';
      session.error = result.error;
      return false;
    }

    // Store credentials securely
    const credentialEntries = Object.entries(result.credentials).map(([key, value]) => ({
      key,
      value,
      sensitive:
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('password'),
    }));

    await secureVariableStorage.storeVariables(sessionId, session.templateId, credentialEntries);

    session.status = 'starting_build';
    this.addAuditLog(
      session,
      'environment_configured',
      `Configured ${credentialEntries.length} environment variables`
    );

    return true;
  }

  /**
   * Get OAuth URL for a pending integration
   */
  async getOAuthUrl(
    sessionId: string,
    provider: IntegrationProvider,
    redirectUri: string
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const config = getIntegrationConfig(provider);
    if (config.authMethod !== 'oauth2') {
      throw new Error(`Provider ${provider} does not support OAuth`);
    }

    const result = await integrationService.startOAuthFlow(session.userId, provider, redirectUri);
    return result.authUrl;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): WhiteGloveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all credentials for a session as environment variables
   */
  async getSessionCredentials(sessionId: string): Promise<Record<string, string>> {
    return await secureVariableStorage.getVariablesAsEnv(sessionId);
  }

  /**
   * Mark session as building
   */
  markAsBuilding(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'building';
      this.addAuditLog(session, 'build_started', 'Build process initiated');
    }
  }

  /**
   * Mark session as completed
   */
  markAsCompleted(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.completedAt = new Date();
      this.addAuditLog(session, 'build_completed', 'White glove setup completed successfully');
    }
  }

  /**
   * Get audit log for a session
   */
  getAuditLog(sessionId: string): AuditLogEntry[] {
    const session = this.sessions.get(sessionId);
    return session?.auditLog || [];
  }

  /**
   * Clean up session data
   */
  async cleanupSession(sessionId: string): Promise<void> {
    await secureVariableStorage.clearVariables(sessionId);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.configuredVariables = [];
      this.addAuditLog(session, 'session_cleaned', 'Session credentials cleared');
    }
  }

  /**
   * Get integration requirements for a template (without starting a session)
   */
  async previewRequirements(template: BuilderTemplate): Promise<RequiredIntegration[]> {
    return await this.analyzeRequirements(template);
  }

  /**
   * Get setup instructions for a provider that doesn't support OAuth
   */
  getManualSetupInstructions(provider: string): string {
    const instructions: Record<string, string> = {
      stripe: `
1. Go to https://dashboard.stripe.com/register and create an account
2. Verify your email and complete the onboarding
3. Go to Developers > API Keys
4. Copy your Publishable key and Secret key
5. For webhooks, go to Developers > Webhooks and create an endpoint
      `.trim(),
      openai: `
1. Go to https://platform.openai.com/signup and create an account
2. Add a payment method at https://platform.openai.com/account/billing
3. Go to https://platform.openai.com/api-keys
4. Create a new API key and copy it
      `.trim(),
      anthropic: `
1. Go to https://console.anthropic.com and create an account
2. Add a payment method in Settings > Billing
3. Go to Settings > API Keys
4. Create a new API key and copy it
      `.trim(),
      telegram: `
1. Open Telegram and search for @BotFather
2. Send /newbot and follow the prompts
3. Choose a name and username for your bot
4. Copy the bot token provided
      `.trim(),
    };

    return instructions[provider.toLowerCase()] || `Please create an account at the ${provider} website and obtain your API credentials.`;
  }

  /**
   * Add entry to audit log
   */
  private addAuditLog(
    session: WhiteGloveSession,
    action: string,
    details: string,
    success: boolean = true,
    provider?: string
  ): void {
    session.auditLog.push({
      timestamp: new Date(),
      action,
      details,
      success,
      provider,
    });
  }
}

// Export singleton instance
export const whiteGloveService = new WhiteGloveServiceImpl();

// Export class for testing
export { WhiteGloveServiceImpl };
