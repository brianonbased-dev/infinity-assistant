/**
 * Research Synthesizer
 *
 * Fuses academic research with practical production experience.
 * Uses your Master's degree research, coding tutorials (beginner to expert),
 * game development knowledge, and integration expertise.
 *
 * This creates UNIQUE content no competitor has:
 * 1. Academic rigor + practical application
 * 2. Skill progression paths (beginner → expert)
 * 3. Cross-domain pattern recognition
 * 4. Research-backed best practices
 * 5. Real-world gotcha prevention
 */

import type {
  KnowledgeDomain,
  WisdomEntry,
  PatternEntry,
  GotchaEntry,
  BestPractice,
  ResearchReference,
  CodeExample,
  SkillLevel,
} from '@/types/knowledge-packet';

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchSource {
  id: string;
  type: 'academic' | 'book' | 'tutorial' | 'documentation' | 'production_experience' | 'case_study';
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  domain: KnowledgeDomain;
  skillLevel: SkillLevel;
  content: string;
  keyInsights: string[];
  codeExamples?: string[];
  citations?: number;
  credibilityScore: number; // 0-1
}

export interface SynthesizedKnowledge {
  id: string;
  title: string;
  domain: KnowledgeDomain;
  skillLevels: SkillLevel[];

  /** The fused insight */
  synthesis: string;

  /** Source breakdown */
  academicFoundation: string;
  practicalApplication: string;

  /** Confidence based on source quality */
  confidence: number;

  /** Sources that contributed */
  sources: ResearchSource[];

  /** Generated artifacts */
  wisdom?: WisdomEntry;
  patterns?: PatternEntry[];
  gotchas?: GotchaEntry[];
  examples?: CodeExample[];
  bestPractices?: BestPractice[];

  /** Cross-domain connections discovered */
  crossDomainConnections: CrossDomainConnection[];
}

export interface CrossDomainConnection {
  fromDomain: KnowledgeDomain;
  toDomain: KnowledgeDomain;
  pattern: string;
  description: string;
  applicationExamples: string[];
}

export interface LearningPath {
  id: string;
  name: string;
  domain: KnowledgeDomain;
  description: string;
  levels: LearningLevel[];
  estimatedHours: number;
  prerequisites: string[];
}

export interface LearningLevel {
  level: SkillLevel;
  topics: LearningTopic[];
  milestones: string[];
  assessmentCriteria: string[];
}

export interface LearningTopic {
  id: string;
  name: string;
  description: string;
  concepts: string[];
  practiceProjects: string[];
  resources: ResearchSource[];
  estimatedHours: number;
}

// ============================================================================
// KNOWLEDGE CATEGORIES FROM YOUR RESEARCH
// ============================================================================

/**
 * Categories based on your knowledge base structure
 */
export const KNOWLEDGE_CATEGORIES = {
  /**
   * Master's degree level research
   */
  academic: {
    areas: [
      'distributed_systems',
      'parallel_processing',
      'knowledge_compression',
      'ai_autonomy',
      'multi_agent_coordination',
      'semantic_search',
      'knowledge_graphs',
      'pattern_recognition',
      'continual_learning',
    ],
    sourceTypes: ['paper', 'thesis', 'conference'] as const,
    minCitations: 10,
  },

  /**
   * Beginner to Expert coding tutorials
   */
  tutorials: {
    skillProgression: ['beginner', 'intermediate', 'advanced', 'expert'] as const,
    domains: [
      'web_development',
      'mobile_development',
      'backend_systems',
      'database_design',
      'api_design',
      'testing',
    ],
    formats: ['step_by_step', 'project_based', 'concept_explanation'] as const,
  },

  /**
   * Game development expertise
   */
  gamedev: {
    engines: ['unity', 'unreal', 'godot', 'phaser', 'three_js'],
    concepts: [
      'game_loop',
      'entity_component_system',
      'physics_simulation',
      'ai_behavior_trees',
      'networking_multiplayer',
      'procedural_generation',
      'shader_programming',
    ],
    genres: ['2d_platformer', '3d_fps', 'rpg', 'strategy', 'puzzle'],
  },

  /**
   * Integration expertise
   */
  integrations: {
    providers: [
      'stripe',
      'supabase',
      'firebase',
      'twilio',
      'sendgrid',
      'openai',
      'anthropic',
      'discord',
      'slack',
      'github',
    ],
    patterns: [
      'webhook_handling',
      'oauth_flows',
      'api_versioning',
      'rate_limiting',
      'error_handling',
      'idempotency',
    ],
  },
};

