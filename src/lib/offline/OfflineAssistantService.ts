/**
 * Offline Assistant Service
 *
 * Provides basic assistant capabilities when offline.
 * Uses local knowledge base and user memories to generate helpful responses.
 *
 * OFFLINE CAPABILITIES:
 * 1. Search embedded knowledge (wisdom, patterns, gotchas)
 * 2. Use user's personal memories for context
 * 3. Generate templated responses for common queries
 * 4. Queue messages for later AI processing when back online
 */

import {
  getOfflinePersistence,
  OfflineMessage,
  OfflineMemory,
  OfflineKnowledge,
} from './OfflinePersistenceService';
import { getAssistantKnowledgeService } from '@/lib/knowledge/AssistantKnowledgeService';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineResponse {
  content: string;
  source: 'offline-knowledge' | 'offline-memory' | 'offline-template' | 'queued';
  confidence: number;
  relatedKnowledge?: OfflineKnowledge[];
  relatedMemories?: OfflineMemory[];
  queuedForOnline?: boolean;
}

interface QueryAnalysis {
  type: 'question' | 'request' | 'statement' | 'greeting';
  intent: 'search' | 'how-to' | 'definition' | 'comparison' | 'advice' | 'general';
  keywords: string[];
  domain?: string;
}

// ============================================================================
// QUERY ANALYSIS
// ============================================================================

/**
 * Analyze user query to determine response strategy
 */
function analyzeQuery(query: string): QueryAnalysis {
  const queryLower = query.toLowerCase().trim();
  const keywords = extractKeywords(queryLower);

  // Determine query type
  let type: QueryAnalysis['type'] = 'statement';
  if (queryLower.includes('?')) {
    type = 'question';
  } else if (/^(can you|please|could you|help|show|tell)/i.test(queryLower)) {
    type = 'request';
  } else if (/^(hi|hello|hey|good|thanks)/i.test(queryLower)) {
    type = 'greeting';
  }

  // Determine intent
  let intent: QueryAnalysis['intent'] = 'general';
  if (/^(what is|define|meaning|definition)/i.test(queryLower)) {
    intent = 'definition';
  } else if (/^(how (to|do|can)|ways to|steps)/i.test(queryLower)) {
    intent = 'how-to';
  } else if (/(compare|versus|vs|difference|better)/i.test(queryLower)) {
    intent = 'comparison';
  } else if (/(should|advice|recommend|suggest|best)/i.test(queryLower)) {
    intent = 'advice';
  } else if (type === 'question') {
    intent = 'search';
  }

  // Detect domain
  const domainKeywords: Record<string, string[]> = {
    productivity: ['productivity', 'time', 'focus', 'habit', 'procrastination'],
    business: ['business', 'startup', 'revenue', 'customer', 'market'],
    finance: ['money', 'invest', 'budget', 'save', 'income'],
    health: ['health', 'fitness', 'sleep', 'diet', 'exercise'],
    career: ['career', 'job', 'salary', 'interview', 'resume'],
    learning: ['learn', 'study', 'skill', 'practice', 'improve'],
    coding: ['code', 'react', 'javascript', 'api', 'database'],
  };

  let domain: string | undefined;
  for (const [d, words] of Object.entries(domainKeywords)) {
    if (words.some((w) => queryLower.includes(w))) {
      domain = d;
      break;
    }
  }

  return { type, intent, keywords, domain };
}

