/**
 * Assistant Internal Orchestration Service
 *
 * Handles complex assistant tasks that require multiple knowledge base
 * packets and coordinated processing using the uAA2++ protocol.
 *
 * The assistant uses internal orchestration for:
 * - Multi-step research queries
 * - Complex troubleshooting workflows
 * - Builder assistance that spans multiple domains
 * - Learning from user interactions
 *
 * @since 2025-12-01
 */

// Types
type AgentPhase =
  | 'INTAKE'
  | 'REFLECT'
  | 'EXECUTE'
  | 'COMPRESS'
  | 'GROW'
  | 'RE-INTAKE'
  | 'EVOLVE'
  | 'AUTONOMIZE';

type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'multi-domain';

type KnowledgeDomain =
  | 'api-integration'
  | 'authentication'
  | 'database'
  | 'frontend'
  | 'backend'
  | 'deployment'
  | 'security'
  | 'troubleshooting'
  | 'best-practices'
  | 'user-preferences';

interface KnowledgePacket {
  id: string;
  domain: KnowledgeDomain;
  content: string;
  relevance: number;
  source: string;
  lastUpdated: Date;
}

interface OrchestrationTask {
  id: string;
  userQuery: string;
  complexity: TaskComplexity;
  requiredDomains: KnowledgeDomain[];
  currentPhase: AgentPhase;
  phaseProgress: number;
  knowledgePackets: KnowledgePacket[];
  intermediateResults: any[];
  finalResponse?: string;
  startedAt: Date;
  completedAt?: Date;
  cycles: number;
}

interface AssistantContext {
  userId: string;
  sessionId: string;
  pageContext: string;
  isBuilderMode: boolean;
  builderPhase?: string;
  previousInteractions: string[];
  userPreferences: Record<string, any>;
}

interface OrchestrationResult {
  response: string;
  confidence: number;
  sources: string[];
  suggestedActions?: string[];
  followUpQuestions?: string[];
  learnedPreferences?: Record<string, any>;
}

/**
 * Assistant Orchestration Service
 *
 * Coordinates complex assistant tasks using internal uAA2++ phases.
 */
class AssistantOrchestrationService {
  private static instance: AssistantOrchestrationService;
  private activeTasks: Map<string, OrchestrationTask> = new Map();
  private knowledgeCache: Map<KnowledgeDomain, KnowledgePacket[]> = new Map();
  private userContextCache: Map<string, AssistantContext> = new Map();

  private constructor() {
    this.initializeKnowledgeCache();
  }

  static getInstance(): AssistantOrchestrationService {
    if (!AssistantOrchestrationService.instance) {
      AssistantOrchestrationService.instance = new AssistantOrchestrationService();
    }
    return AssistantOrchestrationService.instance;
  }

  /**
   * Process a user query through internal orchestration
   */
  async processQuery(
    query: string,
    context: AssistantContext
  ): Promise<OrchestrationResult> {
    // Analyze query complexity
    const complexity = this.analyzeComplexity(query, context);

    // For simple queries, respond directly
    if (complexity === 'simple') {
      return this.handleSimpleQuery(query, context);
    }

    // For complex queries, use full orchestration
    const task = this.createOrchestrationTask(query, complexity, context);
    this.activeTasks.set(task.id, task);

    try {
      // Run through phases
      const result = await this.executeOrchestration(task, context);
      return result;
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Analyze query complexity to determine processing approach
   */
  private analyzeComplexity(query: string, context: AssistantContext): TaskComplexity {
    const lowerQuery = query.toLowerCase();
    const wordCount = query.split(/\s+/).length;

    // Multi-domain indicators
    const domains = this.identifyRequiredDomains(query);
    if (domains.length >= 3) return 'multi-domain';

    // Complex task indicators
    const complexIndicators = [
      'how do i', 'help me', 'troubleshoot', 'debug', 'fix',
      'build', 'create', 'implement', 'integrate', 'migrate',
      'compare', 'analyze', 'optimize', 'secure',
    ];
    const hasComplexIndicator = complexIndicators.some(ind => lowerQuery.includes(ind));

    // Context-based complexity
    if (context.isBuilderMode && hasComplexIndicator) return 'complex';

    // Word count heuristic
    if (wordCount > 20) return 'moderate';
    if (hasComplexIndicator) return 'moderate';

    return 'simple';
  }

  /**
   * Identify knowledge domains required for the query
   */
  private identifyRequiredDomains(query: string): KnowledgeDomain[] {
    const lowerQuery = query.toLowerCase();
    const domains: KnowledgeDomain[] = [];

    const domainKeywords: Record<KnowledgeDomain, string[]> = {
      'api-integration': ['api', 'endpoint', 'rest', 'graphql', 'webhook', 'integration'],
      'authentication': ['auth', 'login', 'password', 'oauth', 'jwt', 'session', 'token'],
      'database': ['database', 'db', 'sql', 'query', 'migration', 'schema', 'supabase'],
      'frontend': ['ui', 'component', 'react', 'css', 'style', 'layout', 'responsive'],
      'backend': ['server', 'route', 'controller', 'middleware', 'node', 'express'],
      'deployment': ['deploy', 'vercel', 'hosting', 'production', 'build', 'ci/cd'],
      'security': ['security', 'vulnerability', 'xss', 'csrf', 'injection', 'encrypt'],
      'troubleshooting': ['error', 'bug', 'issue', 'fail', 'not working', 'broken', 'fix'],
      'best-practices': ['best practice', 'pattern', 'clean code', 'architecture', 'design'],
      'user-preferences': ['prefer', 'like', 'style', 'customize', 'setting'],
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(kw => lowerQuery.includes(kw))) {
        domains.push(domain as KnowledgeDomain);
      }
    }

    return domains.length > 0 ? domains : ['troubleshooting'];
  }

  /**
   * Create an orchestration task
   */
  private createOrchestrationTask(
    query: string,
    complexity: TaskComplexity,
    context: AssistantContext
  ): OrchestrationTask {
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userQuery: query,
      complexity,
      requiredDomains: this.identifyRequiredDomains(query),
      currentPhase: 'INTAKE',
      phaseProgress: 0,
      knowledgePackets: [],
      intermediateResults: [],
      startedAt: new Date(),
      cycles: 0,
    };
  }