// ============================================================================
// RESEARCH SYNTHESIZER SERVICE
// ============================================================================

class ResearchSynthesizerImpl {
  private sources: Map<string, ResearchSource> = new Map();
  private synthesized: Map<string, SynthesizedKnowledge> = new Map();
  private learningPaths: Map<string, LearningPath> = new Map();
  private crossDomainPatterns: CrossDomainConnection[] = [];

  constructor() {
    this.initializeKnowledgeBase();
  }

  /**
   * Initialize with your research base
   */
  private initializeKnowledgeBase(): void {
    // Load from UAA2++ compressed wisdom
    this.loadCompressedWisdom();

    // Initialize cross-domain patterns
    this.discoverCrossDomainPatterns();

    // Build learning paths
    this.buildLearningPaths();
  }

  /**
   * Load wisdom from UAA2++ protocol research
   */
  private loadCompressedWisdom(): void {
    // These would be loaded from your actual research files
    const compressedWisdom: Array<{
      id: string;
      content: string;
      domain: KnowledgeDomain;
      pattern?: string;
      when: string;
      result: string;
    }> = [
      {
        id: 'W.1001',
        content: 'Parallel processing enables simultaneous execution through data, task, and model parallelism',
        domain: 'backend_systems',
        pattern: 'Fork-join model for independent tasks',
        when: 'Large datasets, independent operations, distributed systems',
        result: '10-1000x speedup for parallelizable workloads',
      },
      {
        id: 'W.1002',
        content: 'Autonomous agents need RL for learning, planning for strategy, and safety constraints',
        domain: 'ai_ml',
        pattern: 'Exploration-exploitation balance',
        when: 'Dynamic environments, uncertain outcomes',
        result: 'Agents that learn, adapt, and operate safely',
      },
      {
        id: 'W.1003',
        content: '93-96% compression achievable while maintaining 100% insight preservation',
        domain: 'ai_ml',
        pattern: 'Extract patterns → Remove redundancy → Preserve relationships',
        when: 'Large knowledge bases, research synthesis',
        result: 'Minimal storage with maximum understanding',
      },
      {
        id: 'W.1004',
        content: 'CAP theorem: choose 2 of 3 (Consistency, Availability, Partition tolerance)',
        domain: 'system_design',
        pattern: 'Event-driven architecture, consensus protocols',
        when: 'Scalable systems, fault tolerance required',
        result: 'Systems that scale horizontally and handle failures',
      },
      {
        id: 'W.1006',
        content: 'Vector embeddings + RAG systems enable understanding-based retrieval',
        domain: 'ai_ml',
        pattern: 'Embed → Search → Retrieve → Generate',
        when: 'Large corpora, complex queries',
        result: 'Relevant results even with semantic variations',
      },
      {
        id: 'W.1007',
        content: 'Knowledge graphs capture relationships enabling complex query patterns and reasoning',
        domain: 'database_design',
        pattern: 'Entity extraction → Relationship identification → Graph construction',
        when: 'Complex domains, relationship-heavy data',
        result: 'Deeper understanding through relationship traversal',
      },
      {
        id: 'W.1010',
        content: 'Swarm intelligence enables coordination without central control',
        domain: 'system_design',
        pattern: 'Local rules → Global behavior',
        when: 'Distributed systems, swarm robotics',
        result: 'Robust, scalable coordination',
      },
    ];

    for (const wisdom of compressedWisdom) {
      this.sources.set(wisdom.id, {
        id: wisdom.id,
        type: 'academic',
        title: wisdom.content.slice(0, 50) + '...',
        domain: wisdom.domain,
        skillLevel: 'advanced',
        content: wisdom.content,
        keyInsights: [wisdom.pattern || '', wisdom.when, wisdom.result].filter(Boolean),
        credibilityScore: 0.95,
      });
    }
  }

