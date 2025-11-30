/**
 * Knowledge Packet Service
 *
 * The brain of our competitive advantage. This service:
 * 1. Routes tasks to appropriate knowledge domains
 * 2. Composes optimal knowledge packets for LLM injection
 * 3. Tracks effectiveness and learns from outcomes
 * 4. Adapts to user skill level for progressive disclosure
 *
 * NO COMPETITOR HAS THIS.
 */

import type {
  KnowledgePacket,
  KnowledgeDomain,
  SkillLevel,
  PacketContent,
  WisdomEntry,
  PatternEntry,
  GotchaEntry,
  CodeExample,
  BestPractice,
  ComposedPacket,
  CompositionStrategy,
  UserContext,
  UserSkillProfile,
  DomainSkill,
  InjectionStrategy,
  PacketTrigger,
  EXPERT_DOMAINS,
  ExpertDomainInfo,
} from '@/types/knowledge-packet';

// ============================================================================
// EXPERTISE ROUTER
// ============================================================================

interface TaskAnalysis {
  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];
  detectedPatterns: string[];
  potentialGotchas: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  taskType: TaskType;
  keywords: string[];
  confidence: number;
}

type TaskType =
  | 'crud'
  | 'authentication'
  | 'api_design'
  | 'ui_component'
  | 'data_modeling'
  | 'integration'
  | 'optimization'
  | 'debugging'
  | 'refactoring'
  | 'architecture'
  | 'testing'
  | 'deployment'
  | 'custom';

/**
 * Routes tasks to appropriate knowledge domains
 */