  /**
   * Execute full orchestration for complex tasks
   */
  private async executeOrchestration(
    task: OrchestrationTask,
    context: AssistantContext
  ): Promise<OrchestrationResult> {
    const maxCycles = task.complexity === 'multi-domain' ? 3 : 2;

    while (task.cycles < maxCycles) {
      task.cycles++;

      // INTAKE - Understand the query
      await this.executePhase(task, 'INTAKE', async () => {
        const packets = await this.gatherKnowledge(task.requiredDomains);
        task.knowledgePackets = packets;
        return { packetsGathered: packets.length };
      });

      // REFLECT - Analyze and plan
      await this.executePhase(task, 'REFLECT', async () => {
        const analysis = this.analyzeKnowledge(task.knowledgePackets, task.userQuery);
        task.intermediateResults.push({ type: 'analysis', data: analysis });
        return analysis;
      });

      // EXECUTE - Generate response components
      await this.executePhase(task, 'EXECUTE', async () => {
        const responseComponents = await this.generateResponseComponents(
          task,
          context
        );
        task.intermediateResults.push({ type: 'components', data: responseComponents });
        return responseComponents;
      });

      // COMPRESS - Synthesize and optimize
      await this.executePhase(task, 'COMPRESS', async () => {
        const synthesized = this.synthesizeResponse(task.intermediateResults);
        task.intermediateResults.push({ type: 'synthesized', data: synthesized });
        return synthesized;
      });

      // GROW - Learn from this interaction
      await this.executePhase(task, 'GROW', async () => {
        const learnings = this.extractLearnings(task, context);
        return learnings;
      });

      // Check if we need another cycle
      const quality = this.assessResponseQuality(task);
      if (quality >= 0.8 || task.cycles >= maxCycles) {
        break;
      }

      // RE-INTAKE for next cycle
      await this.executePhase(task, 'RE-INTAKE', async () => {
        const gaps = this.identifyKnowledgeGaps(task);
        if (gaps.length > 0) {
          task.requiredDomains = [...new Set([...task.requiredDomains, ...gaps])];
        }
        return { gaps, newDomains: task.requiredDomains };
      });
    }

    // EVOLVE - Finalize with enhancements
    await this.executePhase(task, 'EVOLVE', async () => {
      task.finalResponse = this.buildFinalResponse(task, context);
      return { responseLength: task.finalResponse.length };
    });

    // AUTONOMIZE - Add proactive suggestions
    await this.executePhase(task, 'AUTONOMIZE', async () => {
      return this.generateProactiveSuggestions(task, context);
    });

    task.completedAt = new Date();

    return this.buildOrchestrationResult(task, context);
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    task: OrchestrationTask,
    phase: AgentPhase,
    executor: () => Promise<any>
  ): Promise<void> {
    task.currentPhase = phase;
    task.phaseProgress = 0;

    // Simulate phase execution with progress
    const result = await executor();

    task.phaseProgress = 100;
    task.intermediateResults.push({
      phase,
      result,
      completedAt: new Date(),
    });
  }

