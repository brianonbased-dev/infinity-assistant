/**
 * Packet Enhancer Service
 *
 * Handles the application of knowledge packets to enhance
 * Assistant and Build modes differently.
 *
 * Assistant Mode Enhancements:
 * - Adds contextual knowledge for better conversation
 * - Provides domain-specific expertise
 * - Enhances responses with relevant insights
 * - Improves understanding of user intent
 *
 * Build Mode Enhancements:
 * - Adds code patterns and templates
 * - Provides architectural guidance
 * - Enhances code generation with best practices
 * - Includes protocol-specific workflows
 *
 * @since 2025-12-01
 */

import { masterRpcClient, type KnowledgePacket } from './MasterRpcClient';
import logger from '@/utils/logger';

// Enhancement result types
export interface AssistantEnhancement {
  contextAdded: boolean;
  domains: string[];
  expertise: string[];
  insights: string[];
  conversationModifiers: ConversationModifier[];
}

export interface BuildEnhancement {
  patternsAdded: boolean;
  templatesAdded: boolean;
  patterns: CodePattern[];
  templates: CodeTemplate[];
  architecturalGuidance: string[];
  workflowSteps: WorkflowStep[];
}

export interface ConversationModifier {
  type: 'knowledge' | 'expertise' | 'context';
  content: string;
  priority: number;
  packetId: string;
}

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  language: string;
  pattern: string;
  usage: string;
  packetId: string;
}

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  template: string;
  variables: string[];
  packetId: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  order: number;
  action: string;
  packetId: string;
}

export interface EnhancementSession {
  sessionId: string;
  mode: 'assistant' | 'build';
  appliedPackets: KnowledgePacket[];
  enhancement: AssistantEnhancement | BuildEnhancement;
  createdAt: Date;
  expiresAt: Date;
}

class PacketEnhancerService {
  private activeSessions: Map<string, EnhancementSession> = new Map();
  private readonly SESSION_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Apply packets to Assistant mode
   * Extracts knowledge, context, and insights for enhanced conversations
   */
  async enhanceAssistantMode(
    sessionId: string,
    packets: KnowledgePacket[]
  ): Promise<AssistantEnhancement> {
    logger.info('[PacketEnhancer] Enhancing Assistant mode', {
      sessionId,
      packetCount: packets.length,
    });

    const enhancement: AssistantEnhancement = {
      contextAdded: packets.length > 0,
      domains: [],
      expertise: [],
      insights: [],
      conversationModifiers: [],
    };

    for (const packet of packets) {
      // Extract domain expertise
      if (!enhancement.domains.includes(packet.domain)) {
        enhancement.domains.push(packet.domain);
      }

      // Process based on packet type
      switch (packet.type) {
        case 'research':
          // Research packets add deep domain knowledge
          enhancement.conversationModifiers.push({
            type: 'knowledge',
            content: packet.content || packet.summary,
            priority: 1,
            packetId: packet.id,
          });
          break;

        case 'insight':
          // Insight packets add actionable insights
          enhancement.insights.push(packet.summary);
          enhancement.conversationModifiers.push({
            type: 'context',
            content: packet.content || packet.summary,
            priority: 2,
            packetId: packet.id,
          });
          break;

        case 'documentation':
          // Documentation packets add reference material
          enhancement.conversationModifiers.push({
            type: 'knowledge',
            content: packet.content || packet.summary,
            priority: 3,
            packetId: packet.id,
          });
          break;

        case 'protocol':
          // Protocol packets add workflow expertise
          enhancement.expertise.push(`${packet.domain}: ${packet.title}`);
          enhancement.conversationModifiers.push({
            type: 'expertise',
            content: packet.content || packet.summary,
            priority: 2,
            packetId: packet.id,
          });
          break;

        case 'pattern':
          // Pattern packets add best practices
          enhancement.expertise.push(`Pattern: ${packet.title}`);
          enhancement.conversationModifiers.push({
            type: 'expertise',
            content: packet.content || packet.summary,
            priority: 2,
            packetId: packet.id,
          });
          break;
      }
    }

    // Sort modifiers by priority
    enhancement.conversationModifiers.sort((a, b) => a.priority - b.priority);

    // Store session
    this.storeSession(sessionId, 'assistant', packets, enhancement);

    // Notify master RPC about enhancement
    await masterRpcClient.enhanceWithPackets('assistant', packets.map((p) => p.id));

    return enhancement;
  }