class ExpertiseRouter {
  private domainKeywords: Map<KnowledgeDomain, Set<string>> = new Map();
  private patternKeywords: Map<string, Set<string>> = new Map();
  private gotchaKeywords: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeKeywords();
  }

  private initializeKeywords(): void {
    // Domain keywords for routing
    const domainKeywordMap: Record<KnowledgeDomain, string[]> = {
      web_development: ['react', 'vue', 'angular', 'nextjs', 'html', 'css', 'dom', 'browser', 'frontend', 'component', 'hook', 'state', 'redux', 'zustand'],
      mobile_development: ['react native', 'flutter', 'ios', 'android', 'mobile', 'expo', 'swift', 'kotlin', 'app'],
      backend_systems: ['server', 'api', 'endpoint', 'service', 'microservice', 'nodejs', 'express', 'fastify', 'nestjs', 'backend'],
      database_design: ['database', 'sql', 'query', 'table', 'schema', 'migration', 'index', 'postgresql', 'mysql', 'mongodb', 'supabase'],
      api_design: ['rest', 'graphql', 'endpoint', 'route', 'request', 'response', 'http', 'api', 'crud'],
      authentication: ['auth', 'login', 'signup', 'password', 'session', 'jwt', 'token', 'oauth', 'permission', 'role', 'user'],
      payments: ['payment', 'stripe', 'checkout', 'subscription', 'billing', 'invoice', 'price', 'plan', 'customer'],
      ai_ml: ['ai', 'llm', 'gpt', 'claude', 'embedding', 'vector', 'prompt', 'model', 'training', 'inference', 'rag'],
      devops: ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'terraform', 'aws', 'vercel', 'railway', 'pipeline'],
      security: ['security', 'vulnerability', 'xss', 'csrf', 'injection', 'encrypt', 'hash', 'sanitize', 'validate'],
      testing: ['test', 'jest', 'vitest', 'playwright', 'cypress', 'mock', 'assert', 'expect', 'coverage'],
      performance: ['performance', 'optimize', 'cache', 'lazy', 'bundle', 'lighthouse', 'memory', 'profil'],
      game_development: ['game', 'unity', 'unreal', 'godot', 'physics', 'collision', 'sprite', 'animation', 'three.js'],
      blockchain: ['blockchain', 'web3', 'solidity', 'smart contract', 'ethereum', 'nft', 'token', 'wallet', 'metamask'],
      data_engineering: ['etl', 'pipeline', 'spark', 'airflow', 'kafka', 'data warehouse', 'analytics', 'batch'],
      system_design: ['architecture', 'scalability', 'load balancer', 'message queue', 'cache', 'distributed', 'microservice'],
      ux_design: ['ux', 'ui', 'design', 'accessibility', 'responsive', 'animation', 'transition', 'user experience'],
      integrations: ['webhook', 'integration', 'third-party', 'api key', 'oauth', 'sdk', 'connect'],
      real_time: ['websocket', 'realtime', 'real-time', 'live', 'socket', 'sse', 'push', 'notification', 'presence'],
      general: ['code', 'function', 'class', 'variable', 'loop', 'algorithm', 'data structure', 'refactor'],
    };

    for (const [domain, keywords] of Object.entries(domainKeywordMap)) {
      this.domainKeywords.set(domain as KnowledgeDomain, new Set(keywords.map(k => k.toLowerCase())));
    }

    // Common gotcha triggers
    this.gotchaKeywords.set('hydration_mismatch', new Set(['hydration', 'ssr', 'server', 'client', 'mismatch', 'useeffect']));
    this.gotchaKeywords.set('n_plus_one', new Set(['query', 'loop', 'database', 'relation', 'include', 'eager']));
    this.gotchaKeywords.set('memory_leak', new Set(['memory', 'leak', 'useeffect', 'cleanup', 'subscription', 'listener']));
    this.gotchaKeywords.set('race_condition', new Set(['race', 'async', 'await', 'concurrent', 'parallel', 'state']));
    this.gotchaKeywords.set('sql_injection', new Set(['sql', 'query', 'input', 'user', 'string', 'concatenate']));
    this.gotchaKeywords.set('xss', new Set(['html', 'innerhtml', 'dangerously', 'script', 'user input', 'sanitize']));
  }

  /**
   * Analyze a task and determine which domains and knowledge to apply
   */
  analyzeTask(taskDescription: string, codeContext?: string): TaskAnalysis {
    const text = `${taskDescription} ${codeContext || ''}`.toLowerCase();
    const words = text.split(/\s+/);

    // Score each domain
    const domainScores = new Map<KnowledgeDomain, number>();
    for (const [domain, keywords] of this.domainKeywords) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += keyword.split(' ').length; // Multi-word keywords score higher
        }
      }
      if (score > 0) {
        domainScores.set(domain, score);
      }
    }

    // Sort by score
    const sortedDomains = Array.from(domainScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);

    const primaryDomain = sortedDomains[0] || 'general';
    const secondaryDomains = sortedDomains.slice(1, 4);

    // Detect potential gotchas
    const potentialGotchas: string[] = [];
    for (const [gotcha, keywords] of this.gotchaKeywords) {
      let matches = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) matches++;
      }
      if (matches >= 2) {
        potentialGotchas.push(gotcha);
      }
    }

    // Determine complexity
    const complexity = this.assessComplexity(text, sortedDomains.length, potentialGotchas.length);

    // Determine task type
    const taskType = this.classifyTaskType(text);

    // Extract significant keywords
    const keywords = this.extractKeywords(text);

    return {
      primaryDomain,
      secondaryDomains,
      detectedPatterns: [], // Would be populated from pattern detection
      potentialGotchas,
      complexity,
      taskType,
      keywords,
      confidence: domainScores.get(primaryDomain) ? Math.min(domainScores.get(primaryDomain)! / 10, 1) : 0.5,
    };
  }

  private assessComplexity(text: string, domainCount: number, gotchaCount: number): TaskAnalysis['complexity'] {
    const complexityIndicators = [
      'scale', 'distributed', 'concurrent', 'real-time', 'architecture',
      'optimize', 'migration', 'refactor', 'security', 'performance',
    ];

    let score = 0;
    for (const indicator of complexityIndicators) {
      if (text.includes(indicator)) score++;
    }
    score += domainCount;
    score += gotchaCount * 2;

    if (score >= 8) return 'expert';
    if (score >= 5) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
  }

  private classifyTaskType(text: string): TaskType {
    if (/create|add|insert|new/.test(text) && /database|table|model|entity/.test(text)) return 'crud';
    if (/auth|login|signup|password|session/.test(text)) return 'authentication';
    if (/api|endpoint|route|rest|graphql/.test(text)) return 'api_design';
    if (/component|button|form|modal|ui/.test(text)) return 'ui_component';
    if (/schema|table|relation|model|database/.test(text)) return 'data_modeling';
    if (/integrate|connect|webhook|third-party/.test(text)) return 'integration';
    if (/optimize|performance|speed|cache/.test(text)) return 'optimization';
    if (/bug|fix|error|issue|debug/.test(text)) return 'debugging';
    if (/refactor|clean|improve|restructure/.test(text)) return 'refactoring';
    if (/architect|design|structure|scale/.test(text)) return 'architecture';
    if (/test|spec|assert|coverage/.test(text)) return 'testing';
    if (/deploy|ci|cd|release|production/.test(text)) return 'deployment';
    return 'custom';
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - would use NLP in production
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'after', 'before', 'when', 'whenever', 'where', 'wherever', 'whether', 'which', 'who', 'whom', 'whose', 'what', 'whatever', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'this', 'that', 'these', 'those']);

    return text
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20);
  }
}

