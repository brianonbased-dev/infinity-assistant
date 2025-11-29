/**
 * Training Data Export Service
 *
 * Exports phase-annotated conversation data for QLLM (Brittney) training.
 * Integrates with uaa2-service's MLTrainingDataService format.
 *
 * Export Format:
 * - Conversations annotated with uAA2++ phase metadata
 * - Phase transitions with confidence scores
 * - Knowledge extraction (W/P/G) markers
 * - User preference signals
 *
 * This data feeds into the QLLM training pipeline to help Brittney:
 * - Learn natural phase transitions
 * - Understand user intent patterns
 * - Develop conversational intuition
 * - Build persona characteristics
 */

import type {
  UAA2Phase,
  MemoryEntry,
  ConversationMemory,
  CompressedMemory,
} from './types';
import { getPhaseTransitionService, type PhaseTransitionEvent, type PhaseAnnotatedMessage, type TrainingDataExport } from './PhaseTransitionService';
import { getConversationMemoryService } from './ConversationMemoryService';
import logger from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface QLLMTrainingRecord {
  id: string;
  conversationId: string;
  messageIndex: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  phase: UAA2Phase;
  phaseConfidence: number;
  previousPhase?: UAA2Phase;
  features: {
    messageLength: number;
    hasQuestion: boolean;
    hasCommand: boolean;
    hasCodeBlock: boolean;
    sentimentSignal: 'positive' | 'neutral' | 'negative';
    intentCategory: string;
    topicKeywords: string[];
  };
  timestamp: string;
}

export interface BrittneyTrainingBatch {
  batchId: string;
  createdAt: string;
  records: QLLMTrainingRecord[];
  metadata: {
    sourceService: string;
    totalRecords: number;
    phaseDistribution: Record<UAA2Phase, number>;
    avgConfidence: number;
    uniqueConversations: number;
    dateRange: { start: string; end: string };
  };
}

export interface ExportOptions {
  conversationIds?: string[];
  minConfidence?: number;
  includeCompressed?: boolean;
  includePhaseHistory?: boolean;
  maxRecords?: number;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================================================
// TRAINING DATA EXPORT SERVICE
// ============================================================================

export class TrainingDataExportService {
  private phaseService = getPhaseTransitionService();
  private memoryService = getConversationMemoryService();