  /**
   * Apply packets to Build mode
   * Extracts patterns, templates, and workflow steps for enhanced code generation
   */
  async enhanceBuildMode(
    sessionId: string,
    packets: KnowledgePacket[]
  ): Promise<BuildEnhancement> {
    logger.info('[PacketEnhancer] Enhancing Build mode', {
      sessionId,
      packetCount: packets.length,
    });

    const enhancement: BuildEnhancement = {
      patternsAdded: false,
      templatesAdded: false,
      patterns: [],
      templates: [],
      architecturalGuidance: [],
      workflowSteps: [],
    };

    for (const packet of packets) {
      // Process based on packet type
      switch (packet.type) {
        case 'pattern':
          // Pattern packets add code patterns
          enhancement.patternsAdded = true;
          enhancement.patterns.push({
            id: `pattern-${packet.id}`,
            name: packet.title,
            description: packet.summary,
            language: this.detectLanguage(packet),
            pattern: packet.content || '',
            usage: packet.summary,
            packetId: packet.id,
          });
          break;

        case 'protocol':
          // Protocol packets add workflow steps
          const steps = this.extractWorkflowSteps(packet);
          enhancement.workflowSteps.push(...steps);
          break;

        case 'documentation':
          // Documentation packets add templates
          if (this.hasCodeTemplate(packet)) {
            enhancement.templatesAdded = true;
            enhancement.templates.push({
              id: `template-${packet.id}`,
              name: packet.title,
              description: packet.summary,
              language: this.detectLanguage(packet),
              template: packet.content || '',
              variables: this.extractVariables(packet.content || ''),
              packetId: packet.id,
            });
          }
          break;

        case 'research':
          // Research packets add architectural guidance
          enhancement.architecturalGuidance.push(packet.summary);
          break;

        case 'insight':
          // Insight packets add best practice guidance
          enhancement.architecturalGuidance.push(`Best Practice: ${packet.summary}`);
          break;
      }
    }

    // Store session
    this.storeSession(sessionId, 'build', packets, enhancement);

    // Notify master RPC about enhancement
    await masterRpcClient.enhanceWithPackets('build', packets.map((p) => p.id));

    return enhancement;
  }

  /**
   * Get enhancement context for AI prompt injection
   * Returns formatted context that can be added to AI prompts
   */
  getAssistantPromptContext(sessionId: string): string {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.mode !== 'assistant') {
      return '';
    }

    const enhancement = session.enhancement as AssistantEnhancement;
    const contextParts: string[] = [];

    if (enhancement.domains.length > 0) {
      contextParts.push(`[Domain Expertise: ${enhancement.domains.join(', ')}]`);
    }

    if (enhancement.insights.length > 0) {
      contextParts.push(`[Key Insights:\n${enhancement.insights.map((i) => `- ${i}`).join('\n')}]`);
    }

    // Add top priority modifiers
    const topModifiers = enhancement.conversationModifiers.slice(0, 5);
    if (topModifiers.length > 0) {
      contextParts.push(
        `[Knowledge Context:\n${topModifiers.map((m) => m.content).join('\n\n')}]`
      );
    }

