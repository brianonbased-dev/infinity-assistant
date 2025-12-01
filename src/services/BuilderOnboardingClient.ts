/**
 * Builder Onboarding API Client
 *
 * Client for communicating with uaa2-service Builder Onboarding APIs
 * Provides quantum parallel question batching for vigorous upfront onboarding
 *
 * Experience Levels:
 * - Easy: Full autonomy, minimal questions, Infinity Assistant handles everything
 * - Medium: Balanced autonomy, strategic questions, some tool exposure
 * - Experienced: Low autonomy, full tool access, developer-centric workflow
 *
 * @since 2025-12-01
 */

import logger from '@/utils/logger';

// ============================================================================
// TYPE DEFINITIONS (mirrors uaa2-service types)
// ============================================================================

export type ExperienceLevel = 'easy' | 'medium' | 'experienced';
export type QuestionType = 'text' | 'select' | 'multi-select' | 'boolean' | 'number' | 'credential';
export type QuestionCategory = 'project' | 'features' | 'integrations' | 'deployment' | 'credentials' | 'preferences';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  recommended?: boolean;
  requiresCredential?: boolean;
}

export interface QuestionValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  min?: number;
  max?: number;
}

export interface ConditionalRule {
  questionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in';
  value: string | string[] | boolean;
}

export interface BatchedQuestion {
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  question: string;
  description?: string;
  placeholder?: string;
  options?: QuestionOption[];
  validation?: QuestionValidation;
  defaultValue?: string | string[] | boolean | number;
  conditionalOn?: ConditionalRule;
  experienceLevels: ExperienceLevel[];
  priority: number;
  estimatedImpact: 'high' | 'medium' | 'low';
}

export interface QuestionCategoryGroup {
  category: QuestionCategory;
  title: string;
  description: string;
  icon: string;
  questions: BatchedQuestion[];
}

export interface DependencyNode {
  questionId: string;
  dependsOn: string[];
  unlocks: string[];
}

export interface BatchedQuestionSet {
  templateId: string;
  experienceLevel: ExperienceLevel;
  totalQuestions: number;
  estimatedTimeMinutes: number;
  categories: QuestionCategoryGroup[];
  dependencyGraph: DependencyNode[];
  prefilledFromProfile: Record<string, string | string[] | boolean | number>;
}

export interface BatchedAnswers {
  templateId: string;
  experienceLevel: ExperienceLevel;
  answers: Record<string, string | string[] | boolean | number>;
  completedAt: string;
  estimatedTokens: number;
}

export interface FileNode {
  path: string;
  type: 'file' | 'directory';
  purpose: string;
  content?: string;
  children?: FileNode[];
}

export interface CredentialRequirement {
  service: string;
  envVarName: string;
  description: string;
  setupUrl: string;
  required: boolean;
}

export interface TechStackSpec {
  frontend: string[];
  backend: string[];
  database: string[];
  hosting: string[];
  integrations: string[];
}

export interface DeploymentSpec {
  platform: string;
  region?: string;
  environmentVariables: string[];
  buildCommand: string;
  startCommand: string;
}

export interface BuildEstimates {
  tokensMinimum: number;
  tokensTypical: number;
  tokensMaximum: number;
  timeMinutes: number;
  phases: number;
}

export interface WorkspaceSpecification {
  projectName: string;
  projectDescription: string;
  templateId: string;
  experienceLevel: ExperienceLevel;
  techStack: TechStackSpec;
  fileStructure: FileNode[];
  credentials: CredentialRequirement[];
  deployment: DeploymentSpec;
  features: string[];
  buildEstimates: BuildEstimates;
  generatedAt: string;
}

export interface AgentConfig {
  experienceLevel: ExperienceLevel;
  autonomyLevel: number;
  decisionThreshold: number;
  exposedCapabilities: string[];
  hiddenCapabilities: string[];
  systemPromptAdditions: string;
}

export interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTokens: {
    minimum: number;
    typical: number;
    maximum: number;
  };
  estimatedBuildTime: string;
  techStack: TechStackSpec;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  answeredCount: number;
  totalQuestions: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