  /**
   * Discover patterns that apply across domains
   */
  private discoverCrossDomainPatterns(): void {
    this.crossDomainPatterns = [
      {
        fromDomain: 'game_development',
        toDomain: 'web_development',
        pattern: 'State Machine Pattern',
        description: 'Game state management patterns apply perfectly to complex UI flows',
        applicationExamples: [
          'Multi-step form wizards',
          'Authentication flows',
          'E-commerce checkout',
          'Onboarding sequences',
        ],
      },
      {
        fromDomain: 'game_development',
        toDomain: 'real_time',
        pattern: 'Delta Sync / Interpolation',
        description: 'Game networking techniques for real-time collaborative apps',
        applicationExamples: [
          'Collaborative document editing',
          'Real-time dashboards',
          'Multiplayer games',
          'Live cursors (Figma-style)',
        ],
      },
      {
        fromDomain: 'ai_ml',
        toDomain: 'database_design',
        pattern: 'Vector Similarity Search',
        description: 'Embedding-based search transforms database queries',
        applicationExamples: [
          'Semantic search',
          'Recommendation engines',
          'Duplicate detection',
          'Content clustering',
        ],
      },
      {
        fromDomain: 'system_design',
        toDomain: 'web_development',
        pattern: 'Event Sourcing',
        description: 'Backend event sourcing patterns for frontend state',
        applicationExamples: [
          'Undo/redo functionality',
          'Time-travel debugging',
          'Audit logs',
          'Offline-first apps',
        ],
      },
      {
        fromDomain: 'game_development',
        toDomain: 'ai_ml',
        pattern: 'Behavior Trees',
        description: 'Game AI patterns for autonomous agent orchestration',
        applicationExamples: [
          'LLM agent workflows',
          'Automated testing',
          'Bot behavior',
          'Process automation',
        ],
      },
      {
        fromDomain: 'performance',
        toDomain: 'web_development',
        pattern: 'Object Pooling',
        description: 'Game optimization technique for React/DOM performance',
        applicationExamples: [
          'Virtual scrolling',
          'Canvas rendering',
          'Particle effects',
          'Chat message rendering',
        ],
      },
    ];
  }