// ============================================================================
// KNOWLEDGE PACKET SERVICE
// ============================================================================

class KnowledgePacketServiceImpl {
  private packets: Map<string, KnowledgePacket> = new Map();
  private composedPackets: Map<string, ComposedPacket> = new Map();
  private userProfiles: Map<string, UserSkillProfile> = new Map();
  private router = new ExpertiseRouter();

  // Pre-built packets loaded from knowledge base
  private domainPackets: Map<KnowledgeDomain, KnowledgePacket> = new Map();

  constructor() {
    this.initializeBasePackets();
  }

  /**
   * Initialize base knowledge packets from our research
   */
  private initializeBasePackets(): void {
    // These would be loaded from the actual knowledge base
    // For now, creating structure with sample content

    this.createDomainPacket('authentication', {
      wisdom: [
        {
          id: 'w-auth-001',
          title: 'Never store passwords in plain text',
          content: 'Always hash passwords using bcrypt, Argon2, or PBKDF2 with sufficient work factor. The work factor should be tuned to take ~250ms on your hardware.',
          wisdomId: 'W.AUTH.001',
          applicableWhen: ['storing user passwords', 'user registration', 'password reset'],
          expectedOutcome: 'Passwords are securely hashed and resistant to rainbow table and brute force attacks',
          confidence: 1.0,
        },
        {
          id: 'w-auth-002',
          title: 'JWTs are not sessions',
          content: 'JWTs cannot be invalidated server-side once issued. For logout/revocation, use short expiry times with refresh tokens, or maintain a token blacklist/whitelist.',
          wisdomId: 'W.AUTH.002',
          applicableWhen: ['implementing JWT auth', 'logout functionality', 'token revocation'],
          expectedOutcome: 'Auth system handles token invalidation appropriately',
          confidence: 0.95,
        },
      ],
      patterns: [
        {
          id: 'p-auth-001',
          name: 'Token Refresh Pattern',
          patternId: 'P.AUTH.01',
          problem: 'Short-lived access tokens require frequent re-authentication',
          solution: 'Use refresh tokens stored securely (httpOnly cookie) to obtain new access tokens',
          context: 'When building authentication with JWTs',
          consequences: ['Better security with short-lived tokens', 'Seamless user experience', 'Requires secure refresh token storage'],
          codeTemplate: `
// Refresh token endpoint
app.post('/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const newAccessToken = jwt.sign({ userId: payload.userId }, ACCESS_SECRET, { expiresIn: '15m' });
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});`,
          relatedPatterns: ['P.AUTH.02', 'P.SEC.01'],
        },
      ],
      gotchas: [
        {
          id: 'g-auth-001',
          title: 'JWT stored in localStorage is vulnerable to XSS',
          gotchaId: 'G.AUTH.01',
          symptom: 'Token accessible via JavaScript, potentially stolen by XSS attacks',
          cause: 'localStorage is accessible to any JavaScript running on the page',
          fix: 'Store tokens in httpOnly cookies or use memory-only storage with refresh tokens',
          prevention: 'Design auth flow to use httpOnly cookies from the start',
          severity: 'high',
          frequency: 'very_common',
          detectionPatterns: ['localStorage.setItem.*token', 'localStorage.getItem.*token'],
        },
        {
          id: 'g-auth-002',
          title: 'Missing CSRF protection on auth endpoints',
          gotchaId: 'G.AUTH.02',
          symptom: 'Attackers can forge requests to auth endpoints',
          cause: 'No CSRF token validation on state-changing requests',
          fix: 'Implement CSRF tokens or use SameSite cookies',
          prevention: 'Include CSRF protection in auth middleware from the start',
          severity: 'critical',
          frequency: 'common',
        },
      ],
      examples: [
        {
          id: 'ex-auth-001',
          title: 'Secure Auth with Supabase',
          description: 'Complete authentication setup with Supabase including RLS policies',
          language: 'typescript',
          framework: 'nextjs',
          code: `
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// app/auth/actions.ts
'use server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function signIn(email: string, password: string) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}`,
          demonstrates: ['Server-side auth', 'Cookie-based sessions', 'Type safety'],
        },
      ],
      bestPractices: [
        {
          id: 'bp-auth-001',
          title: 'Implement rate limiting on auth endpoints',
          description: 'Prevent brute force attacks by limiting login attempts',
          rationale: 'Without rate limiting, attackers can attempt millions of password combinations',
          evidence: ['OWASP Top 10 2021 - A07:2021 Identification and Authentication Failures'],
          howToImplement: 'Use libraries like express-rate-limit or implement with Redis for distributed systems',
          exceptions: ['Internal services with IP whitelisting'],
        },
      ],
      antiPatterns: [],
      architectureDecisions: [],
      performanceHints: [],
      securityGuidelines: [
        {
          id: 'sec-auth-001',
          title: 'Use secure password requirements',
          threat: 'Weak passwords are easily cracked',
          mitigation: 'Require minimum 12 characters, check against known breached passwords (Have I Been Pwned API)',
          owaspRef: 'A07:2021',
          priority: 'high',
        },
      ],
      researchRefs: [
        {
          id: 'ref-auth-001',
          title: 'Password Storage Cheat Sheet',
          authors: ['OWASP'],
          year: 2024,
          source: 'industry_report',
          url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
          keyFindings: ['Use Argon2id as primary choice', 'bcrypt with work factor 10+ acceptable', 'Never use MD5/SHA1/SHA256 alone'],
          applicability: 'All applications storing user passwords',
        },
      ],
    });

    // Add more domain packets...
    this.createDomainPacket('database_design', {
      wisdom: [
        {
          id: 'w-db-001',
          title: 'Index columns used in WHERE and JOIN',
          content: 'Columns frequently used in WHERE clauses, JOIN conditions, and ORDER BY should have indexes. But beware: too many indexes slow down writes.',
          wisdomId: 'W.DB.001',
          applicableWhen: ['query optimization', 'schema design', 'performance tuning'],
          expectedOutcome: 'Queries execute in milliseconds instead of seconds',
          confidence: 0.95,
        },
      ],
      patterns: [
        {
          id: 'p-db-001',
          name: 'Soft Delete Pattern',
          patternId: 'P.DB.01',
          problem: 'Need to delete records but maintain history for audit/recovery',
          solution: 'Add deleted_at timestamp column, filter queries by deleted_at IS NULL',
          context: 'Applications requiring data retention or undo functionality',
          consequences: ['Data recoverable', 'Queries more complex', 'Table grows indefinitely'],
          codeTemplate: `
-- Migration
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;

-- Query (automatically filtered with RLS)
CREATE POLICY "Exclude soft deleted"
ON users FOR SELECT
USING (deleted_at IS NULL);`,
          relatedPatterns: ['P.DB.02'],
        },
      ],
      gotchas: [
        {
          id: 'g-db-001',
          title: 'N+1 Query Problem',
          gotchaId: 'G.DB.001',
          symptom: 'Page load takes 5+ seconds, hundreds of queries for a single page',
          cause: 'Fetching related records in a loop instead of a single query',
          fix: 'Use eager loading (include/join) or batch loading (DataLoader pattern)',
          prevention: 'Always log query counts in development, set up query count alerts',
          severity: 'high',
          frequency: 'very_common',
          detectionPatterns: ['for.*await.*findOne', 'map.*async.*query'],
        },
      ],
      examples: [],
      bestPractices: [],
      antiPatterns: [],
      architectureDecisions: [],
      performanceHints: [
        {
          id: 'perf-db-001',
          area: 'Query Performance',
          issue: 'SELECT * fetches unnecessary data',
          impact: 'significant',
          solution: 'Always specify needed columns: SELECT id, name, email FROM users',
          benchmark: 'Can reduce query time by 40-60% on wide tables',
        },
      ],
      securityGuidelines: [
        {
          id: 'sec-db-001',
          title: 'Use parameterized queries',
          threat: 'SQL injection',
          mitigation: 'Never concatenate user input into queries. Use parameterized queries or ORMs.',
          owaspRef: 'A03:2021',
          cweRef: 'CWE-89',
          priority: 'critical',
        },
      ],
      researchRefs: [],
    });
  }