    return contextParts.join('\n\n');
  }

  /**
   * Get enhancement context for Build mode AI prompt injection
   * Returns formatted context for code generation prompts
   */
  getBuildPromptContext(sessionId: string): string {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.mode !== 'build') {
      return '';
    }

    const enhancement = session.enhancement as BuildEnhancement;
    const contextParts: string[] = [];

    if (enhancement.architecturalGuidance.length > 0) {
      contextParts.push(
        `[Architectural Guidance:\n${enhancement.architecturalGuidance.map((g) => `- ${g}`).join('\n')}]`
      );
    }

    if (enhancement.patterns.length > 0) {
      contextParts.push(
        `[Available Patterns:\n${enhancement.patterns.map((p) => `- ${p.name}: ${p.description}`).join('\n')}]`
      );
    }

    if (enhancement.workflowSteps.length > 0) {
      const sortedSteps = [...enhancement.workflowSteps].sort((a, b) => a.order - b.order);
      contextParts.push(
        `[Workflow Steps:\n${sortedSteps.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join('\n')}]`
      );
    }

    return contextParts.join('\n\n');
  }

  /**
   * Get code patterns for a specific language
   */
  getPatterns(sessionId: string, language?: string): CodePattern[] {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.mode !== 'build') {
      return [];
    }

    const enhancement = session.enhancement as BuildEnhancement;
    if (language) {
      return enhancement.patterns.filter((p) => p.language === language);
    }
    return enhancement.patterns;
  }

  /**
   * Get code templates for a specific language
   */
  getTemplates(sessionId: string, language?: string): CodeTemplate[] {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.mode !== 'build') {
      return [];
    }

    const enhancement = session.enhancement as BuildEnhancement;
    if (language) {
      return enhancement.templates.filter((t) => t.language === language);
    }
    return enhancement.templates;
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): EnhancementSession | undefined {
    const session = this.activeSessions.get(sessionId);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    return undefined;
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private storeSession(
    sessionId: string,
    mode: 'assistant' | 'build',
    packets: KnowledgePacket[],
    enhancement: AssistantEnhancement | BuildEnhancement
  ): void {
    const now = new Date();
    this.activeSessions.set(sessionId, {
      sessionId,
      mode,
      appliedPackets: packets,
      enhancement,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.SESSION_TTL),
    });
  }

  private detectLanguage(packet: KnowledgePacket): string {
    const content = packet.content || '';
    const tags = packet.metadata.tags;

    // Check tags first
    const languageTags = ['typescript', 'javascript', 'python', 'rust', 'go', 'java'];
    for (const lang of languageTags) {
      if (tags.some((t) => t.toLowerCase() === lang)) {
        return lang;
      }
    }

    // Check content for code markers
    if (content.includes('```typescript') || content.includes('```ts')) return 'typescript';
    if (content.includes('```javascript') || content.includes('```js')) return 'javascript';
    if (content.includes('```python') || content.includes('```py')) return 'python';
    if (content.includes('```rust') || content.includes('```rs')) return 'rust';
    if (content.includes('```go')) return 'go';
    if (content.includes('```java')) return 'java';

    return 'generic';
  }

  private hasCodeTemplate(packet: KnowledgePacket): boolean {
    const content = packet.content || '';
    // Check if content has code blocks that look like templates
    return (
      content.includes('```') &&
      (content.includes('${') || content.includes('{{') || content.includes('<%'))
    );
  }

  private extractVariables(content: string): string[] {
    const variables: string[] = [];

    // Extract ${varName} style
    const dollarMatches = content.matchAll(/\$\{(\w+)\}/g);
    for (const match of dollarMatches) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    // Extract {{varName}} style
    const handlebarMatches = content.matchAll(/\{\{(\w+)\}\}/g);
    for (const match of handlebarMatches) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  private extractWorkflowSteps(packet: KnowledgePacket): WorkflowStep[] {
    const content = packet.content || packet.summary;
    const steps: WorkflowStep[] = [];

    // Simple extraction: look for numbered lists or bullet points
    const lines = content.split('\n');
    let order = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match numbered items like "1." or "1)"
      const numberedMatch = trimmed.match(/^(\d+)[.)]\s*(.+)/);
      if (numberedMatch) {
        order++;
        steps.push({
          id: `step-${packet.id}-${order}`,
          name: `Step ${order}`,
          description: numberedMatch[2],
          order,
          action: numberedMatch[2],
          packetId: packet.id,
        });
        continue;
      }

      // Match bullet items like "- " or "* "
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        order++;
        steps.push({
          id: `step-${packet.id}-${order}`,
          name: `Step ${order}`,
          description: bulletMatch[1],
          order,
          action: bulletMatch[1],
          packetId: packet.id,
        });
      }
    }

    return steps;
  }
}

// Singleton export
export const packetEnhancerService = new PacketEnhancerService();
export default PacketEnhancerService;