  /**
   * Export single conversation as training data
   */
  exportConversation(conversationId: string): TrainingDataExport | null {
    const memory = this.memoryService.getMemory(conversationId);
    if (!memory) {
      return null;
    }

    const phaseContext = this.phaseService.getCurrentPhase(conversationId);
    const transitions = this.phaseService.getTransitions(conversationId);
    const phaseStats = this.phaseService.getPhaseStats(conversationId);

    // Annotate messages with phase data
    const messages: PhaseAnnotatedMessage[] = [];
    let currentPhaseIndex = 0;

    for (const entry of memory.activeMemory) {
      // Find phase for this message based on transitions
      let phase: UAA2Phase = 'intake';
      let confidence = 0.5;

      // Check if any transition occurred at this timestamp
      while (
        currentPhaseIndex < transitions.length &&
        new Date(transitions[currentPhaseIndex].timestamp) <= new Date(entry.createdAt)
      ) {
        phase = transitions[currentPhaseIndex].newPhase;
        confidence = transitions[currentPhaseIndex].confidence;
        currentPhaseIndex++;
      }

      messages.push({
        id: entry.id,
        content: entry.content,
        role: entry.type === 'insight' ? 'system' : entry.type,
        phase: entry.phase || phase,
        phaseConfidence: confidence,
        timestamp: entry.createdAt,
        insights: entry.tags,
      });
    }

    // Calculate metadata
    const timestamps = messages.map(m => new Date(m.timestamp).getTime());
    const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString();
    const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();

    return {
      conversationId,
      userId: memory.userId,
      messages,
      phaseTransitions: transitions,
      metadata: {
        totalMessages: messages.length,
        totalTransitions: transitions.length,
        phaseCounts: phaseStats,
        startTime,
        endTime,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Export as QLLM training records (format for Brittney training)
   */
  exportAsQLLMRecords(conversationId: string): QLLMTrainingRecord[] {
    const exportData = this.exportConversation(conversationId);
    if (!exportData) {
      return [];
    }

    const records: QLLMTrainingRecord[] = [];
    let previousPhase: UAA2Phase | undefined;

    for (let i = 0; i < exportData.messages.length; i++) {
      const message = exportData.messages[i];

      const record: QLLMTrainingRecord = {
        id: `qllm_${conversationId}_${i}`,
        conversationId,
        messageIndex: i,
        role: message.role,
        content: message.content,
        phase: message.phase,
        phaseConfidence: message.phaseConfidence,
        previousPhase,
        features: this.extractFeatures(message.content),
        timestamp: message.timestamp,
      };

      records.push(record);
      previousPhase = message.phase;
    }

    return records;
  }

  /**
   * Create training batch from multiple conversations
   */
  createTrainingBatch(options: ExportOptions = {}): BrittneyTrainingBatch {
    const records: QLLMTrainingRecord[] = [];
    const conversationIds = options.conversationIds || this.getActiveConversationIds();

    for (const conversationId of conversationIds) {
      const convRecords = this.exportAsQLLMRecords(conversationId);

      // Apply filters
      const filtered = convRecords.filter(r => {
        if (options.minConfidence && r.phaseConfidence < options.minConfidence) {
          return false;
        }
        if (options.dateFrom && new Date(r.timestamp) < new Date(options.dateFrom)) {
          return false;
        }
        if (options.dateTo && new Date(r.timestamp) > new Date(options.dateTo)) {
          return false;
        }
        return true;
      });

      records.push(...filtered);

      if (options.maxRecords && records.length >= options.maxRecords) {
        break;
      }
    }

    // Calculate phase distribution
    const phaseDistribution: Record<UAA2Phase, number> = {
      intake: 0, reflect: 0, execute: 0, compress: 0,
      reintake: 0, grow: 0, evolve: 0, autonomize: 0,
    };
    let totalConfidence = 0;

    for (const record of records) {
      phaseDistribution[record.phase]++;
      totalConfidence += record.phaseConfidence;
    }

    const timestamps = records.map(r => new Date(r.timestamp).getTime());
    const uniqueConversations = new Set(records.map(r => r.conversationId)).size;

    return {
      batchId: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      records: options.maxRecords ? records.slice(0, options.maxRecords) : records,
      metadata: {
        sourceService: 'infinityassistant-service',
        totalRecords: records.length,
        phaseDistribution,
        avgConfidence: records.length > 0 ? totalConfidence / records.length : 0,
        uniqueConversations,
        dateRange: {
          start: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString(),
          end: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Export in uaa2-service MLTrainingDataService compatible format
   */
  exportForUAA2Training(): {
    features: number[][];
    labels: number[];
    metadata: {
      totalSamples: number;
      agents: string[];
      featureCount: number;
      source: string;
    };
  } {
    const batch = this.createTrainingBatch();
    const features: number[][] = [];
    const labels: number[] = [];

    // Phase to numeric label mapping
    const phaseLabels: Record<UAA2Phase, number> = {
      intake: 0, reflect: 1, execute: 2, compress: 3,
      reintake: 4, grow: 5, evolve: 6, autonomize: 7,
    };

    for (const record of batch.records) {
      // Extract numeric features
      const f = record.features;
      const featureVector = [
        f.messageLength / 1000,                        // Normalized message length
        f.hasQuestion ? 1 : 0,                         // Binary: has question
        f.hasCommand ? 1 : 0,                          // Binary: has command
        f.hasCodeBlock ? 1 : 0,                        // Binary: has code
        f.sentimentSignal === 'positive' ? 1 : f.sentimentSignal === 'negative' ? -1 : 0,
        record.role === 'user' ? 1 : record.role === 'assistant' ? 0 : 0.5,
        record.phaseConfidence,                        // Phase detection confidence
        record.previousPhase ? phaseLabels[record.previousPhase] / 7 : 0, // Previous phase normalized
        record.messageIndex / 100,                     // Conversation position normalized
        f.topicKeywords.length / 10,                   // Keyword density
        this.getIntentScore(f.intentCategory),         // Intent category score
        new Date(record.timestamp).getHours() / 24,    // Time of day
        new Date(record.timestamp).getDay() / 7,       // Day of week
        batch.metadata.uniqueConversations > 1 ? 1 : 0, // Multi-conversation batch
        this.getPhaseFlowScore(record.previousPhase, record.phase), // Natural flow score
      ];

      features.push(featureVector);
      labels.push(phaseLabels[record.phase]);
    }

    return {
      features,
      labels,
      metadata: {
        totalSamples: features.length,
        agents: ['infinity-assistant'],
        featureCount: 15,
        source: 'infinityassistant-service',
      },
    };
  }

  /**
   * Extract features from message content
   */
  private extractFeatures(content: string): QLLMTrainingRecord['features'] {
    const lowerContent = content.toLowerCase();

    // Detect question
    const hasQuestion = /\?|^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does)/i.test(content);

    // Detect command
    const hasCommand = /^(do|make|create|build|write|implement|fix|run|execute|please|can you)/i.test(content);

    // Detect code
    const hasCodeBlock = /```|\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bclass\b|\bimport\b/i.test(content);

    // Detect sentiment
    let sentimentSignal: 'positive' | 'neutral' | 'negative' = 'neutral';
    const positiveWords = /\b(thanks|great|awesome|perfect|excellent|good|nice|helpful|love|appreciate)\b/i;
    const negativeWords = /\b(wrong|bad|error|issue|problem|broken|doesn't work|failed|hate|frustrated)\b/i;
    if (positiveWords.test(lowerContent)) sentimentSignal = 'positive';
    else if (negativeWords.test(lowerContent)) sentimentSignal = 'negative';

    // Detect intent
    let intentCategory = 'general';
    if (hasQuestion) intentCategory = 'inquiry';
    else if (hasCommand) intentCategory = 'request';
    else if (/\b(i think|i believe|in my opinion)\b/i.test(content)) intentCategory = 'opinion';
    else if (/\b(here is|here's|attached|sharing)\b/i.test(content)) intentCategory = 'information';
    else if (/\b(thank|thanks|appreciate)\b/i.test(content)) intentCategory = 'gratitude';

    // Extract keywords
    const topicKeywords = this.extractKeywords(content);

    return {
      messageLength: content.length,
      hasQuestion,
      hasCommand,
      hasCodeBlock,
      sentimentSignal,
      intentCategory,
      topicKeywords,
    };
  }

  /**
   * Extract topic keywords from content
   */
  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'and', 'but', 'or', 'if',
      'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which', 'who',
      'this', 'that', 'these', 'those', 'it', 'its', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'i', 'you', 'we', 'they', 'he', 'she', 'my', 'your', 'our', 'their',
    ]);

    const keywords = words
      .filter(w => w.length > 3 && !stopWords.has(w) && /^[a-z]+$/i.test(w))
      .slice(0, 10);

    return [...new Set(keywords)];
  }

  /**
   * Get intent category score
   */
  private getIntentScore(intent: string): number {
    const scores: Record<string, number> = {
      inquiry: 0.8,
      request: 0.9,
      opinion: 0.5,
      information: 0.6,
      gratitude: 0.3,
      general: 0.4,
    };
    return scores[intent] || 0.4;
  }

  /**
   * Calculate natural phase flow score
   */
  private getPhaseFlowScore(previous: UAA2Phase | undefined, current: UAA2Phase): number {
    if (!previous) return 0.5;

    const naturalFlows: Record<UAA2Phase, UAA2Phase[]> = {
      intake: ['reflect', 'execute'],
      reflect: ['execute', 'intake'],
      execute: ['compress', 'reflect'],
      compress: ['reintake', 'grow'],
      reintake: ['reflect', 'execute'],
      grow: ['evolve', 'reflect'],
      evolve: ['autonomize', 'execute'],
      autonomize: ['intake', 'execute'],
    };

    return naturalFlows[previous]?.includes(current) ? 1.0 : 0.3;
  }

  /**
   * Get all active conversation IDs
   */
  private getActiveConversationIds(): string[] {
    // This would normally query from database
    // For now, we return from the in-memory services
    return [];
  }

  /**
   * Get export statistics
   */
  getExportStats(): {
    totalConversations: number;
    totalMessages: number;
    totalTransitions: number;
    phaseDistribution: Record<UAA2Phase, number>;
    avgConfidence: number;
  } {
    const batch = this.createTrainingBatch();
    return {
      totalConversations: batch.metadata.uniqueConversations,
      totalMessages: batch.metadata.totalRecords,
      totalTransitions: batch.records.filter(r => r.previousPhase !== r.phase).length,
      phaseDistribution: batch.metadata.phaseDistribution,
      avgConfidence: batch.metadata.avgConfidence,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let trainingDataExportServiceInstance: TrainingDataExportService | null = null;

export function getTrainingDataExportService(): TrainingDataExportService {
  if (!trainingDataExportServiceInstance) {
    trainingDataExportServiceInstance = new TrainingDataExportService();
  }
  return trainingDataExportServiceInstance;
}