  /**
   * Create a domain packet
   */
  private createDomainPacket(domain: KnowledgeDomain, content: PacketContent): void {
    const packet: KnowledgePacket = {
      id: `packet-${domain}`,
      name: `${domain.replace('_', ' ')} Knowledge`,
      description: `Expert knowledge for ${domain}`,
      version: '1.0.0',
      domain,
      subDomains: [],
      targetSkillLevel: 'all',
      content,
      injection: {
        position: 'context',
        format: 'structured',
        priority: 5,
        maxTokens: 2000,
        selection: {
          method: 'relevance',
          weights: { wisdom: 1.0, patterns: 0.9, gotchas: 0.95, examples: 0.7, bestPractices: 0.8 },
        },
      },
      effectiveness: {
        usageCount: 0,
        firstTrySuccessRate: 0,
        gotchaPreventionRate: 0,
        codeQualityScore: 0,
        userSatisfaction: 0,
        timeSavedMinutes: 0,
        feedback: [],
      },
      dependencies: [],
      conflicts: [],
      estimatedTokens: 1500,
      triggers: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        contributors: [],
        tags: [domain],
        researchBackedClaims: content.researchRefs?.length || 0,
        productionExperienceClaims: content.gotchas?.length || 0,
        license: 'proprietary',
      },
    };