/**
 * Extract meaningful keywords from query
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'about', 'into', 'through',
    'what', 'how', 'why', 'when', 'where', 'which', 'who', 'whom',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

// ============================================================================
// RESPONSE TEMPLATES
// ============================================================================

const GREETING_RESPONSES = [
  "Hello! I'm currently offline, but I can still help you search through our knowledge base and your personal memories. What would you like to know?",
  "Hi there! While I'm offline, I can help you with knowledge searches and access your saved memories. How can I help?",
];

const OFFLINE_NOTICE = "\n\n*Note: I'm currently offline. For deeper research and more comprehensive answers, I'll need an internet connection. This response was generated from local knowledge.*";

const NO_RESULTS_RESPONSE = `I couldn't find specific information about that in my offline knowledge base.

**Here's what I can help with offline:**
- Search through saved wisdom, patterns, and gotchas
- Access your personal memories and notes
- Provide general guidance on common topics

Your question has been queued and will be answered fully when you're back online.`;

// ============================================================================
// OFFLINE ASSISTANT SERVICE
// ============================================================================

export class OfflineAssistantService {
  private static instance: OfflineAssistantService;
  private persistence = getOfflinePersistence();
  private knowledgeService = getAssistantKnowledgeService();

  private constructor() {}

  static getInstance(): OfflineAssistantService {
    if (!OfflineAssistantService.instance) {
      OfflineAssistantService.instance = new OfflineAssistantService();
    }
    return OfflineAssistantService.instance;
  }

  /**
   * Generate an offline response to user query
   */
  async generateResponse(
    userId: string,
    conversationId: string,
    query: string
  ): Promise<OfflineResponse> {
    const analysis = analyzeQuery(query);

    // Handle greetings
    if (analysis.type === 'greeting') {
      return {
        content: GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)],
        source: 'offline-template',
        confidence: 1.0,
      };
    }

    // Search knowledge and memories in parallel
    const [knowledgeResults, memoryResults] = await Promise.all([
      this.searchKnowledge(query, analysis),
      this.searchMemories(userId, query, analysis),
    ]);

    // Build response based on what we found
    if (knowledgeResults.length > 0 || memoryResults.length > 0) {
      const response = this.buildResponse(query, analysis, knowledgeResults, memoryResults);
      return {
        content: response + OFFLINE_NOTICE,
        source: knowledgeResults.length > 0 ? 'offline-knowledge' : 'offline-memory',
        confidence: Math.max(
          ...knowledgeResults.map((k) => k.score || 0.5),
          ...memoryResults.map((m) => m.confidence || 0.5),
          0.3
        ),
        relatedKnowledge: knowledgeResults,
        relatedMemories: memoryResults,
      };
    }

    // Queue for online processing
    await this.queueForOnline(userId, conversationId, query);

    return {
      content: NO_RESULTS_RESPONSE,
      source: 'queued',
      confidence: 0.1,
      queuedForOnline: true,
    };
  }

  /**
   * Search embedded knowledge base
   */
  private async searchKnowledge(
    query: string,
    analysis: QueryAnalysis
  ): Promise<OfflineKnowledge[]> {
    // First try cached knowledge from IndexedDB
    const cachedResults = await this.persistence.searchCachedKnowledge(query, {
      domain: analysis.domain,
      limit: 5,
    });

    if (cachedResults.length > 0) {
      return cachedResults;
    }

    // Fall back to embedded knowledge service
    const searchResult = await this.knowledgeService.searchKnowledge(query, {
      maxWisdom: 3,
      maxPatterns: 2,
      maxGotchas: 2,
    });

    // Convert to OfflineKnowledge format
    const results: OfflineKnowledge[] = [];
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    for (const w of searchResult.wisdom) {
      results.push({
        id: w.id,
        type: 'wisdom',
        content: w.wisdom,
        title: w.title,
        domain: w.domain || 'general',
        tags: [],
        score: w.score,
        cachedAt: now,
        expiresAt,
      });
    }

    for (const p of searchResult.patterns) {
      results.push({
        id: p.id,
        type: 'pattern',
        content: p.pattern,
        title: p.name,
        domain: p.domain || 'general',
        tags: [],
        score: p.score,
        cachedAt: now,
        expiresAt,
      });
    }

    for (const g of searchResult.gotchas) {
      results.push({
        id: g.id,
        type: 'gotcha',
        content: `${g.symptom} → ${g.fix}`,
        title: g.title,
        domain: g.domain || 'general',
        tags: [],
        score: g.score,
        cachedAt: now,
        expiresAt,
      });
    }

    // Cache for future use
    if (results.length > 0) {
      await this.persistence.cacheKnowledge(results);
    }

    return results;
  }

  /**
   * Search user's personal memories
   */
  private async searchMemories(
    userId: string,
    query: string,
    analysis: QueryAnalysis
  ): Promise<OfflineMemory[]> {
    return this.persistence.searchMemories(userId, query, {
      limit: 5,
    });
  }

  /**
   * Build a response from knowledge and memories
   */
  private buildResponse(
    query: string,
    analysis: QueryAnalysis,
    knowledge: OfflineKnowledge[],
    memories: OfflineMemory[]
  ): string {
    const parts: string[] = [];

    // Add relevant wisdom
    const wisdomItems = knowledge.filter((k) => k.type === 'wisdom');
    if (wisdomItems.length > 0) {
      parts.push('**Here\'s what I know:**\n');
      for (const w of wisdomItems) {
        parts.push(`- **${w.title}**: ${w.content}`);
      }
      parts.push('');
    }

    // Add relevant patterns
    const patternItems = knowledge.filter((k) => k.type === 'pattern');
    if (patternItems.length > 0) {
      parts.push('**Useful patterns:**\n');
      for (const p of patternItems) {
        parts.push(`- **${p.title}**: ${p.content}`);
      }
      parts.push('');
    }

    // Add gotchas/warnings
    const gotchaItems = knowledge.filter((k) => k.type === 'gotcha');
    if (gotchaItems.length > 0) {
      parts.push('**Watch out for:**\n');
      for (const g of gotchaItems) {
        parts.push(`- **${g.title}**: ${g.content}`);
      }
      parts.push('');
    }

    // Add personal memories
    if (memories.length > 0) {
      parts.push('**From your notes:**\n');
      for (const m of memories) {
        const title = m.title ? `**${m.title}**: ` : '';
        parts.push(`- ${title}${m.content}`);
      }
    }

    return parts.join('\n').trim();
  }

  /**
   * Queue a message for processing when back online
   */
  private async queueForOnline(
    userId: string,
    conversationId: string,
    query: string
  ): Promise<void> {
    const message: OfflineMessage = {
      id: `queued_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      synced: false,
      generatedOffline: false,
      metadata: {
        queuedForOnline: true,
        queuedAt: new Date().toISOString(),
      },
    };

    await this.persistence.saveMessage(message);
  }

  /**
   * Check if we can provide a useful offline response
   */
  async canRespondOffline(query: string): Promise<boolean> {
    const analysis = analyzeQuery(query);

    // Always respond to greetings
    if (analysis.type === 'greeting') {
      return true;
    }

    // Check if we have relevant knowledge
    const knowledge = await this.searchKnowledge(query, analysis);
    return knowledge.length > 0;
  }

  /**
   * Get conversation context for offline mode
   */
  async getConversationContext(
    userId: string,
    conversationId: string
  ): Promise<{
    recentMessages: OfflineMessage[];
    userMemories: OfflineMemory[];
    summary: string;
  }> {
    const [messages, memories] = await Promise.all([
      this.persistence.getRecentMessages(conversationId, 10),
      this.persistence.getUserMemories(userId),
    ]);

    // Build summary
    const relevantMemories = memories.slice(0, 5);
    const summary = this.buildContextSummary(messages, relevantMemories);

    return {
      recentMessages: messages,
      userMemories: relevantMemories,
      summary,
    };
  }

  private buildContextSummary(messages: OfflineMessage[], memories: OfflineMemory[]): string {
    const parts: string[] = [];

    if (messages.length > 0) {
      parts.push(`Recent conversation: ${messages.length} messages`);
    }

    if (memories.length > 0) {
      const wisdomCount = memories.filter((m) => m.type === 'wisdom').length;
      const patternCount = memories.filter((m) => m.type === 'pattern').length;
      if (wisdomCount > 0) parts.push(`${wisdomCount} wisdom items`);
      if (patternCount > 0) parts.push(`${patternCount} patterns`);
    }

    return parts.join(', ');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getOfflineAssistant = (): OfflineAssistantService => {
  return OfflineAssistantService.getInstance();
};