  /**
   * Build skill progression learning paths
   */
  private buildLearningPaths(): void {
    // Web Development Learning Path
    this.learningPaths.set('web-dev-path', {
      id: 'web-dev-path',
      name: 'Full-Stack Web Development',
      domain: 'web_development',
      description: 'Complete path from beginner to expert web developer',
      estimatedHours: 500,
      prerequisites: ['Basic computer skills', 'Logical thinking'],
      levels: [
        {
          level: 'beginner',
          topics: [
            {
              id: 'html-basics',
              name: 'HTML Fundamentals',
              description: 'Learn the building blocks of web pages',
              concepts: ['Elements', 'Attributes', 'Semantic HTML', 'Forms', 'Accessibility basics'],
              practiceProjects: ['Personal bio page', 'Contact form', 'Recipe page'],
              resources: [],
              estimatedHours: 20,
            },
            {
              id: 'css-basics',
              name: 'CSS Fundamentals',
              description: 'Style your web pages',
              concepts: ['Selectors', 'Box model', 'Flexbox', 'Grid', 'Responsive design'],
              practiceProjects: ['Style the bio page', 'Responsive layout', 'CSS art'],
              resources: [],
              estimatedHours: 30,
            },
            {
              id: 'js-basics',
              name: 'JavaScript Basics',
              description: 'Add interactivity to web pages',
              concepts: ['Variables', 'Functions', 'DOM manipulation', 'Events', 'Basic async'],
              practiceProjects: ['Todo list', 'Calculator', 'Form validation'],
              resources: [],
              estimatedHours: 40,
            },
          ],
          milestones: ['Build a complete static website', 'Implement form with validation'],
          assessmentCriteria: ['Semantic HTML usage', 'Responsive design', 'Working JavaScript'],
        },
        {
          level: 'intermediate',
          topics: [
            {
              id: 'react-fundamentals',
              name: 'React Fundamentals',
              description: 'Build dynamic UIs with React',
              concepts: ['Components', 'Props', 'State', 'Hooks', 'Context'],
              practiceProjects: ['Weather app', 'Note-taking app', 'Shopping cart'],
              resources: [],
              estimatedHours: 50,
            },
            {
              id: 'typescript',
              name: 'TypeScript',
              description: 'Type-safe JavaScript',
              concepts: ['Types', 'Interfaces', 'Generics', 'Type guards', 'Utility types'],
              practiceProjects: ['Convert JS project to TS', 'Type a REST API client'],
              resources: [],
              estimatedHours: 30,
            },
          ],
          milestones: ['Build a full CRUD application', 'Implement authentication'],
          assessmentCriteria: ['Component architecture', 'State management', 'Type safety'],
        },
        {
          level: 'advanced',
          topics: [
            {
              id: 'nextjs',
              name: 'Next.js & Full-Stack',
              description: 'Production-ready React applications',
              concepts: ['SSR/SSG', 'API routes', 'Middleware', 'Image optimization', 'Deployment'],
              practiceProjects: ['Blog with CMS', 'E-commerce store', 'SaaS dashboard'],
              resources: [],
              estimatedHours: 60,
            },
            {
              id: 'database-design',
              name: 'Database Design & ORMs',
              description: 'Design and interact with databases',
              concepts: ['Schema design', 'Relations', 'Indexes', 'Migrations', 'Prisma/Drizzle'],
              practiceProjects: ['Design a SaaS database', 'Implement RLS'],
              resources: [],
              estimatedHours: 40,
            },
          ],
          milestones: ['Deploy a production application', 'Handle real user traffic'],
          assessmentCriteria: ['Performance optimization', 'Security best practices', 'Scalability'],
        },
        {
          level: 'expert',
          topics: [
            {
              id: 'system-design',
              name: 'System Design',
              description: 'Architect scalable systems',
              concepts: ['Load balancing', 'Caching', 'Message queues', 'Microservices', 'Observability'],
              practiceProjects: ['Design a Twitter-like system', 'Design a real-time collaboration tool'],
              resources: [],
              estimatedHours: 80,
            },
            {
              id: 'performance',
              name: 'Performance Engineering',
              description: 'Optimize for speed and efficiency',
              concepts: ['Profiling', 'Bundle optimization', 'Database tuning', 'CDN strategy'],
              practiceProjects: ['Optimize a slow application', 'Implement edge computing'],
              resources: [],
              estimatedHours: 40,
            },
          ],
          milestones: ['Lead architecture decisions', 'Mentor junior developers'],
          assessmentCriteria: ['System design skills', 'Technical leadership', 'Cross-domain knowledge'],
        },
      ],
    });

    // Game Development Learning Path
    this.learningPaths.set('gamedev-path', {
      id: 'gamedev-path',
      name: 'Game Development',
      domain: 'game_development',
      description: 'From zero to game developer',
      estimatedHours: 400,
      prerequisites: ['Basic programming'],
      levels: [
        {
          level: 'beginner',
          topics: [
            {
              id: 'game-loop',
              name: 'Game Loop & Basics',
              description: 'Understand the core game loop',
              concepts: ['Update cycle', 'Render cycle', 'Delta time', 'Input handling'],
              practiceProjects: ['Pong clone', 'Snake game'],
              resources: [],
              estimatedHours: 30,
            },
          ],
          milestones: ['Create a playable game'],
          assessmentCriteria: ['Working game loop', 'Input handling', 'Basic collision'],
        },
        {
          level: 'intermediate',
          topics: [
            {
              id: 'ecs',
              name: 'Entity Component Systems',
              description: 'Scalable game architecture',
              concepts: ['Entities', 'Components', 'Systems', 'Composition over inheritance'],
              practiceProjects: ['Refactor game to ECS', 'Add multiple entity types'],
              resources: [],
              estimatedHours: 40,
            },
          ],
          milestones: ['Complex game with multiple systems'],
          assessmentCriteria: ['Clean architecture', 'Extensible design'],
        },
        {
          level: 'advanced',
          topics: [
            {
              id: 'multiplayer',
              name: 'Multiplayer & Networking',
              description: 'Real-time multiplayer games',
              concepts: ['Client-server model', 'State sync', 'Lag compensation', 'Prediction'],
              practiceProjects: ['Multiplayer game', 'Real-time leaderboard'],
              resources: [],
              estimatedHours: 60,
            },
          ],
          milestones: ['Working multiplayer game'],
          assessmentCriteria: ['Network code', 'Cheat prevention', 'Smooth experience'],
        },
        {
          level: 'expert',
          topics: [
            {
              id: 'procedural',
              name: 'Procedural Generation',
              description: 'Generate infinite content',
              concepts: ['Noise functions', 'Wave function collapse', 'L-systems', 'PCG algorithms'],
              practiceProjects: ['Procedural dungeon', 'Terrain generator'],
              resources: [],
              estimatedHours: 50,
            },
          ],
          milestones: ['Publish a game'],
          assessmentCriteria: ['Polish', 'Performance', 'Player engagement'],
        },
      ],
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Synthesize knowledge from multiple sources
   */
  async synthesize(
    topic: string,
    targetDomains: KnowledgeDomain[],
    skillLevel: SkillLevel
  ): Promise<SynthesizedKnowledge> {
    const id = crypto.randomUUID();

    // Find relevant sources
    const relevantSources = this.findRelevantSources(topic, targetDomains, skillLevel);

    // Separate academic and practical sources
    const academic = relevantSources.filter(s => s.type === 'academic' || s.type === 'book');
    const practical = relevantSources.filter(s => s.type !== 'academic' && s.type !== 'book');

    // Find cross-domain connections
    const connections = this.findCrossDomainConnections(targetDomains);

    // Build synthesis
    const synthesis: SynthesizedKnowledge = {
      id,
      title: topic,
      domain: targetDomains[0],
      skillLevels: [skillLevel],
      synthesis: this.createSynthesis(academic, practical, connections),
      academicFoundation: academic.map(s => s.keyInsights.join('; ')).join(' | '),
      practicalApplication: practical.map(s => s.keyInsights.join('; ')).join(' | '),
      confidence: this.calculateConfidence(relevantSources),
      sources: relevantSources,
      crossDomainConnections: connections,
    };

    // Generate artifacts
    synthesis.wisdom = this.generateWisdomEntry(synthesis);
    synthesis.patterns = this.generatePatterns(synthesis);
    synthesis.gotchas = this.generateGotchas(synthesis);

    this.synthesized.set(id, synthesis);

    return synthesis;
  }

  /**
   * Get learning path for a domain
   */
  getLearningPath(domain: KnowledgeDomain): LearningPath | undefined {
    for (const path of this.learningPaths.values()) {
      if (path.domain === domain) return path;
    }
    return undefined;
  }

  /**
   * Get all learning paths
   */
  getAllLearningPaths(): LearningPath[] {
    return Array.from(this.learningPaths.values());
  }

  /**
   * Get cross-domain patterns
   */
  getCrossDomainPatterns(forDomain?: KnowledgeDomain): CrossDomainConnection[] {
    if (!forDomain) return this.crossDomainPatterns;

    return this.crossDomainPatterns.filter(
      p => p.fromDomain === forDomain || p.toDomain === forDomain
    );
  }

  /**
   * Get content adapted to skill level
   */
  getContentForSkillLevel<T>(
    content: T[],
    skillLevel: SkillLevel,
    accessor: (item: T) => SkillLevel
  ): T[] {
    const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
    const targetIndex = levelOrder.indexOf(skillLevel);

    return content.filter(item => {
      const itemLevel = accessor(item);
      if (itemLevel === 'all') return true;
      const itemIndex = levelOrder.indexOf(itemLevel);
      return itemIndex <= targetIndex;
    });
  }

  /**
   * Apply game development patterns to other domains
   */
  applyGameDevPattern(pattern: string, targetDomain: KnowledgeDomain): {
    adaptation: string;
    examples: string[];
    codeTemplate?: string;
  } {
    const adaptations: Record<string, Partial<Record<KnowledgeDomain, { adaptation: string; examples: string[]; code?: string }>>> = {
      'state_machine': {
        web_development: {
          adaptation: 'Use XState or Zustand with finite states for complex UI flows',
          examples: ['Multi-step forms', 'Auth flows', 'Checkout process'],
          code: `
// Game-inspired state machine for checkout
const checkoutMachine = createMachine({
  initial: 'cart',
  states: {
    cart: { on: { PROCEED: 'shipping' } },
    shipping: { on: { NEXT: 'payment', BACK: 'cart' } },
    payment: { on: { PAY: 'processing', BACK: 'shipping' } },
    processing: { on: { SUCCESS: 'complete', FAILURE: 'payment' } },
    complete: { type: 'final' },
  },
});`,
        },
        ai_ml: {
          adaptation: 'Agent behavior modeling with explicit states and transitions',
          examples: ['LLM agent modes', 'Workflow automation', 'Error recovery'],
        },
      },
      'entity_component_system': {
        web_development: {
          adaptation: 'Composition-based component architecture',
          examples: ['Headless UI patterns', 'Render props', 'Hooks composition'],
        },
        database_design: {
          adaptation: 'Flexible schema with component tables and join tables',
          examples: ['CMS content types', 'Product variants', 'User preferences'],
        },
      },
      'delta_sync': {
        real_time: {
          adaptation: 'Send only changed data over WebSocket',
          examples: ['Collaborative editing', 'Live dashboards', 'Multiplayer sync'],
          code: `
// Delta sync for collaborative editing
function createDelta(prev, current) {
  return {
    added: current.filter(c => !prev.find(p => p.id === c.id)),
    removed: prev.filter(p => !current.find(c => c.id === p.id)),
    modified: current.filter(c => {
      const p = prev.find(x => x.id === c.id);
      return p && JSON.stringify(p) !== JSON.stringify(c);
    }),
  };
}`,
        },
      },
    };

    const patternAdaptations = adaptations[pattern.toLowerCase().replace(/ /g, '_')];
    if (!patternAdaptations || !patternAdaptations[targetDomain]) {
      return {
        adaptation: `Apply ${pattern} principles to ${targetDomain}`,
        examples: ['Research specific applications'],
      };
    }

    const result = patternAdaptations[targetDomain];
    return {
      adaptation: result.adaptation,
      examples: result.examples,
      codeTemplate: result.code,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private findRelevantSources(
    topic: string,
    domains: KnowledgeDomain[],
    skillLevel: SkillLevel
  ): ResearchSource[] {
    const results: ResearchSource[] = [];
    const topicLower = topic.toLowerCase();

    for (const source of this.sources.values()) {
      // Check domain match
      if (!domains.includes(source.domain) && source.domain !== 'general') continue;

      // Check skill level compatibility
      if (source.skillLevel !== 'all' && source.skillLevel !== skillLevel) {
        const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const sourceIndex = levels.indexOf(source.skillLevel);
        const targetIndex = levels.indexOf(skillLevel);
        if (sourceIndex > targetIndex) continue; // Don't show advanced content to beginners
      }

      // Check content relevance
      if (
        source.content.toLowerCase().includes(topicLower) ||
        source.keyInsights.some(i => i.toLowerCase().includes(topicLower))
      ) {
        results.push(source);
      }
    }

    return results.sort((a, b) => b.credibilityScore - a.credibilityScore);
  }

  private findCrossDomainConnections(domains: KnowledgeDomain[]): CrossDomainConnection[] {
    return this.crossDomainPatterns.filter(
      p => domains.includes(p.fromDomain) || domains.includes(p.toDomain)
    );
  }

  private createSynthesis(
    academic: ResearchSource[],
    practical: ResearchSource[],
    connections: CrossDomainConnection[]
  ): string {
    const parts: string[] = [];

    if (academic.length > 0) {
      parts.push(`**Research Foundation**: ${academic.map(a => a.keyInsights[0]).join('. ')}`);
    }

    if (practical.length > 0) {
      parts.push(`**Practical Application**: ${practical.map(p => p.keyInsights[0]).join('. ')}`);
    }

    if (connections.length > 0) {
      parts.push(`**Cross-Domain Insight**: ${connections[0].description}`);
    }

    return parts.join('\n\n');
  }

  private calculateConfidence(sources: ResearchSource[]): number {
    if (sources.length === 0) return 0;

    const avgCredibility = sources.reduce((sum, s) => sum + s.credibilityScore, 0) / sources.length;
    const hasAcademic = sources.some(s => s.type === 'academic');
    const hasPractical = sources.some(s => s.type !== 'academic');

    let confidence = avgCredibility;
    if (hasAcademic && hasPractical) confidence += 0.1; // Bonus for both types
    if (sources.length >= 3) confidence += 0.05; // Bonus for multiple sources

    return Math.min(1, confidence);
  }

  private generateWisdomEntry(synthesis: SynthesizedKnowledge): WisdomEntry {
    return {
      id: `w-${synthesis.id.slice(0, 8)}`,
      title: synthesis.title,
      content: synthesis.synthesis,
      wisdomId: `W.SYN.${Date.now().toString(36).toUpperCase()}`,
      applicableWhen: synthesis.crossDomainConnections.map(c => c.description),
      expectedOutcome: 'Research-backed, production-tested approach',
      confidence: synthesis.confidence,
    };
  }

  private generatePatterns(synthesis: SynthesizedKnowledge): PatternEntry[] {
    return synthesis.crossDomainConnections.map((conn, i) => ({
      id: `p-${synthesis.id.slice(0, 8)}-${i}`,
      name: conn.pattern,
      patternId: `P.XD.${i.toString().padStart(2, '0')}`,
      problem: `Need ${conn.pattern.toLowerCase()} capability in ${conn.toDomain}`,
      solution: conn.description,
      context: `Applying ${conn.fromDomain} patterns to ${conn.toDomain}`,
      consequences: conn.applicationExamples,
      relatedPatterns: [],
    }));
  }

  private generateGotchas(synthesis: SynthesizedKnowledge): GotchaEntry[] {
    // Would generate based on common pitfalls
    return [];
  }
}

// Export singleton
export const researchSynthesizer = new ResearchSynthesizerImpl();

// Export class for testing
export { ResearchSynthesizerImpl };
