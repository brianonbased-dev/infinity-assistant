/**
 * Builder Templates & Requirements
 *
 * Comprehensive template definitions for Infinity Builder.
 * Each template includes:
 * - Required accounts to create
 * - Environment variables needed
 * - Estimated token usage
 * - Setup checklist
 *
 * User provides all credentials upfront → Assistant configures everything →
 * Orchestration handles the build autonomously.
 */

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string; // emoji
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTokens: TokenEstimate;
  requirements: TemplateRequirements;
  features: string[];
  techStack: TechStackInfo;
  estimatedBuildTime: string; // e.g., "5-10 minutes"
}

export type TemplateCategory =
  | 'web_app'
  | 'mobile'
  | 'api'
  | 'bot'
  | 'automation'
  | 'ecommerce'
  | 'content'
  | 'analytics'
  | 'game'
  | 'research'
  | 'social'
  | 'productivity';

export interface TokenEstimate {
  minimum: number;
  typical: number;
  maximum: number;
  breakdown: {
    planning: number;
    building: number;
    testing: number;
    deployment: number;
  };
}

export interface TemplateRequirements {
  accounts: AccountRequirement[];
  variables: VariableRequirement[];
  optional: OptionalRequirement[];
}

export interface AccountRequirement {
  id: string;
  name: string;
  provider: string;
  signupUrl: string;
  description: string;
  purpose?: string; // Short explanation of why this account is needed
  required: boolean;
  freeAvailable: boolean;
  instructions: string[];
  whatYouNeed: string[]; // e.g., ["API Key", "Project ID"]
}

export interface VariableRequirement {
  id: string;
  name: string;
  key: string; // ENV variable name like SUPABASE_URL
  type: 'text' | 'password' | 'url' | 'email' | 'number' | 'select';
  placeholder?: string;
  description: string;
  required: boolean;
  sensitive: boolean; // If true, stored encrypted
  validation?: string; // regex pattern
  options?: string[]; // for select type
  relatedAccount?: string; // links to account requirement
}

export interface OptionalRequirement {
  id: string;
  name: string;
  description: string;
  enabledByDefault: boolean;
  additionalTokens: number;
  variables?: VariableRequirement[];
  accounts?: AccountRequirement[];
}

export interface TechStackInfo {
  frontend: string[];
  backend: string[];
  database: string[];
  hosting: string[];
  integrations: string[];
}

// ============================================================================
// COMMON ACCOUNT PROVIDERS
// ============================================================================