  /**
   * Handle simple queries without full orchestration
   */
  private async handleSimpleQuery(
    query: string,
    context: AssistantContext
  ): Promise<OrchestrationResult> {
    const domain = this.identifyRequiredDomains(query)[0];
    const packets = await this.gatherKnowledge([domain]);

    // Quick response generation
    const response = this.generateQuickResponse(query, packets, context);

    return {
      response,
      confidence: 0.85,
      sources: packets.map(p => p.source),
      suggestedActions: this.getSuggestedActions(query, context),
    };
  }

  /**
   * Gather knowledge packets from multiple domains
   */
  private async gatherKnowledge(domains: KnowledgeDomain[]): Promise<KnowledgePacket[]> {
    const packets: KnowledgePacket[] = [];

    for (const domain of domains) {
      const domainPackets = this.knowledgeCache.get(domain) || [];
      packets.push(...domainPackets);
    }

    // Sort by relevance
    return packets.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  /**
   * Analyze gathered knowledge
   */
  private analyzeKnowledge(packets: KnowledgePacket[], query: string): any {
    // In production, this would use semantic analysis
    return {
      relevantTopics: packets.map(p => p.domain),
      keyInsights: packets.slice(0, 3).map(p => p.content.substring(0, 100)),
      confidenceScore: packets.length > 0 ? Math.min(0.9, 0.5 + packets.length * 0.05) : 0.3,
    };
  }

  /**
   * Generate response components
   */
  private async generateResponseComponents(
    task: OrchestrationTask,
    context: AssistantContext
  ): Promise<any> {
    const components = {
      explanation: '',
      steps: [] as string[],
      codeExamples: [] as string[],
      warnings: [] as string[],
      tips: [] as string[],
    };

    // Build explanation from knowledge packets
    const relevantPackets = task.knowledgePackets.slice(0, 5);
    components.explanation = relevantPackets.map(p => p.content).join('\n\n');

    // Generate steps if troubleshooting
    if (task.requiredDomains.includes('troubleshooting')) {
      components.steps = [
        'Check the error message for specific details',
        'Verify your configuration is correct',
        'Test with a minimal example',
        'Check the documentation for updates',
      ];
    }

    // Add context-specific tips
    if (context.isBuilderMode) {
      components.tips.push('I can add this to the task list for automated handling');
    }

    return components;
  }

  /**
   * Synthesize intermediate results into cohesive response
   */
  private synthesizeResponse(results: any[]): any {
    const components = results.find(r => r.type === 'components')?.data;
    const analysis = results.find(r => r.type === 'analysis')?.data;

    return {
      mainResponse: components?.explanation || 'Let me help you with that.',
      supportingSteps: components?.steps || [],
      confidence: analysis?.confidenceScore || 0.7,
    };
  }

  /**
   * Extract learnings from the interaction
   */
  private extractLearnings(task: OrchestrationTask, context: AssistantContext): any {
    return {
      queryPatterns: [task.userQuery.substring(0, 50)],
      effectiveDomains: task.requiredDomains,
      contextFactors: {
        pageContext: context.pageContext,
        builderMode: context.isBuilderMode,
      },
    };
  }

  /**
   * Assess response quality
   */
  private assessResponseQuality(task: OrchestrationTask): number {
    const synthesized = task.intermediateResults.find(r => r.type === 'synthesized')?.data;
    return synthesized?.confidence || 0.5;
  }

  /**
   * Identify knowledge gaps for re-intake
   */
  private identifyKnowledgeGaps(task: OrchestrationTask): KnowledgeDomain[] {
    const gaps: KnowledgeDomain[] = [];
    const currentDomains = new Set(task.knowledgePackets.map(p => p.domain));

    // Check if we need more domains based on query analysis
    const potentialDomains = this.identifyRequiredDomains(task.userQuery);
    for (const domain of potentialDomains) {
      if (!currentDomains.has(domain)) {
        gaps.push(domain);
      }
    }

    return gaps;
  }

  /**
   * Build final response
   */
  private buildFinalResponse(task: OrchestrationTask, context: AssistantContext): string {
    const synthesized = task.intermediateResults.find(r => r.type === 'synthesized')?.data;

    let response = synthesized?.mainResponse || "I'd be happy to help!";

    // Add steps if available
    if (synthesized?.supportingSteps?.length > 0) {
      response += '\n\n**Steps:**\n';
      synthesized.supportingSteps.forEach((step: string, i: number) => {
        response += `${i + 1}. ${step}\n`;
      });
    }

    // Add builder-specific content
    if (context.isBuilderMode) {
      response += '\n\n*Tip: I can handle this automatically if you want me to add it to the build tasks.*';
    }

    return response;
  }

  /**
   * Generate proactive suggestions
   */
  private generateProactiveSuggestions(
    task: OrchestrationTask,
    context: AssistantContext
  ): any {
    const suggestions: string[] = [];

    // Domain-specific suggestions
    if (task.requiredDomains.includes('authentication')) {
      suggestions.push('Set up OAuth providers');
      suggestions.push('Configure session management');
    }

    if (task.requiredDomains.includes('database')) {
      suggestions.push('Review database schema');
      suggestions.push('Set up migrations');
    }

    if (context.isBuilderMode) {
      suggestions.push('Add this to build tasks');
      suggestions.push('Create a checkpoint');
    }

    return {
      suggestedActions: suggestions,
      followUpQuestions: [
        'Would you like me to explain any step in detail?',
        'Should I help you implement this?',
      ],
    };
  }

  /**
   * Build final orchestration result
   */
  private buildOrchestrationResult(
    task: OrchestrationTask,
    context: AssistantContext
  ): OrchestrationResult {
    const proactive = task.intermediateResults.find(r => r.phase === 'AUTONOMIZE')?.result;

    return {
      response: task.finalResponse || "I've analyzed your request.",
      confidence: this.assessResponseQuality(task),
      sources: [...new Set(task.knowledgePackets.map(p => p.source))],
      suggestedActions: proactive?.suggestedActions,
      followUpQuestions: proactive?.followUpQuestions,
    };
  }

  /**
   * Generate quick response for simple queries
   */
  private generateQuickResponse(
    query: string,
    packets: KnowledgePacket[],
    context: AssistantContext
  ): string {
    if (packets.length === 0) {
      return "I'd be happy to help! Could you provide more details about what you're trying to accomplish?";
    }

    return packets[0].content;
  }

  /**
   * Get suggested actions based on query
   */
  private getSuggestedActions(query: string, context: AssistantContext): string[] {
    const actions: string[] = [];

    if (context.isBuilderMode) {
      actions.push('Add to build tasks');
    }

    if (context.pageContext === 'api-setup') {
      actions.push('Test connection');
      actions.push('View documentation');
    }

    return actions;
  }

  /**
   * Initialize knowledge cache with base knowledge
   */
  private initializeKnowledgeCache(): void {
    // API Integration knowledge
    this.knowledgeCache.set('api-integration', [
      {
        id: 'api-1',
        domain: 'api-integration',
        content: 'API keys are sensitive credentials that authenticate your requests. Never expose them in client-side code or commit them to version control.',
        relevance: 0.95,
        source: 'Best Practices Guide',
        lastUpdated: new Date(),
      },
      {
        id: 'api-2',
        domain: 'api-integration',
        content: 'When integrating APIs, always implement proper error handling, rate limiting awareness, and retry logic with exponential backoff.',
        relevance: 0.9,
        source: 'Integration Guide',
        lastUpdated: new Date(),
      },
    ]);

    // Authentication knowledge
    this.knowledgeCache.set('authentication', [
      {
        id: 'auth-1',
        domain: 'authentication',
        content: 'For most applications, we recommend using Supabase Auth with magic links or OAuth providers for a secure, user-friendly authentication experience.',
        relevance: 0.95,
        source: 'Auth Setup Guide',
        lastUpdated: new Date(),
      },
    ]);

    // Troubleshooting knowledge
    this.knowledgeCache.set('troubleshooting', [
      {
        id: 'trouble-1',
        domain: 'troubleshooting',
        content: 'When troubleshooting errors, start by reading the full error message and stack trace. Check browser console and server logs for additional context.',
        relevance: 0.9,
        source: 'Troubleshooting Guide',
        lastUpdated: new Date(),
      },
      {
        id: 'trouble-2',
        domain: 'troubleshooting',
        content: 'Common connection issues: Invalid API keys, CORS errors, network timeouts, and incorrect endpoint URLs. Always verify your environment variables.',
        relevance: 0.85,
        source: 'Common Issues',
        lastUpdated: new Date(),
      },
    ]);

    // Best practices knowledge
    this.knowledgeCache.set('best-practices', [
      {
        id: 'bp-1',
        domain: 'best-practices',
        content: 'Follow the principle of least privilege when setting tool permissions. Only enable what you need for the current task.',
        relevance: 0.9,
        source: 'Security Best Practices',
        lastUpdated: new Date(),
      },
    ]);
  }

  /**
   * Get current orchestration status
   */
  getTaskStatus(taskId: string): OrchestrationTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): OrchestrationTask[] {
    return Array.from(this.activeTasks.values());
  }
}

// Export singleton instance
export const assistantOrchestration = AssistantOrchestrationService.getInstance();

// Export types
export type {
  OrchestrationTask,
  AssistantContext,
  OrchestrationResult,
  KnowledgeDomain,
  KnowledgePacket,
  TaskComplexity,
  AgentPhase,
};

export default assistantOrchestration;