    this.domainPackets.set(domain, packet);
    this.packets.set(packet.id, packet);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Compose a knowledge packet for a specific task
   */
  async composePacketForTask(
    taskDescription: string,
    userContext: UserContext,
    options?: {
      tokenBudget?: number;
      strategy?: CompositionStrategy;
      forceDomains?: KnowledgeDomain[];
    }
  ): Promise<ComposedPacket> {
    const analysis = this.router.analyzeTask(taskDescription);
    const tokenBudget = options?.tokenBudget || 3000;
    const strategy = options?.strategy || 'task_optimized';

    // Determine which domains to include
    const domains = options?.forceDomains || [
      analysis.primaryDomain,
      ...analysis.secondaryDomains,
    ];

    // Collect relevant content from all domains
    const combinedContent: PacketContent = {
      wisdom: [],
      patterns: [],
      gotchas: [],
      examples: [],
      bestPractices: [],
      antiPatterns: [],
      architectureDecisions: [],
      performanceHints: [],
      securityGuidelines: [],
      researchRefs: [],
    };

    for (const domain of domains) {
      const packet = this.domainPackets.get(domain);
      if (packet) {
        // Add content with relevance scoring
        combinedContent.wisdom.push(...this.scoreAndFilter(packet.content.wisdom, analysis.keywords, 'wisdom'));
        combinedContent.patterns.push(...this.scoreAndFilter(packet.content.patterns, analysis.keywords, 'pattern'));
        combinedContent.gotchas.push(...this.scoreAndFilter(packet.content.gotchas, analysis.keywords, 'gotcha'));
        combinedContent.examples.push(...packet.content.examples || []);
        combinedContent.bestPractices.push(...packet.content.bestPractices || []);
        combinedContent.securityGuidelines.push(...packet.content.securityGuidelines || []);
      }
    }

    // Add gotchas based on detected potential issues
    for (const gotchaId of analysis.potentialGotchas) {
      // Find gotcha in all packets
      for (const packet of this.packets.values()) {
        const gotcha = packet.content.gotchas.find(g => g.gotchaId.toLowerCase().includes(gotchaId));
        if (gotcha && !combinedContent.gotchas.some(g => g.id === gotcha.id)) {
          combinedContent.gotchas.unshift(gotcha); // Priority placement
        }
      }
    }

    // Apply skill-level filtering
    const adaptedContent = this.adaptToSkillLevel(combinedContent, userContext.skillProfile);

    // Compose final packet within token budget
    const composed: ComposedPacket = {
      id: crypto.randomUUID(),
      name: `Task Packet: ${analysis.taskType}`,
      sources: domains.map(d => `packet-${d}`),
      content: adaptedContent,
      tokenBudget,
      tokensUsed: this.estimateTokens(adaptedContent),
      strategy,
      userContext,
    };

    this.composedPackets.set(composed.id, composed);

    return composed;
  }

