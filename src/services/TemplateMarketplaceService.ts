/**
 * Template Marketplace Service
 *
 * Provides pre-built project templates, community sharing, ratings,
 * and one-click cloning for rapid project bootstrapping.
 */

// ============================================================================
// Types
// ============================================================================

export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  category: TemplateCategory;
  tags: string[];
  author: TemplateAuthor;
  version: string;
  pricing: TemplatePricing;
  thumbnail?: string;
  screenshots: string[];
  demoUrl?: string;
  repositoryUrl?: string;
  stats: TemplateStats;
  files: TemplateFile[];
  dependencies: TemplateDependency[];
  requirements: TemplateRequirements;
  configuration: TemplateConfiguration;
  metadata: Record<string, unknown>;
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateCategory =
  | 'web-app'
  | 'mobile-app'
  | 'api-backend'
  | 'landing-page'
  | 'dashboard'
  | 'e-commerce'
  | 'saas'
  | 'portfolio'
  | 'blog'
  | 'documentation'
  | 'starter-kit'
  | 'component-library'
  | 'ai-ml'
  | 'data-pipeline'
  | 'devops'
  | 'other';

export interface TemplateAuthor {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  verified: boolean;
  totalTemplates: number;
  totalDownloads: number;
}

export interface TemplatePricing {
  type: 'free' | 'paid' | 'subscription';
  price?: number; // In cents
  currency?: string;
  subscriptionId?: string;
}

export interface TemplateStats {
  views: number;
  downloads: number;
  clones: number;
  stars: number;
  forks: number;
  rating: number;
  reviewCount: number;
}

export interface TemplateFile {
  path: string;
  content: string;
  isTemplate: boolean; // Contains placeholders like {{PROJECT_NAME}}
  encoding?: 'utf-8' | 'base64';
}

export interface TemplateDependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer' | 'optional';
  package: 'npm' | 'pip' | 'cargo' | 'go' | 'composer';
}

export interface TemplateRequirements {
  minNodeVersion?: string;
  minPythonVersion?: string;
  services?: ('database' | 'redis' | 'storage' | 'auth' | 'email')[];
  envVars?: TemplateEnvVar[];
}

export interface TemplateEnvVar {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}

export interface TemplateConfiguration {
  variables: TemplateVariable[];
  postInstallSteps?: string[];
  scripts?: Record<string, string>;
}

export interface TemplateVariable {
  name: string;
  displayName: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
  defaultValue?: string | number | boolean;
  required: boolean;
  validation?: string; // Regex pattern
}

export interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1-5
  title: string;
  content: string;
  helpful: number;
  verified: boolean; // Verified purchase/download
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateCollection {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnail?: string;
  templates: string[]; // Template IDs
  curatedBy: string; // User ID or 'system'
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneRequest {
  templateId: string;
  projectName: string;
  projectDescription?: string;
  variables: Record<string, string | number | boolean>;
  targetPath?: string;
  initGit?: boolean;
  installDependencies?: boolean;
}

export interface CloneResult {
  success: boolean;
  projectId: string;
  projectPath: string;
  filesCreated: number;
  warnings: string[];
  postInstallInstructions?: string[];
}

export interface TemplateSubmission {
  name: string;
  description: string;
  longDescription?: string;
  category: TemplateCategory;
  tags: string[];
  pricing: TemplatePricing;
  files: TemplateFile[];
  thumbnail?: string;
  screenshots?: string[];
  demoUrl?: string;
  repositoryUrl?: string;
  dependencies?: TemplateDependency[];
  requirements?: TemplateRequirements;
  configuration?: TemplateConfiguration;
}

export interface SearchFilters {
  category?: TemplateCategory;
  tags?: string[];
  pricing?: 'free' | 'paid' | 'all';
  minRating?: number;
  sortBy?: 'popular' | 'recent' | 'rating' | 'downloads';
  author?: string;
}

export interface SearchResult {
  templates: Template[];
  total: number;
  page: number;
  pageSize: number;
  filters: SearchFilters;
}

// ============================================================================
// Template Repository
// ============================================================================

class TemplateRepository {
  private templates: Map<string, Template> = new Map();
  private reviews: Map<string, TemplateReview[]> = new Map();
  private collections: Map<string, TemplateCollection> = new Map();
  private userDownloads: Map<string, Set<string>> = new Map(); // userId -> templateIds

  constructor() {
    this.seedDefaultTemplates();
    this.seedDefaultCollections();
  }

  private seedDefaultTemplates(): void {
    const defaultTemplates: Partial<Template>[] = [
      {
        id: 'nextjs-saas-starter',
        name: 'Next.js SaaS Starter',
        slug: 'nextjs-saas-starter',
        description: 'Production-ready SaaS template with auth, payments, and database',
        longDescription: 'A complete SaaS starter kit built with Next.js 14, featuring Stripe payments, Supabase auth, and a modern dashboard UI.',
        category: 'saas',
        tags: ['nextjs', 'typescript', 'stripe', 'supabase', 'tailwind'],
        pricing: { type: 'free' },
        stats: { views: 15420, downloads: 3280, clones: 1890, stars: 542, forks: 128, rating: 4.8, reviewCount: 89 }
      },
      {
        id: 'react-dashboard',
        name: 'React Admin Dashboard',
        slug: 'react-dashboard',
        description: 'Beautiful admin dashboard with charts, tables, and dark mode',
        category: 'dashboard',
        tags: ['react', 'typescript', 'recharts', 'tailwind', 'shadcn'],
        pricing: { type: 'free' },
        stats: { views: 12300, downloads: 2890, clones: 1450, stars: 389, forks: 95, rating: 4.6, reviewCount: 67 }
      },
      {
        id: 'fastapi-backend',
        name: 'FastAPI Backend Template',
        slug: 'fastapi-backend',
        description: 'Scalable API backend with async support, auth, and OpenAPI docs',
        category: 'api-backend',
        tags: ['python', 'fastapi', 'postgresql', 'docker', 'redis'],
        pricing: { type: 'free' },
        stats: { views: 8900, downloads: 1780, clones: 920, stars: 267, forks: 72, rating: 4.7, reviewCount: 45 }
      },
      {
        id: 'landing-page-pro',
        name: 'Landing Page Pro',
        slug: 'landing-page-pro',
        description: 'High-converting landing page with animations and A/B testing',
        category: 'landing-page',
        tags: ['nextjs', 'framer-motion', 'tailwind', 'analytics'],
        pricing: { type: 'paid', price: 4900, currency: 'usd' },
        stats: { views: 6700, downloads: 890, clones: 445, stars: 156, forks: 28, rating: 4.9, reviewCount: 34 }
      },
      {
        id: 'ecommerce-nextjs',
        name: 'E-Commerce Store',
        slug: 'ecommerce-nextjs',
        description: 'Full-featured online store with cart, checkout, and inventory',
        category: 'e-commerce',
        tags: ['nextjs', 'stripe', 'prisma', 'postgresql', 'tailwind'],
        pricing: { type: 'paid', price: 7900, currency: 'usd' },
        stats: { views: 9800, downloads: 1230, clones: 615, stars: 234, forks: 56, rating: 4.7, reviewCount: 52 }
      },
      {
        id: 'ai-chatbot-template',
        name: 'AI Chatbot Template',
        slug: 'ai-chatbot-template',
        description: 'ChatGPT-style interface with streaming, history, and RAG support',
        category: 'ai-ml',
        tags: ['nextjs', 'openai', 'langchain', 'vector-db', 'typescript'],
        pricing: { type: 'free' },
        stats: { views: 18200, downloads: 4560, clones: 2890, stars: 678, forks: 189, rating: 4.8, reviewCount: 112 }
      },
      {
        id: 'portfolio-minimal',
        name: 'Minimal Portfolio',
        slug: 'portfolio-minimal',
        description: 'Clean, minimal portfolio for developers and designers',
        category: 'portfolio',
        tags: ['nextjs', 'mdx', 'tailwind', 'animations'],
        pricing: { type: 'free' },
        stats: { views: 7800, downloads: 2340, clones: 1890, stars: 312, forks: 145, rating: 4.5, reviewCount: 78 }
      },
      {
        id: 'blog-platform',
        name: 'Blog Platform',
        slug: 'blog-platform',
        description: 'Full-featured blog with MDX, categories, and SEO optimization',
        category: 'blog',
        tags: ['nextjs', 'mdx', 'contentlayer', 'tailwind', 'typescript'],
        pricing: { type: 'free' },
        stats: { views: 5600, downloads: 1450, clones: 890, stars: 198, forks: 67, rating: 4.6, reviewCount: 41 }
      },
      {
        id: 'component-library',
        name: 'React Component Library',
        slug: 'component-library',
        description: 'Reusable UI components with Storybook and testing setup',
        category: 'component-library',
        tags: ['react', 'storybook', 'testing-library', 'rollup', 'typescript'],
        pricing: { type: 'free' },
        stats: { views: 4200, downloads: 980, clones: 520, stars: 145, forks: 38, rating: 4.4, reviewCount: 29 }
      },
      {
        id: 'data-pipeline-airflow',
        name: 'Data Pipeline Starter',
        slug: 'data-pipeline-airflow',
        description: 'ETL pipeline with Airflow, dbt, and data quality checks',
        category: 'data-pipeline',
        tags: ['python', 'airflow', 'dbt', 'postgresql', 'docker'],
        pricing: { type: 'paid', price: 4900, currency: 'usd' },
        stats: { views: 3400, downloads: 560, clones: 280, stars: 89, forks: 23, rating: 4.7, reviewCount: 18 }
      }
    ];

    const defaultAuthor: TemplateAuthor = {
      id: 'system',
      name: 'Infinity Assistant',
      username: 'infinity',
      verified: true,
      totalTemplates: defaultTemplates.length,
      totalDownloads: 0
    };

    defaultTemplates.forEach(partial => {
      const template: Template = {
        id: partial.id!,
        name: partial.name!,
        slug: partial.slug!,
        description: partial.description!,
        longDescription: partial.longDescription,
        category: partial.category!,
        tags: partial.tags!,
        author: defaultAuthor,
        version: '1.0.0',
        pricing: partial.pricing!,
        screenshots: [],
        stats: partial.stats!,
        files: this.generateTemplateFiles(partial.category!),
        dependencies: this.generateDependencies(partial.tags!),
        requirements: this.generateRequirements(partial.tags!),
        configuration: this.generateConfiguration(partial.category!),
        metadata: {},
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      };
      this.templates.set(template.id, template);
    });
  }

  private generateTemplateFiles(category: TemplateCategory): TemplateFile[] {
    const baseFiles: TemplateFile[] = [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: '{{PROJECT_NAME}}',
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint'
          }
        }, null, 2),
        isTemplate: true
      },
      {
        path: 'README.md',
        content: `# {{PROJECT_NAME}}\n\n{{PROJECT_DESCRIPTION}}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``,
        isTemplate: true
      },
      {
        path: '.env.example',
        content: '# Environment variables\nDATABASE_URL=\nNEXT_PUBLIC_API_URL=',
        isTemplate: false
      }
    ];

    return baseFiles;
  }

  private generateDependencies(tags: string[]): TemplateDependency[] {
    const deps: TemplateDependency[] = [];

    if (tags.includes('nextjs')) {
      deps.push({ name: 'next', version: '^14.0.0', type: 'runtime', package: 'npm' });
      deps.push({ name: 'react', version: '^18.0.0', type: 'runtime', package: 'npm' });
      deps.push({ name: 'react-dom', version: '^18.0.0', type: 'runtime', package: 'npm' });
    }
    if (tags.includes('typescript')) {
      deps.push({ name: 'typescript', version: '^5.0.0', type: 'dev', package: 'npm' });
      deps.push({ name: '@types/react', version: '^18.0.0', type: 'dev', package: 'npm' });
    }
    if (tags.includes('tailwind')) {
      deps.push({ name: 'tailwindcss', version: '^3.4.0', type: 'dev', package: 'npm' });
    }
    if (tags.includes('stripe')) {
      deps.push({ name: 'stripe', version: '^14.0.0', type: 'runtime', package: 'npm' });
    }

    return deps;
  }

  private generateRequirements(tags: string[]): TemplateRequirements {
    const requirements: TemplateRequirements = {
      minNodeVersion: '18.0.0',
      envVars: []
    };

    if (tags.includes('postgresql') || tags.includes('supabase') || tags.includes('prisma')) {
      requirements.services = ['database'];
      requirements.envVars!.push({
        name: 'DATABASE_URL',
        description: 'PostgreSQL connection string',
        required: true,
        example: 'postgresql://user:pass@localhost:5432/db'
      });
    }

    if (tags.includes('redis')) {
      requirements.services = [...(requirements.services || []), 'redis'];
      requirements.envVars!.push({
        name: 'REDIS_URL',
        description: 'Redis connection string',
        required: false,
        example: 'redis://localhost:6379'
      });
    }

    if (tags.includes('stripe')) {
      requirements.envVars!.push({
        name: 'STRIPE_SECRET_KEY',
        description: 'Stripe secret API key',
        required: true
      });
    }

    return requirements;
  }

  private generateConfiguration(category: TemplateCategory): TemplateConfiguration {
    const config: TemplateConfiguration = {
      variables: [
        {
          name: 'PROJECT_NAME',
          displayName: 'Project Name',
          description: 'Name of your project',
          type: 'string',
          required: true,
          validation: '^[a-z][a-z0-9-]*$'
        },
        {
          name: 'PROJECT_DESCRIPTION',
          displayName: 'Description',
          description: 'Short description of your project',
          type: 'string',
          required: false,
          defaultValue: 'A new project'
        }
      ],
      postInstallSteps: [
        'npm install',
        'cp .env.example .env',
        'Update .env with your configuration',
        'npm run dev'
      ]
    };

    if (category === 'saas' || category === 'e-commerce') {
      config.variables.push({
        name: 'ENABLE_ANALYTICS',
        displayName: 'Enable Analytics',
        description: 'Include analytics integration',
        type: 'boolean',
        required: false,
        defaultValue: true
      });
    }

    return config;
  }

  private seedDefaultCollections(): void {
    const collections: TemplateCollection[] = [
      {
        id: 'featured',
        name: 'Featured Templates',
        slug: 'featured',
        description: 'Hand-picked templates recommended by our team',
        templates: ['nextjs-saas-starter', 'ai-chatbot-template', 'react-dashboard'],
        curatedBy: 'system',
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'quick-start',
        name: 'Quick Start',
        slug: 'quick-start',
        description: 'Get up and running in minutes',
        templates: ['portfolio-minimal', 'blog-platform', 'fastapi-backend'],
        curatedBy: 'system',
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'business',
        name: 'Business Templates',
        slug: 'business',
        description: 'Templates for launching your business online',
        templates: ['nextjs-saas-starter', 'ecommerce-nextjs', 'landing-page-pro'],
        curatedBy: 'system',
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    collections.forEach(c => this.collections.set(c.id, c));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async getTemplateBySlug(slug: string): Promise<Template | undefined> {
    return Array.from(this.templates.values()).find(t => t.slug === slug);
  }

  async searchTemplates(query: string, filters: SearchFilters, page: number = 1, pageSize: number = 12): Promise<SearchResult> {
    let results = Array.from(this.templates.values()).filter(t => t.status === 'published');

    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // Category filter
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(t =>
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Pricing filter
    if (filters.pricing && filters.pricing !== 'all') {
      results = results.filter(t => t.pricing.type === filters.pricing);
    }

    // Rating filter
    if (filters.minRating) {
      results = results.filter(t => t.stats.rating >= filters.minRating!);
    }

    // Author filter
    if (filters.author) {
      results = results.filter(t => t.author.id === filters.author || t.author.username === filters.author);
    }

    // Sort
    switch (filters.sortBy) {
      case 'recent':
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'rating':
        results.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case 'downloads':
        results.sort((a, b) => b.stats.downloads - a.stats.downloads);
        break;
      case 'popular':
      default:
        results.sort((a, b) => (b.stats.views + b.stats.downloads * 2 + b.stats.stars * 5) -
                              (a.stats.views + a.stats.downloads * 2 + a.stats.stars * 5));
    }

    // Pagination
    const total = results.length;
    const start = (page - 1) * pageSize;
    const paginatedResults = results.slice(start, start + pageSize);

    return {
      templates: paginatedResults,
      total,
      page,
      pageSize,
      filters
    };
  }

  async createTemplate(submission: TemplateSubmission, authorId: string): Promise<Template> {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const slug = submission.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const template: Template = {
      id,
      name: submission.name,
      slug,
      description: submission.description,
      longDescription: submission.longDescription,
      category: submission.category,
      tags: submission.tags,
      author: {
        id: authorId,
        name: 'User',
        username: authorId,
        verified: false,
        totalTemplates: 1,
        totalDownloads: 0
      },
      version: '1.0.0',
      pricing: submission.pricing,
      thumbnail: submission.thumbnail,
      screenshots: submission.screenshots || [],
      demoUrl: submission.demoUrl,
      repositoryUrl: submission.repositoryUrl,
      stats: {
        views: 0,
        downloads: 0,
        clones: 0,
        stars: 0,
        forks: 0,
        rating: 0,
        reviewCount: 0
      },
      files: submission.files,
      dependencies: submission.dependencies || [],
      requirements: submission.requirements || { envVars: [] },
      configuration: submission.configuration || { variables: [] },
      metadata: {},
      status: 'pending_review',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template | undefined> {
    const template = this.templates.get(id);
    if (!template) return undefined;

    const updated = { ...template, ...updates, updatedAt: new Date() };
    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  async incrementStat(id: string, stat: keyof TemplateStats): Promise<void> {
    const template = this.templates.get(id);
    if (template && typeof template.stats[stat] === 'number') {
      (template.stats[stat] as number)++;
    }
  }

  async getReviews(templateId: string): Promise<TemplateReview[]> {
    return this.reviews.get(templateId) || [];
  }

  async addReview(review: Omit<TemplateReview, 'id' | 'createdAt' | 'updatedAt'>): Promise<TemplateReview> {
    const newReview: TemplateReview = {
      ...review,
      id: `review-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const reviews = this.reviews.get(review.templateId) || [];
    reviews.push(newReview);
    this.reviews.set(review.templateId, reviews);

    // Update template rating
    const template = this.templates.get(review.templateId);
    if (template) {
      const allReviews = reviews;
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      template.stats.rating = Math.round(avgRating * 10) / 10;
      template.stats.reviewCount = allReviews.length;
    }

    return newReview;
  }

  async getCollections(): Promise<TemplateCollection[]> {
    return Array.from(this.collections.values());
  }

  async getCollection(id: string): Promise<TemplateCollection | undefined> {
    return this.collections.get(id);
  }

  async recordDownload(templateId: string, userId: string): Promise<void> {
    const userDownloads = this.userDownloads.get(userId) || new Set();
    userDownloads.add(templateId);
    this.userDownloads.set(userId, userDownloads);
    await this.incrementStat(templateId, 'downloads');
  }

  async hasDownloaded(templateId: string, userId: string): Promise<boolean> {
    const userDownloads = this.userDownloads.get(userId);
    return userDownloads?.has(templateId) || false;
  }
}