export class BuilderOnboardingClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.UAA2_SERVICE_URL || 'http://localhost:3000';
    this.apiKey = process.env.UAA2_SERVICE_API_KEY || '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Service-Name': 'infinityassistant',
      ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
    };
  }

  /**
   * Get available builder templates filtered by experience level
   */
  async getTemplates(experienceLevel?: ExperienceLevel): Promise<{
    templates: BuilderTemplate[];
    count: number;
  }> {
    try {
      const params = experienceLevel ? `?level=${experienceLevel}` : '';
      const response = await fetch(`${this.baseUrl}/api/builder/templates${params}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        templates: data.data?.templates || [],
        count: data.data?.count || 0,
      };
    } catch (error) {
      logger.error('[BuilderOnboardingClient] Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get batched questions for a template (quantum parallel approach)
   * Returns ALL questions at once for the selected experience level
   */
  async getBatchedQuestions(
    templateId: string,
    experienceLevel: ExperienceLevel
  ): Promise<{
    questionSet: BatchedQuestionSet;
    template: { id: string; name: string; description: string };
    agentConfig: AgentConfig;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/builder/templates/${templateId}/questions?level=${experienceLevel}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        questionSet: data.data?.questionSet,
        template: data.data?.template,
        agentConfig: data.data?.agentConfig,
      };
    } catch (error) {
      logger.error('[BuilderOnboardingClient] Error fetching batched questions:', error);
      throw error;
    }
  }

  /**
   * Validate batched answers before generating specification
   */
  async validateAnswers(
    templateId: string,
    experienceLevel: ExperienceLevel,
    answers: Record<string, string | string[] | boolean | number>
  ): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/builder/validate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          templateId,
          experienceLevel,
          answers,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        valid: data.data?.valid ?? false,
        errors: data.data?.errors || [],
        answeredCount: data.data?.answeredCount || 0,
        totalQuestions: data.data?.totalQuestions || 0,
      };
    } catch (error) {
      logger.error('[BuilderOnboardingClient] Error validating answers:', error);
      throw error;
    }
  }

  /**
   * Generate complete workspace specification from validated answers
   * This is the V1 finalization - workspace structure is complete after this
   */
  async generateSpecification(
    templateId: string,
    experienceLevel: ExperienceLevel,
    answers: Record<string, string | string[] | boolean | number>
  ): Promise<{
    specification: WorkspaceSpecification;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/builder/specification`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          templateId,
          experienceLevel,
          answers,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        specification: data.data?.specification,
        message: data.data?.message || 'Specification generated',
      };
    } catch (error) {
      logger.error('[BuilderOnboardingClient] Error generating specification:', error);
      throw error;
    }
  }

  /**
   * Get agent configuration for a specific experience level
   */
  async getAgentConfig(level: ExperienceLevel): Promise<AgentConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/api/builder/agent-config/${level}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.data?.agentConfig;
    } catch (error) {
      logger.error('[BuilderOnboardingClient] Error fetching agent config:', error);
      throw error;
    }
  }

  /**
   * Auto-detect user experience level from profile data
   */
  async detectExperienceLevel(
    userId: string,
    profile?: {
      experienceLevel?: string;
      previousBuilds?: number;
    }
  ): Promise<{
    level: ExperienceLevel;
    confidence: number;
    reasons: string[];
    agentConfig: AgentConfig;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/builder/detect-experience`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          userId,
          profile,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        level: data.data?.level || 'medium',
        confidence: data.data?.confidence || 0.5,
        reasons: data.data?.reasons || [],
        agentConfig: data.data?.agentConfig,
      };
    } catch (error) {
      logger.error('[BuilderOnboardingClient] Error detecting experience:', error);
      // Return default on error
      return {
        level: 'medium',
        confidence: 0.5,
        reasons: ['Default fallback'],
        agentConfig: {
          experienceLevel: 'medium',
          autonomyLevel: 0.6,
          decisionThreshold: 0.85,
          exposedCapabilities: [],
          hiddenCapabilities: [],
          systemPromptAdditions: '',
        },
      };
    }
  }
}

// Singleton instance
let builderOnboardingClient: BuilderOnboardingClient | null = null;

export function getBuilderOnboardingClient(): BuilderOnboardingClient {
  if (!builderOnboardingClient) {
    builderOnboardingClient = new BuilderOnboardingClient();
  }
  return builderOnboardingClient;
}