  /**
   * Format a composed packet for LLM injection
   */
  formatForInjection(packet: ComposedPacket, format: 'structured' | 'markdown' | 'compressed' = 'structured'): string {
    switch (format) {
      case 'structured':
        return this.formatStructured(packet);
      case 'markdown':
        return this.formatMarkdown(packet);
      case 'compressed':
        return this.formatCompressed(packet);
      default:
        return this.formatStructured(packet);
    }
  }

  private formatStructured(packet: ComposedPacket): string {
    const lines: string[] = ['<knowledge-context>'];

    if (packet.content.gotchas.length > 0) {
      lines.push('<critical-warnings>');
      for (const gotcha of packet.content.gotchas.slice(0, 3)) {
        lines.push(`  <warning severity="${gotcha.severity}">`);
        lines.push(`    <title>${gotcha.title}</title>`);
        lines.push(`    <symptom>${gotcha.symptom}</symptom>`);
        lines.push(`    <prevention>${gotcha.prevention}</prevention>`);
        lines.push(`  </warning>`);
      }
      lines.push('</critical-warnings>');
    }

    if (packet.content.wisdom.length > 0) {
      lines.push('<expert-guidance>');
      for (const wisdom of packet.content.wisdom.slice(0, 3)) {
        lines.push(`  <wisdom id="${wisdom.wisdomId}">${wisdom.content}</wisdom>`);
      }
      lines.push('</expert-guidance>');
    }

    if (packet.content.patterns.length > 0) {
      lines.push('<recommended-patterns>');
      for (const pattern of packet.content.patterns.slice(0, 2)) {
        lines.push(`  <pattern name="${pattern.name}">`);
        lines.push(`    <problem>${pattern.problem}</problem>`);
        lines.push(`    <solution>${pattern.solution}</solution>`);
        if (pattern.codeTemplate) {
          lines.push(`    <template>${pattern.codeTemplate}</template>`);
        }
        lines.push(`  </pattern>`);
      }
      lines.push('</recommended-patterns>');
    }

    if (packet.content.securityGuidelines.length > 0) {
      lines.push('<security-requirements>');
      for (const sec of packet.content.securityGuidelines.slice(0, 2)) {
        lines.push(`  <requirement priority="${sec.priority}">${sec.mitigation}</requirement>`);
      }
      lines.push('</security-requirements>');
    }

    lines.push('</knowledge-context>');

    return lines.join('\n');
  }