// ============================================================================
// Template Engine
// ============================================================================

class TemplateEngine {
  /**
   * Process template files with variable substitution
   */
  processFiles(files: TemplateFile[], variables: Record<string, string | number | boolean>): TemplateFile[] {
    return files.map(file => ({
      ...file,
      content: file.isTemplate ? this.substituteVariables(file.content, variables) : file.content
    }));
  }

  private substituteVariables(content: string, variables: Record<string, string | number | boolean>): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }

    return result;
  }

  /**
   * Validate variables against template configuration
   */
  validateVariables(
    variables: Record<string, string | number | boolean>,
    configuration: TemplateConfiguration
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const varConfig of configuration.variables) {
      const value = variables[varConfig.name];

      if (varConfig.required && (value === undefined || value === '')) {
        errors.push(`Required variable '${varConfig.displayName}' is missing`);
        continue;
      }

      if (value !== undefined && varConfig.validation) {
        const regex = new RegExp(varConfig.validation);
        if (!regex.test(String(value))) {
          errors.push(`Variable '${varConfig.displayName}' has invalid format`);
        }
      }

      if (value !== undefined && varConfig.type === 'select' && varConfig.options) {
        if (!varConfig.options.includes(String(value))) {
          errors.push(`Variable '${varConfig.displayName}' must be one of: ${varConfig.options.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate package.json from template dependencies
   */
  generatePackageJson(
    projectName: string,
    description: string,
    dependencies: TemplateDependency[],
    scripts?: Record<string, string>
  ): string {
    const pkg: Record<string, unknown> = {
      name: projectName,
      version: '0.1.0',
      description,
      private: true,
      scripts: scripts || {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'eslint .'
      },
      dependencies: {},
      devDependencies: {}
    };

    for (const dep of dependencies) {
      if (dep.package === 'npm') {
        if (dep.type === 'dev') {
          (pkg.devDependencies as Record<string, string>)[dep.name] = dep.version;
        } else {
          (pkg.dependencies as Record<string, string>)[dep.name] = dep.version;
        }
      }
    }

    return JSON.stringify(pkg, null, 2);
  }
}

// ============================================================================
// Main Service
// ============================================================================

type MarketplaceEvent =
  | 'template:created'
  | 'template:published'
  | 'template:cloned'
  | 'template:downloaded'
  | 'template:reviewed';

type EventHandler = (data: unknown) => void;

export class TemplateMarketplaceService {
  private static instance: TemplateMarketplaceService;
  private repository: TemplateRepository;
  private engine: TemplateEngine;
  private eventHandlers: Map<MarketplaceEvent, EventHandler[]> = new Map();

  private constructor() {
    this.repository = new TemplateRepository();
    this.engine = new TemplateEngine();
  }

  static getInstance(): TemplateMarketplaceService {
    if (!TemplateMarketplaceService.instance) {
      TemplateMarketplaceService.instance = new TemplateMarketplaceService();
    }
    return TemplateMarketplaceService.instance;
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  subscribe(event: MarketplaceEvent, handler: EventHandler): () => void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  private emit(event: MarketplaceEvent, data: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // ---------------------------------------------------------------------------
  // Template Discovery
  // ---------------------------------------------------------------------------

  async searchTemplates(
    query: string = '',
    filters: SearchFilters = {},
    page: number = 1,
    pageSize: number = 12
  ): Promise<SearchResult> {
    return this.repository.searchTemplates(query, filters, page, pageSize);
  }

  async getTemplate(idOrSlug: string): Promise<Template | undefined> {
    const template = await this.repository.getTemplate(idOrSlug) ||
                     await this.repository.getTemplateBySlug(idOrSlug);

    if (template) {
      await this.repository.incrementStat(template.id, 'views');
    }

    return template;
  }

  async getFeaturedTemplates(): Promise<Template[]> {
    const collection = await this.repository.getCollection('featured');
    if (!collection) return [];

    const templates = await Promise.all(
      collection.templates.map(id => this.repository.getTemplate(id))
    );

    return templates.filter((t): t is Template => t !== undefined);
  }

  async getTemplatesByCategory(category: TemplateCategory): Promise<Template[]> {
    const result = await this.searchTemplates('', { category });
    return result.templates;
  }

  async getPopularTemplates(limit: number = 10): Promise<Template[]> {
    const result = await this.searchTemplates('', { sortBy: 'popular' }, 1, limit);
    return result.templates;
  }

  async getRecentTemplates(limit: number = 10): Promise<Template[]> {
    const result = await this.searchTemplates('', { sortBy: 'recent' }, 1, limit);
    return result.templates;
  }

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------

  async getCollections(): Promise<TemplateCollection[]> {
    return this.repository.getCollections();
  }

  async getCollection(idOrSlug: string): Promise<{ collection: TemplateCollection; templates: Template[] } | undefined> {
    const collections = await this.repository.getCollections();
    const collection = collections.find(c => c.id === idOrSlug || c.slug === idOrSlug);

    if (!collection) return undefined;

    const templates = await Promise.all(
      collection.templates.map(id => this.repository.getTemplate(id))
    );

    return {
      collection,
      templates: templates.filter((t): t is Template => t !== undefined)
    };
  }

  // ---------------------------------------------------------------------------
  // Template Usage
  // ---------------------------------------------------------------------------

  async cloneTemplate(request: CloneRequest, userId: string): Promise<CloneResult> {
    const template = await this.repository.getTemplate(request.templateId);

    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    // Check if paid template requires purchase
    if (template.pricing.type === 'paid') {
      const hasAccess = await this.repository.hasDownloaded(template.id, userId);
      if (!hasAccess) {
        throw new Error('Please purchase this template before cloning');
      }
    }

    // Validate variables
    const validation = this.engine.validateVariables(request.variables, template.configuration);
    if (!validation.valid) {
      throw new Error(`Invalid variables: ${validation.errors.join(', ')}`);
    }

    // Process template files
    const variables = {
      PROJECT_NAME: request.projectName,
      PROJECT_DESCRIPTION: request.projectDescription || '',
      ...request.variables
    };

    const processedFiles = this.engine.processFiles(template.files, variables);

    // Generate project ID and path
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const projectPath = request.targetPath || `/projects/${request.projectName}`;

    // Track clone
    await this.repository.incrementStat(template.id, 'clones');
    this.emit('template:cloned', { templateId: template.id, projectId, userId });

    const warnings: string[] = [];

    // Check for required environment variables
    if (template.requirements.envVars && template.requirements.envVars.length > 0) {
      warnings.push('Remember to configure required environment variables');
    }

    return {
      success: true,
      projectId,
      projectPath,
      filesCreated: processedFiles.length,
      warnings,
      postInstallInstructions: template.configuration.postInstallSteps
    };
  }

  async downloadTemplate(templateId: string, userId: string): Promise<{ files: TemplateFile[]; template: Template }> {
    const template = await this.repository.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Record download
    await this.repository.recordDownload(templateId, userId);
    this.emit('template:downloaded', { templateId, userId });

    return { files: template.files, template };
  }

  // ---------------------------------------------------------------------------
  // Template Publishing
  // ---------------------------------------------------------------------------

  async submitTemplate(submission: TemplateSubmission, authorId: string): Promise<Template> {
    // Validate submission
    if (!submission.name || submission.name.length < 3) {
      throw new Error('Template name must be at least 3 characters');
    }

    if (!submission.description || submission.description.length < 20) {
      throw new Error('Description must be at least 20 characters');
    }

    if (!submission.files || submission.files.length === 0) {
      throw new Error('Template must include at least one file');
    }

    const template = await this.repository.createTemplate(submission, authorId);
    this.emit('template:created', { templateId: template.id, authorId });

    return template;
  }

  async updateTemplate(templateId: string, updates: Partial<TemplateSubmission>, authorId: string): Promise<Template> {
    const template = await this.repository.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.author.id !== authorId) {
      throw new Error('Not authorized to update this template');
    }

    const updated = await this.repository.updateTemplate(templateId, {
      ...updates,
      status: 'pending_review' // Re-submit for review on update
    });

    if (!updated) {
      throw new Error('Failed to update template');
    }

    return updated;
  }

  async publishTemplate(templateId: string, adminId: string): Promise<Template> {
    const updated = await this.repository.updateTemplate(templateId, {
      status: 'published',
      publishedAt: new Date()
    });

    if (!updated) {
      throw new Error(`Template not found: ${templateId}`);
    }

    this.emit('template:published', { templateId, adminId });
    return updated;
  }

  async archiveTemplate(templateId: string, authorId: string): Promise<void> {
    const template = await this.repository.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.author.id !== authorId) {
      throw new Error('Not authorized to archive this template');
    }

    await this.repository.updateTemplate(templateId, { status: 'archived' });
  }

  // ---------------------------------------------------------------------------
  // Reviews & Ratings
  // ---------------------------------------------------------------------------

  async getReviews(templateId: string): Promise<TemplateReview[]> {
    return this.repository.getReviews(templateId);
  }

  async addReview(
    templateId: string,
    userId: string,
    userName: string,
    rating: number,
    title: string,
    content: string
  ): Promise<TemplateReview> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const hasDownloaded = await this.repository.hasDownloaded(templateId, userId);

    const review = await this.repository.addReview({
      templateId,
      userId,
      userName,
      rating,
      title,
      content,
      helpful: 0,
      verified: hasDownloaded
    });

    this.emit('template:reviewed', { templateId, userId, rating });
    return review;
  }

  async starTemplate(templateId: string, userId: string): Promise<void> {
    await this.repository.incrementStat(templateId, 'stars');
  }

  async forkTemplate(templateId: string, userId: string): Promise<void> {
    await this.repository.incrementStat(templateId, 'forks');
  }

  // ---------------------------------------------------------------------------
  // Categories & Tags
  // ---------------------------------------------------------------------------

  getCategories(): { id: TemplateCategory; name: string; description: string }[] {
    return [
      { id: 'web-app', name: 'Web Application', description: 'Full-stack web applications' },
      { id: 'mobile-app', name: 'Mobile App', description: 'React Native and mobile apps' },
      { id: 'api-backend', name: 'API & Backend', description: 'REST and GraphQL APIs' },
      { id: 'landing-page', name: 'Landing Page', description: 'Marketing and landing pages' },
      { id: 'dashboard', name: 'Dashboard', description: 'Admin panels and dashboards' },
      { id: 'e-commerce', name: 'E-Commerce', description: 'Online stores and shops' },
      { id: 'saas', name: 'SaaS', description: 'Software as a Service templates' },
      { id: 'portfolio', name: 'Portfolio', description: 'Personal and portfolio sites' },
      { id: 'blog', name: 'Blog', description: 'Blogs and content sites' },
      { id: 'documentation', name: 'Documentation', description: 'Documentation sites' },
      { id: 'starter-kit', name: 'Starter Kit', description: 'Basic project starters' },
      { id: 'component-library', name: 'Component Library', description: 'Reusable UI components' },
      { id: 'ai-ml', name: 'AI & ML', description: 'AI and machine learning projects' },
      { id: 'data-pipeline', name: 'Data Pipeline', description: 'ETL and data processing' },
      { id: 'devops', name: 'DevOps', description: 'CI/CD and infrastructure' },
      { id: 'other', name: 'Other', description: 'Other templates' }
    ];
  }

  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const result = await this.searchTemplates('', {}, 1, 100);
    const tagCounts = new Map<string, number>();

    for (const template of result.templates) {
      for (const tag of template.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  async validateTemplate(submission: TemplateSubmission): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!submission.name || submission.name.length < 3) {
      errors.push('Name must be at least 3 characters');
    }

    if (!submission.description || submission.description.length < 20) {
      errors.push('Description must be at least 20 characters');
    }

    if (!submission.category) {
      errors.push('Category is required');
    }

    if (!submission.files || submission.files.length === 0) {
      errors.push('At least one file is required');
    }

    // Check for required files
    const hasPackageJson = submission.files?.some(f => f.path === 'package.json');
    const hasReadme = submission.files?.some(f => f.path.toLowerCase() === 'readme.md');

    if (!hasPackageJson && submission.category !== 'documentation') {
      errors.push('package.json is recommended');
    }

    if (!hasReadme) {
      errors.push('README.md is recommended');
    }

    return { valid: errors.length === 0, errors };
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export default TemplateMarketplaceService;