export const COMMON_ACCOUNTS: Record<string, Omit<AccountRequirement, 'id' | 'required'>> = {
  supabase: {
    name: 'Supabase',
    provider: 'Supabase',
    signupUrl: 'https://supabase.com',
    description: 'Database, authentication, and storage',
    freeAvailable: true,
    instructions: [
      'Go to supabase.com and create an account',
      'Create a new project',
      'Go to Settings → API',
      'Copy the URL and anon key',
    ],
    whatYouNeed: ['Project URL', 'Anon Key', 'Service Role Key (optional)'],
  },
  vercel: {
    name: 'Vercel',
    provider: 'Vercel',
    signupUrl: 'https://vercel.com',
    description: 'Hosting and deployment',
    freeAvailable: true,
    instructions: [
      'Go to vercel.com and create an account',
      'Connect your GitHub account',
      'No API key needed for basic deployment',
    ],
    whatYouNeed: ['Account only (GitHub connected)'],
  },
  stripe: {
    name: 'Stripe',
    provider: 'Stripe',
    signupUrl: 'https://stripe.com',
    description: 'Payment processing',
    freeAvailable: true,
    instructions: [
      'Go to stripe.com and create an account',
      'Complete business verification',
      'Go to Developers → API keys',
      'Copy publishable and secret keys',
    ],
    whatYouNeed: ['Publishable Key', 'Secret Key', 'Webhook Secret'],
  },
  openai: {
    name: 'OpenAI',
    provider: 'OpenAI',
    signupUrl: 'https://platform.openai.com',
    description: 'AI/LLM capabilities',
    freeAvailable: false,
    instructions: [
      'Go to platform.openai.com',
      'Create an account and add payment method',
      'Go to API keys section',
      'Create a new API key',
    ],
    whatYouNeed: ['API Key'],
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    provider: 'Anthropic',
    signupUrl: 'https://console.anthropic.com',
    description: 'Claude AI capabilities',
    freeAvailable: false,
    instructions: [
      'Go to console.anthropic.com',
      'Create an account and add payment method',
      'Go to API keys section',
      'Create a new API key',
    ],
    whatYouNeed: ['API Key'],
  },
  telegram: {
    name: 'Telegram Bot',
    provider: 'Telegram',
    signupUrl: 'https://t.me/BotFather',
    description: 'Telegram bot integration',
    freeAvailable: true,
    instructions: [
      'Open Telegram and search for @BotFather',
      'Send /newbot command',
      'Follow the prompts to create your bot',
      'Copy the bot token provided',
    ],
    whatYouNeed: ['Bot Token'],
  },
  discord: {
    name: 'Discord Bot',
    provider: 'Discord',
    signupUrl: 'https://discord.com/developers/applications',
    description: 'Discord bot integration',
    freeAvailable: true,
    instructions: [
      'Go to Discord Developer Portal',
      'Create a new application',
      'Go to Bot section and create a bot',
      'Copy the bot token',
      'Enable required intents',
    ],
    whatYouNeed: ['Bot Token', 'Client ID', 'Client Secret (optional)'],
  },
  github: {
    name: 'GitHub',
    provider: 'GitHub',
    signupUrl: 'https://github.com',
    description: 'Code repository and version control',
    freeAvailable: true,
    instructions: [
      'Go to github.com and create an account',
      'Go to Settings → Developer settings → Personal access tokens',
      'Generate a new token with repo permissions',
    ],
    whatYouNeed: ['Personal Access Token'],
  },
  sendgrid: {
    name: 'SendGrid',
    provider: 'Twilio SendGrid',
    signupUrl: 'https://sendgrid.com',
    description: 'Email sending service',
    freeAvailable: true,
    instructions: [
      'Go to sendgrid.com and create an account',
      'Verify your sender identity',
      'Go to Settings → API Keys',
      'Create an API key with Mail Send permissions',
    ],
    whatYouNeed: ['API Key', 'Verified Sender Email'],
  },
  twilio: {
    name: 'Twilio',
    provider: 'Twilio',
    signupUrl: 'https://twilio.com',
    description: 'SMS and voice capabilities',
    freeAvailable: true,
    instructions: [
      'Go to twilio.com and create an account',
      'Get a phone number',
      'Find Account SID and Auth Token in Console',
    ],
    whatYouNeed: ['Account SID', 'Auth Token', 'Phone Number'],
  },
  aws: {
    name: 'AWS',
    provider: 'Amazon Web Services',
    signupUrl: 'https://aws.amazon.com',
    description: 'Cloud infrastructure',
    freeAvailable: true,
    instructions: [
      'Go to aws.amazon.com and create an account',
      'Go to IAM and create a new user',
      'Attach required policies',
      'Generate access keys',
    ],
    whatYouNeed: ['Access Key ID', 'Secret Access Key', 'Region'],
  },
  google: {
    name: 'Google Cloud',
    provider: 'Google',
    signupUrl: 'https://console.cloud.google.com',
    description: 'Google services (Maps, OAuth, etc.)',
    freeAvailable: true,
    instructions: [
      'Go to Google Cloud Console',
      'Create a new project',
      'Enable required APIs',
      'Create credentials (API key or OAuth)',
    ],
    whatYouNeed: ['API Key', 'Client ID (for OAuth)', 'Client Secret (for OAuth)'],
  },
  resend: {
    name: 'Resend',
    provider: 'Resend',
    signupUrl: 'https://resend.com',
    description: 'Modern email API',
    freeAvailable: true,
    instructions: [
      'Go to resend.com and create an account',
      'Verify your domain or use their testing domain',
      'Go to API Keys and create a new key',
    ],
    whatYouNeed: ['API Key'],
  },
};

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  // =========== WEB APPS ===========
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'Task management with user auth, categories, and reminders',
    category: 'productivity',
    icon: '✅',
    difficulty: 'beginner',
    estimatedTokens: {
      minimum: 20,
      typical: 35,
      maximum: 50,
      breakdown: { planning: 5, building: 20, testing: 5, deployment: 5 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
        { ...COMMON_ACCOUNTS.vercel, id: 'vercel', required: false },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          placeholder: 'https://xxx.supabase.co',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
      ],
      optional: [
        {
          id: 'email_reminders',
          name: 'Email Reminders',
          description: 'Send task reminder emails',
          enabledByDefault: false,
          additionalTokens: 10,
          accounts: [{ ...COMMON_ACCOUNTS.resend, id: 'resend', required: true }],
          variables: [
            {
              id: 'resend_api_key',
              name: 'Resend API Key',
              key: 'RESEND_API_KEY',
              type: 'password',
              description: 'API key for sending emails',
              required: true,
              sensitive: true,
              relatedAccount: 'resend',
            },
          ],
        },
      ],
    },
    features: [
      'User authentication',
      'Create, edit, delete tasks',
      'Task categories and tags',
      'Due dates and priorities',
      'Search and filter',
      'Dark/light mode',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS'],
      backend: ['Supabase'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: [],
    },
    estimatedBuildTime: '5-8 minutes',
  },

  // =========== E-COMMERCE ===========
  {
    id: 'ecommerce-store',
    name: 'E-Commerce Store',
    description: 'Full online store with products, cart, checkout, and payments',
    category: 'ecommerce',
    icon: '🛒',
    difficulty: 'intermediate',
    estimatedTokens: {
      minimum: 60,
      typical: 85,
      maximum: 120,
      breakdown: { planning: 15, building: 50, testing: 10, deployment: 10 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
        { ...COMMON_ACCOUNTS.stripe, id: 'stripe', required: true },
        { ...COMMON_ACCOUNTS.vercel, id: 'vercel', required: false },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          placeholder: 'https://xxx.supabase.co',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
        {
          id: 'stripe_publishable',
          name: 'Stripe Publishable Key',
          key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
          type: 'text',
          placeholder: 'pk_test_...',
          description: 'Stripe publishable key (starts with pk_)',
          required: true,
          sensitive: false,
          relatedAccount: 'stripe',
        },
        {
          id: 'stripe_secret',
          name: 'Stripe Secret Key',
          key: 'STRIPE_SECRET_KEY',
          type: 'password',
          placeholder: 'sk_test_...',
          description: 'Stripe secret key (starts with sk_)',
          required: true,
          sensitive: true,
          relatedAccount: 'stripe',
        },
        {
          id: 'stripe_webhook',
          name: 'Stripe Webhook Secret',
          key: 'STRIPE_WEBHOOK_SECRET',
          type: 'password',
          placeholder: 'whsec_...',
          description: 'Stripe webhook signing secret',
          required: true,
          sensitive: true,
          relatedAccount: 'stripe',
        },
      ],
      optional: [
        {
          id: 'email_notifications',
          name: 'Order Email Notifications',
          description: 'Send order confirmations and updates',
          enabledByDefault: true,
          additionalTokens: 8,
          accounts: [{ ...COMMON_ACCOUNTS.resend, id: 'resend', required: true }],
        },
      ],
    },
    features: [
      'Product catalog with categories',
      'Shopping cart',
      'Secure checkout with Stripe',
      'Order history',
      'User accounts',
      'Admin dashboard',
      'Inventory management',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS'],
      backend: ['Supabase', 'Stripe'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: ['Stripe Payments'],
    },
    estimatedBuildTime: '15-25 minutes',
  },

  // =========== TELEGRAM BOT ===========
  {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    description: 'AI-powered Telegram bot with custom commands and responses',
    category: 'bot',
    icon: '🤖',
    difficulty: 'intermediate',
    estimatedTokens: {
      minimum: 40,
      typical: 55,
      maximum: 80,
      breakdown: { planning: 10, building: 30, testing: 10, deployment: 5 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.telegram, id: 'telegram', required: true },
        { ...COMMON_ACCOUNTS.openai, id: 'openai', required: false },
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: false },
      ],
      variables: [
        {
          id: 'telegram_token',
          name: 'Telegram Bot Token',
          key: 'TELEGRAM_BOT_TOKEN',
          type: 'password',
          placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
          description: 'Token from @BotFather',
          required: true,
          sensitive: true,
          relatedAccount: 'telegram',
        },
        {
          id: 'bot_username',
          name: 'Bot Username',
          key: 'TELEGRAM_BOT_USERNAME',
          type: 'text',
          placeholder: 'my_awesome_bot',
          description: 'Your bot username (without @)',
          required: true,
          sensitive: false,
          relatedAccount: 'telegram',
        },
      ],
      optional: [
        {
          id: 'ai_responses',
          name: 'AI-Powered Responses',
          description: 'Use OpenAI for intelligent responses',
          enabledByDefault: true,
          additionalTokens: 15,
          accounts: [{ ...COMMON_ACCOUNTS.openai, id: 'openai', required: true }],
          variables: [
            {
              id: 'openai_key',
              name: 'OpenAI API Key',
              key: 'OPENAI_API_KEY',
              type: 'password',
              placeholder: 'sk-...',
              description: 'Your OpenAI API key',
              required: true,
              sensitive: true,
              relatedAccount: 'openai',
            },
          ],
        },
        {
          id: 'user_memory',
          name: 'User Memory',
          description: 'Remember user preferences and history',
          enabledByDefault: false,
          additionalTokens: 10,
          accounts: [{ ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true }],
        },
      ],
    },
    features: [
      'Custom commands',
      'AI-powered responses (optional)',
      'User conversation history',
      'Inline keyboards',
      'Media handling',
      'Webhook deployment',
    ],
    techStack: {
      frontend: [],
      backend: ['Node.js', 'grammy/telegraf'],
      database: ['Supabase (optional)'],
      hosting: ['Railway', 'Vercel'],
      integrations: ['Telegram API', 'OpenAI (optional)'],
    },
    estimatedBuildTime: '10-15 minutes',
  },

  // =========== BLOG PLATFORM ===========
  {
    id: 'blog-platform',
    name: 'Blog Platform',
    description: 'Markdown blog with comments, tags, and author profiles',
    category: 'content',
    icon: '📝',
    difficulty: 'beginner',
    estimatedTokens: {
      minimum: 45,
      typical: 65,
      maximum: 90,
      breakdown: { planning: 10, building: 40, testing: 8, deployment: 7 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
        { ...COMMON_ACCOUNTS.vercel, id: 'vercel', required: false },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
        {
          id: 'site_name',
          name: 'Blog Name',
          key: 'NEXT_PUBLIC_SITE_NAME',
          type: 'text',
          placeholder: 'My Awesome Blog',
          description: 'Your blog name',
          required: true,
          sensitive: false,
        },
      ],
      optional: [],
    },
    features: [
      'Markdown editor',
      'Post categories and tags',
      'Comment system',
      'Author profiles',
      'SEO optimization',
      'RSS feed',
      'Search functionality',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS', 'MDX'],
      backend: ['Supabase'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: [],
    },
    estimatedBuildTime: '10-15 minutes',
  },

  // =========== RESEARCH ASSISTANT ===========
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'AI-powered research tool with web search and knowledge base',
    category: 'research',
    icon: '🔬',
    difficulty: 'advanced',
    estimatedTokens: {
      minimum: 70,
      typical: 100,
      maximum: 150,
      breakdown: { planning: 20, building: 55, testing: 15, deployment: 10 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.openai, id: 'openai', required: true },
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
      ],
      variables: [
        {
          id: 'openai_key',
          name: 'OpenAI API Key',
          key: 'OPENAI_API_KEY',
          type: 'password',
          description: 'Your OpenAI API key',
          required: true,
          sensitive: true,
          relatedAccount: 'openai',
        },
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
      ],
      optional: [
        {
          id: 'web_search',
          name: 'Web Search',
          description: 'Enable real-time web search',
          enabledByDefault: true,
          additionalTokens: 15,
        },
      ],
    },
    features: [
      'AI-powered research',
      'Knowledge base storage',
      'Source tracking',
      'Export to various formats',
      'Collaboration features',
      'Citation management',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS'],
      backend: ['Supabase', 'OpenAI'],
      database: ['PostgreSQL with pgvector'],
      hosting: ['Vercel'],
      integrations: ['OpenAI', 'Web Search API'],
    },
    estimatedBuildTime: '20-30 minutes',
  },

  // =========== MOBILE APP (PWA) ===========
  {
    id: 'mobile-pwa',
    name: 'Mobile App (PWA)',
    description: 'Progressive Web App that works on iOS and Android',
    category: 'mobile',
    icon: '📱',
    difficulty: 'intermediate',
    estimatedTokens: {
      minimum: 50,
      typical: 75,
      maximum: 100,
      breakdown: { planning: 15, building: 40, testing: 12, deployment: 8 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
        { ...COMMON_ACCOUNTS.vercel, id: 'vercel', required: false },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
        {
          id: 'app_name',
          name: 'App Name',
          key: 'NEXT_PUBLIC_APP_NAME',
          type: 'text',
          placeholder: 'My App',
          description: 'Name shown on home screen',
          required: true,
          sensitive: false,
        },
      ],
      optional: [
        {
          id: 'push_notifications',
          name: 'Push Notifications',
          description: 'Send push notifications to users',
          enabledByDefault: false,
          additionalTokens: 12,
        },
      ],
    },
    features: [
      'Works offline',
      'Install on home screen',
      'Push notifications (optional)',
      'Camera access',
      'Geolocation',
      'Native app feel',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS', 'PWA'],
      backend: ['Supabase'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: ['Web Push API'],
    },
    estimatedBuildTime: '12-20 minutes',
  },

  // =========== GAME ===========
  {
    id: 'web-game',
    name: 'Web Game',
    description: 'Browser-based game with leaderboards and achievements',
    category: 'game',
    icon: '🎮',
    difficulty: 'intermediate',
    estimatedTokens: {
      minimum: 55,
      typical: 80,
      maximum: 120,
      breakdown: { planning: 15, building: 45, testing: 12, deployment: 8 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
        {
          id: 'game_name',
          name: 'Game Name',
          key: 'NEXT_PUBLIC_GAME_NAME',
          type: 'text',
          placeholder: 'My Awesome Game',
          description: 'Name of your game',
          required: true,
          sensitive: false,
        },
      ],
      optional: [],
    },
    features: [
      'Game mechanics',
      'Scoring system',
      'Leaderboards',
      'Achievements',
      'User profiles',
      'Sound effects',
      'Mobile responsive',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Canvas/WebGL', 'Tailwind CSS'],
      backend: ['Supabase'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: [],
    },
    estimatedBuildTime: '15-25 minutes',
  },

  // =========== DISCORD BOT ===========
  {
    id: 'discord-bot',
    name: 'Discord Bot',
    description: 'Feature-rich Discord bot with commands and moderation',
    category: 'bot',
    icon: '🎮',
    difficulty: 'intermediate',
    estimatedTokens: {
      minimum: 45,
      typical: 65,
      maximum: 90,
      breakdown: { planning: 12, building: 35, testing: 10, deployment: 8 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.discord, id: 'discord', required: true },
      ],
      variables: [
        {
          id: 'discord_token',
          name: 'Discord Bot Token',
          key: 'DISCORD_BOT_TOKEN',
          type: 'password',
          description: 'Your Discord bot token',
          required: true,
          sensitive: true,
          relatedAccount: 'discord',
        },
        {
          id: 'discord_client_id',
          name: 'Discord Client ID',
          key: 'DISCORD_CLIENT_ID',
          type: 'text',
          description: 'Your Discord application client ID',
          required: true,
          sensitive: false,
          relatedAccount: 'discord',
        },
      ],
      optional: [
        {
          id: 'ai_chat',
          name: 'AI Chat',
          description: 'Enable AI-powered conversations',
          enabledByDefault: false,
          additionalTokens: 15,
          accounts: [{ ...COMMON_ACCOUNTS.openai, id: 'openai', required: true }],
        },
      ],
    },
    features: [
      'Slash commands',
      'Moderation tools',
      'Welcome messages',
      'Role management',
      'Music playback (optional)',
      'Server stats',
    ],
    techStack: {
      frontend: [],
      backend: ['Node.js', 'discord.js'],
      database: ['Supabase (optional)'],
      hosting: ['Railway', 'Fly.io'],
      integrations: ['Discord API'],
    },
    estimatedBuildTime: '12-18 minutes',
  },

  // =========== AUTOMATION WORKFLOW ===========
  {
    id: 'automation-workflow',
    name: 'Automation Workflow',
    description: 'Automated workflows with triggers and actions',
    category: 'automation',
    icon: '⚡',
    difficulty: 'advanced',
    estimatedTokens: {
      minimum: 60,
      typical: 90,
      maximum: 130,
      breakdown: { planning: 20, building: 50, testing: 12, deployment: 8 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
      ],
      optional: [
        {
          id: 'email_actions',
          name: 'Email Actions',
          description: 'Send emails as workflow actions',
          enabledByDefault: false,
          additionalTokens: 8,
          accounts: [{ ...COMMON_ACCOUNTS.resend, id: 'resend', required: true }],
        },
        {
          id: 'webhook_triggers',
          name: 'Webhook Triggers',
          description: 'Trigger workflows from external services',
          enabledByDefault: true,
          additionalTokens: 5,
        },
      ],
    },
    features: [
      'Visual workflow builder',
      'Trigger conditions',
      'Multiple action types',
      'Scheduling',
      'Logging and history',
      'Error handling',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS'],
      backend: ['Supabase', 'Edge Functions'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: ['Webhooks', 'Cron'],
    },
    estimatedBuildTime: '20-30 minutes',
  },

  // =========== SOCIAL MEDIA DASHBOARD ===========
  {
    id: 'social-dashboard',
    name: 'Social Media Dashboard',
    description: 'Manage and schedule posts across social platforms',
    category: 'social',
    icon: '📊',
    difficulty: 'advanced',
    estimatedTokens: {
      minimum: 75,
      typical: 110,
      maximum: 150,
      breakdown: { planning: 25, building: 60, testing: 15, deployment: 10 },
    },
    requirements: {
      accounts: [
        { ...COMMON_ACCOUNTS.supabase, id: 'supabase', required: true },
      ],
      variables: [
        {
          id: 'supabase_url',
          name: 'Supabase URL',
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          type: 'url',
          description: 'Your Supabase project URL',
          required: true,
          sensitive: false,
          relatedAccount: 'supabase',
        },
        {
          id: 'supabase_anon_key',
          name: 'Supabase Anon Key',
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          type: 'password',
          description: 'Your Supabase anonymous key',
          required: true,
          sensitive: true,
          relatedAccount: 'supabase',
        },
      ],
      optional: [
        {
          id: 'ai_captions',
          name: 'AI Caption Generation',
          description: 'Generate captions with AI',
          enabledByDefault: true,
          additionalTokens: 12,
          accounts: [{ ...COMMON_ACCOUNTS.openai, id: 'openai', required: true }],
        },
      ],
    },
    features: [
      'Post scheduling',
      'Multi-platform support',
      'Analytics dashboard',
      'Content calendar',
      'AI caption suggestions',
      'Team collaboration',
    ],
    techStack: {
      frontend: ['Next.js', 'React', 'Tailwind CSS', 'Charts'],
      backend: ['Supabase'],
      database: ['PostgreSQL (Supabase)'],
      hosting: ['Vercel'],
      integrations: ['Social Media APIs'],
    },
    estimatedBuildTime: '25-35 minutes',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTemplateById(id: string): BuilderTemplate | undefined {
  return BUILDER_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): BuilderTemplate[] {
  return BUILDER_TEMPLATES.filter((t) => t.category === category);
}

export function calculateTotalTokens(
  template: BuilderTemplate,
  enabledOptionals: string[]
): number {
  let total = template.estimatedTokens.typical;

  for (const optional of template.requirements.optional) {
    if (enabledOptionals.includes(optional.id)) {
      total += optional.additionalTokens;
    }
  }

  return total;
}

export function getAllRequiredAccounts(
  template: BuilderTemplate,
  enabledOptionals: string[]
): AccountRequirement[] {
  const accounts = [...template.requirements.accounts.filter((a) => a.required)];

  for (const optional of template.requirements.optional) {
    if (enabledOptionals.includes(optional.id) && optional.accounts) {
      accounts.push(...optional.accounts.filter((a) => a.required));
    }
  }

  // Remove duplicates
  return accounts.filter(
    (account, index, self) =>
      index === self.findIndex((a) => a.id === account.id)
  );
}

export function getAllRequiredVariables(
  template: BuilderTemplate,
  enabledOptionals: string[]
): VariableRequirement[] {
  const variables = [...template.requirements.variables.filter((v) => v.required)];

  for (const optional of template.requirements.optional) {
    if (enabledOptionals.includes(optional.id) && optional.variables) {
      variables.push(...optional.variables.filter((v) => v.required));
    }
  }

  return variables;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; name: string; icon: string }[] = [
  { id: 'web_app', name: 'Web Apps', icon: '🌐' },
  { id: 'mobile', name: 'Mobile', icon: '📱' },
  { id: 'bot', name: 'Bots', icon: '🤖' },
  { id: 'ecommerce', name: 'E-Commerce', icon: '🛒' },
  { id: 'content', name: 'Content', icon: '📝' },
  { id: 'automation', name: 'Automation', icon: '⚡' },
  { id: 'game', name: 'Games', icon: '🎮' },
  { id: 'research', name: 'Research', icon: '🔬' },
  { id: 'social', name: 'Social', icon: '📊' },
  { id: 'productivity', name: 'Productivity', icon: '✅' },
  { id: 'analytics', name: 'Analytics', icon: '📈' },
  { id: 'api', name: 'APIs', icon: '🔌' },
];