  private formatMarkdown(packet: ComposedPacket): string {
    const lines: string[] = ['## Expert Knowledge Context\n'];

    if (packet.content.gotchas.length > 0) {
      lines.push('### ⚠️ Critical Warnings\n');
      for (const gotcha of packet.content.gotchas.slice(0, 3)) {
        lines.push(`**${gotcha.title}**`);
        lines.push(`- Symptom: ${gotcha.symptom}`);
        lines.push(`- Prevention: ${gotcha.prevention}\n`);
      }
    }

    if (packet.content.wisdom.length > 0) {
      lines.push('### 💡 Expert Guidance\n');
      for (const wisdom of packet.content.wisdom.slice(0, 3)) {
        lines.push(`- **${wisdom.wisdomId}**: ${wisdom.content}\n`);
      }
    }

    return lines.join('\n');
  }

  private formatCompressed(packet: ComposedPacket): string {
    // UAA2++ compressed format
    const parts: string[] = [];

    for (const gotcha of packet.content.gotchas.slice(0, 2)) {
      parts.push(`G:${gotcha.gotchaId}:${gotcha.symptom}→${gotcha.fix}`);
    }

    for (const wisdom of packet.content.wisdom.slice(0, 2)) {
      parts.push(`W:${wisdom.wisdomId}:${wisdom.content.slice(0, 100)}`);
    }

    return parts.join('|');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private scoreAndFilter<T extends { id: string }>(items: T[], keywords: string[], type: string): T[] {
    // Would implement semantic similarity in production
    return items;
  }

  private adaptToSkillLevel(content: PacketContent, profile: UserSkillProfile): PacketContent {
    // Filter based on skill level
    // Beginners get more examples, experts get more patterns
    return content;
  }

  private estimateTokens(content: PacketContent): number {
    // Rough estimate: 4 chars per token
    const json = JSON.stringify(content);
    return Math.ceil(json.length / 4);
  }

  /**
   * Get or create user skill profile
   */
  getUserProfile(userId: string): UserSkillProfile {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        overallLevel: 'intermediate',
        domainSkills: {} as Record<KnowledgeDomain, DomainSkill>,
        learningPath: [],
        achievements: [],
        preferences: {
          verbosity: 'balanced',
          showResearch: true,
          includeExamples: true,
          proactiveWarnings: true,
          learningStyle: 'mixed',
        },
      };
      this.userProfiles.set(userId, profile);
    }
    return profile;
  }

  /**
   * Record feedback for effectiveness tracking
   */
  recordFeedback(packetId: string, feedback: {
    userId: string;
    helpful: boolean;
    firstTrySuccess: boolean;
    gotchaPrevented?: boolean;
  }): void {
    const packet = this.packets.get(packetId);
    if (packet) {
      packet.effectiveness.usageCount++;
      if (feedback.firstTrySuccess) {
        packet.effectiveness.firstTrySuccessRate =
          (packet.effectiveness.firstTrySuccessRate * (packet.effectiveness.usageCount - 1) + 1) /
          packet.effectiveness.usageCount;
      }
      if (feedback.gotchaPrevented) {
        packet.effectiveness.gotchaPreventionRate++;
      }
    }
  }

  /**
   * Get available domains
   */
  getAvailableDomains(): KnowledgeDomain[] {
    return Array.from(this.domainPackets.keys());
  }

  /**
   * Get packet by ID
   */
  getPacket(packetId: string): KnowledgePacket | undefined {
    return this.packets.get(packetId);
  }
}

// Export singleton
export const knowledgePacketService = new KnowledgePacketServiceImpl();

// Export classes for testing
export { KnowledgePacketServiceImpl, ExpertiseRouter };
