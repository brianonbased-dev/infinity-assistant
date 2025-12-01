'use client';

/**
 * Builder Mode Component
 *
 * Wraps the builder experience with the lotus growth phase overlay.
 * Integrates with UnifiedSearchBar for seamless build initiation.
 *
 * Flow:
 * 1. User switches to "Build" mode in UnifiedSearchBar
 * 2. User selects a template OR describes what they want to build
 * 3. User provides all required credentials and variables upfront
 * 4. BuilderMode shows the lotus growth overlay
 * 5. User can make choices at decision points
 * 6. Workspace grows through all phases (Seed → Radiance)
 * 7. UI/UX Editor appears for customization
 * 8. User finalizes their creation
 *
 * Key principle: ALL planning and credential collection happens UPFRONT
 * before any building begins. The orchestration then handles everything
 * autonomously.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import BuilderPhaseOverlay from './BuilderPhaseOverlay';
import UIUXEditor, { EditorConfig } from './UIUXEditor';
import BuilderRequirementsForm, { RequirementsFormData } from './BuilderRequirementsForm';
import WhiteGloveOnboarding from './WhiteGloveOnboarding';
import ExperienceLevelSelector from './ExperienceLevelSelector';
import BuilderDreamBoard, { type DreamBoard } from './BuilderDreamBoard';
import ConversationalOnboarding, { type ExtractedData } from './ConversationalOnboarding';
import { useBuilderWorkspace } from '@/hooks/useBuilderWorkspace';
import type { BuildPhase } from '@/types/builder-workspace';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Search,
  Grid3X3,
  List,
  ChevronRight,
  Crown,
  Wrench,
  Brain,
} from 'lucide-react';
import {
  BUILDER_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplateById,
  type BuilderTemplate,
  type TemplateCategory,
} from '@/types/builder-templates';
import { secureVariableStorage } from '@/services/SecureVariableStorage';
import {
  whiteGloveService,
  type WhiteGloveUserInput,
  type WhiteGloveSession,
} from '@/services/WhiteGloveService';
import {
  getBuilderOnboardingClient,
  type ExperienceLevel,
  type AgentConfig,
  type WorkspaceSpecification,
} from '@/services/BuilderOnboardingClient';

interface BuilderModeProps {
  onBuildComplete?: (workspaceId: string) => void;
  onCancel?: () => void;
  /** User's current token balance */
  userTokenBalance?: number;
}

type BuilderStage =
  | 'template-select'
  | 'experience-level'    // Select Easy/Medium/Experienced
  | 'conversation'        // EASY MODE: Companion conversation extracts all data
  | 'dream-board'         // MEDIUM/EXPERIENCED: Visual project ideation
  | 'setup-choice'
  | 'requirements'
  | 'white-glove'
  | 'growing'
  | 'customizing'
  | 'complete';

type SetupMode = 'self-service' | 'white-glove';

export default function BuilderMode({
  onBuildComplete,
  onCancel,
  userTokenBalance = 1000, // Default for development
}: BuilderModeProps) {
  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<BuilderTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Build state
  const [projectName, setProjectName] = useState('');
  const [stage, setStage] = useState<BuilderStage>('template-select');
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [requirementsData, setRequirementsData] = useState<RequirementsFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // White glove state
  const [whiteGloveSession, setWhiteGloveSession] = useState<WhiteGloveSession | null>(null);

  // Experience level state (NEW)
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [dreamBoard, setDreamBoard] = useState<DreamBoard | null>(null);
  const [workspaceSpec, setWorkspaceSpec] = useState<WorkspaceSpecification | null>(null);
  const [conversationData, setConversationData] = useState<ExtractedData | null>(null);
  const [detectedLevel, setDetectedLevel] = useState<{
    level: ExperienceLevel;
    confidence: number;
    reasons: string[];
  } | null>(null);

  // API client
  const builderClient = getBuilderOnboardingClient();

  const {
    workspace,
    isBuilding,
    phases,
    workspaceFiles,
    currentPhase,
    overallProgress,
    error,
    startBuild,
    selectChoice,
    cancelBuild,
    reset,
  } = useBuilderWorkspace();

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    return BUILDER_TEMPLATES.filter((template) => {
      const matchesSearch =
        searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Watch for build completion to transition to customizing stage
  useEffect(() => {
    if (workspace?.status === 'completed' && stage === 'growing') {
      setStage('customizing');
    }
  }, [workspace?.status, stage]);

  // Handle template selection - now goes to experience level selection first
  const handleSelectTemplate = useCallback(async (template: BuilderTemplate) => {
    setSelectedTemplate(template);
    setProjectName(template.name.toLowerCase().replace(/\s+/g, '-'));

    // Try to detect experience level from user profile
    try {
      const detected = await builderClient.detectExperienceLevel('current-user', {
        // In production, pass actual user profile data
      });
      setDetectedLevel({
        level: detected.level,
        confidence: detected.confidence,
        reasons: detected.reasons,
      });
    } catch {
      // Detection failed, that's ok - user will choose manually
    }

    setStage('experience-level');
  }, [builderClient]);

  // Handle experience level selection
  // EASY → Conversational (companion relationship)
  // MEDIUM/EXPERIENCED → Dream Board (more freedom)
  const handleExperienceLevelSelect = useCallback((level: ExperienceLevel, config: AgentConfig) => {
    setExperienceLevel(level);
    setAgentConfig(config);

    if (level === 'easy') {
      // Easy mode: Companion conversation - assistant builds relationship while extracting data
      setStage('conversation');
    } else {
      // Medium/Experienced: Dream board for quick visual ideation
      setStage('dream-board');
    }
  }, []);

  // Handle conversation completion (Easy mode)
  const handleConversationComplete = useCallback(async (data: ExtractedData) => {
    if (!selectedTemplate || !experienceLevel) return;

    setIsSubmitting(true);
    setConversationData(data);

    try {
      // Convert conversation data to answers format for API
      const answers: Record<string, string | string[]> = {
        projectName: data.projectName || selectedTemplate.name.toLowerCase().replace(/\s+/g, '-'),
        tagline: data.tagline || '',
        vision: data.vision ? [data.vision] : [],
        features: data.features,
        style: data.stylePreferences,
        integrations: data.integrations,
        users: data.targetAudience ? [data.targetAudience] : [],
        constraints: [],
        mustHaves: data.features, // All features from Easy mode are must-haves
        niceToHaves: [],
        authMethod: data.authMethod || 'magic-link',
        additionalNotes: data.additionalNotes,
      };

      // Generate specification from conversation data
      const result = await builderClient.generateSpecification(
        selectedTemplate.id,
        experienceLevel,
        answers
      );

      setWorkspaceSpec(result.specification);

      // Easy mode: Start building immediately - companion handles everything
      setProjectName(result.specification.projectName);
      setStage('growing');

      const buildDescription = `Building ${result.specification.projectName}: ${result.specification.projectDescription}`;
      await startBuild(
        result.specification.projectName,
        buildDescription,
        result.specification.projectDescription
      );
    } catch (error) {
      console.error('Failed to generate specification:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTemplate, experienceLevel, builderClient, startBuild]);

  // Handle back from conversation to experience level
  const handleBackFromConversation = useCallback(() => {
    setStage('experience-level');
    setConversationData(null);
  }, []);

  // Handle dream board completion - generates specification
  const handleDreamBoardComplete = useCallback(async (board: DreamBoard) => {
    if (!selectedTemplate || !experienceLevel) return;

    setIsSubmitting(true);
    setDreamBoard(board);

    try {
      // Convert dream board to answers format for API
      const answers: Record<string, string | string[]> = {
        projectName: board.projectName,
        tagline: board.tagline,
        vision: board.items.filter(i => i.category === 'vision').map(i => i.content),
        features: board.items.filter(i => i.category === 'feature').map(i => i.content),
        style: board.items.filter(i => i.category === 'style').map(i => i.content),
        integrations: board.items.filter(i => i.category === 'integration').map(i => i.content),
        users: board.items.filter(i => i.category === 'user').map(i => i.content),
        constraints: board.items.filter(i => i.category === 'constraint').map(i => i.content),
        mustHaves: board.items.filter(i => i.priority === 'must-have').map(i => i.content),
        niceToHaves: board.items.filter(i => i.priority === 'nice-to-have').map(i => i.content),
        inspirations: board.inspirations,
      };

      // Generate specification from dream board
      const result = await builderClient.generateSpecification(
        selectedTemplate.id,
        experienceLevel,
        answers
      );

      setWorkspaceSpec(result.specification);

      // For Easy mode, go straight to building
      // For Medium/Experienced, show setup-choice for additional options
      if (experienceLevel === 'easy') {
        // Easy mode: Start building immediately with generated spec
        setProjectName(result.specification.projectName);
        setStage('growing');

        const buildDescription = `Building ${result.specification.projectName}: ${result.specification.projectDescription}`;
        await startBuild(
          result.specification.projectName,
          buildDescription,
          result.specification.projectDescription
        );
      } else {
        // Medium/Experienced: Allow further customization
        setStage('setup-choice');
      }
    } catch (error) {
      console.error('Failed to generate specification:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTemplate, experienceLevel, builderClient, startBuild]);

  // Handle back from experience level to template selection
  const handleBackFromExperienceLevel = useCallback(() => {
    setStage('template-select');
    setSelectedTemplate(null);
    setDetectedLevel(null);
  }, []);

  // Handle back from dream board to experience level
  const handleBackFromDreamBoard = useCallback(() => {
    setStage('experience-level');
    setDreamBoard(null);
  }, []);

  // Handle setup mode choice
  const handleSetupModeChoice = useCallback((mode: SetupMode) => {
    setSetupMode(mode);
    if (mode === 'white-glove') {
      setStage('white-glove');
    } else {
      setStage('requirements');
    }
  }, []);

  // Handle going back from requirements/white-glove to setup choice
  const handleBackToSetupChoice = useCallback(() => {
    setStage('setup-choice');
    setSetupMode(null);
    setRequirementsData(null);
    setWhiteGloveSession(null);
  }, []);

  // Handle going back from setup choice to dream board (or template selection if no dream board)
  const handleBackToTemplates = useCallback(() => {
    if (dreamBoard) {
      // Go back to dream board if we have one
      setStage('dream-board');
      setSetupMode(null);
    } else {
      // Otherwise go back to template selection
      setStage('template-select');
      setSelectedTemplate(null);
      setSetupMode(null);
      setExperienceLevel(null);
      setAgentConfig(null);
    }
    setRequirementsData(null);
    setWhiteGloveSession(null);
  }, [dreamBoard]);

  // Handle requirements form submission - starts the build
  const handleRequirementsSubmit = useCallback(
    async (data: RequirementsFormData) => {
      if (!selectedTemplate) return;

      setIsSubmitting(true);
      setRequirementsData(data);

      try {
        // Generate a workspace ID for this build
        const workspaceId = crypto.randomUUID();

        // Store credentials securely
        const variablesToStore = Object.entries(data.variables).map(
          ([key, value]) => {
            // Find if this variable is sensitive from the template
            const varDef = selectedTemplate.requirements.variables.find(
              (v) => v.key === key || v.id === key
            );
            return {
              key,
              value,
              sensitive: varDef?.sensitive ?? true,
            };
          }
        );

        await secureVariableStorage.storeVariables(
          workspaceId,
          data.templateId,
          variablesToStore
        );

        const buildDescription = `Building ${selectedTemplate.name}: ${selectedTemplate.description}`;
        setStage('growing');

        // Start the build - the orchestration will retrieve credentials as needed
        await startBuild(projectName, buildDescription, selectedTemplate.description);

        // Mark credentials as used
        secureVariableStorage.markAsUsed(workspaceId);
      } catch (err) {
        console.error('Failed to start build:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedTemplate, projectName, startBuild]
  );

  // Handle white glove submission
  const handleWhiteGloveSubmit = useCallback(
    async (input: WhiteGloveUserInput) => {
      if (!selectedTemplate) return;

      setIsSubmitting(true);

      try {
        // Start the white glove session
        const session = await whiteGloveService.startSession(
          'current-user', // In production, get from auth context
          selectedTemplate
        );

        setWhiteGloveSession(session);

        // If setup completed successfully, start the build
        if (session.status === 'starting_build') {
          whiteGloveService.markAsBuilding(session.id);
          setStage('growing');

          const buildDescription = `Building ${selectedTemplate.name}: ${selectedTemplate.description}`;
          await startBuild(projectName, buildDescription, selectedTemplate.description);

          whiteGloveService.markAsCompleted(session.id);
        }
      } catch (err) {
        console.error('White glove setup failed:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedTemplate, projectName, startBuild]
  );

  // Handle phase choice selection
  const handleChoiceSelect = useCallback((phase: BuildPhase, choiceId: string) => {
    selectChoice(phase, choiceId);
  }, [selectChoice]);

  // Handle approval/continue
  const handleApprove = useCallback(() => {
    // The choice has already been selected, this just confirms
    // In the current flow, selecting a choice auto-continues
  }, []);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    await cancelBuild();
    setStage('template-select');
    setSelectedTemplate(null);
    setSetupMode(null);
    setRequirementsData(null);
    setWhiteGloveSession(null);
    setExperienceLevel(null);
    setAgentConfig(null);
    setDreamBoard(null);
    setWorkspaceSpec(null);
    setDetectedLevel(null);
    setConversationData(null);
    reset();
    onCancel?.();
  }, [cancelBuild, reset, onCancel]);

  // Handle close (when complete)
  const handleClose = useCallback(() => {
    // Transition to UI/UX editor instead of closing
    if (workspace?.status === 'completed') {
      setStage('customizing');
    }
  }, [workspace]);

  // Handle UI/UX editor save
  const handleEditorSave = useCallback((config: EditorConfig) => {
    setEditorConfig(config);
    setStage('complete');

    // Notify parent that build is complete with config
    if (workspace) {
      onBuildComplete?.(workspace.id);
    }
  }, [workspace, onBuildComplete]);

  // Handle editor close/skip
  const handleEditorClose = useCallback(() => {
    setStage('complete');
    if (workspace) {
      onBuildComplete?.(workspace.id);
    }
  }, [workspace, onBuildComplete]);

  // Convert workspace files to overlay format (filter out deleted, cast status)
  const overlayFiles = workspaceFiles
    .filter((f) => f.status !== 'deleted')
    .map((f) => ({
      name: f.name,
      type: f.type,
      path: f.path,
      status: f.status as 'created' | 'pending' | 'modified',
    }));

  return (
    <div className="flex flex-col h-full">
      {/* Template Selection Stage */}
      {stage === 'template-select' && (
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-pink-500 to-purple-600 mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              What would you like to grow?
            </h2>
            <p className="text-gray-400 mt-1">
              Choose a template to start building your vision
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                title="Grid view"
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                title="List view"
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              All Templates
            </button>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Templates Grid/List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No templates found matching your search.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="p-5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              template.difficulty === 'beginner'
                                ? 'bg-green-500/20 text-green-400'
                                : template.difficulty === 'intermediate'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {template.difficulty}
                          </span>
                          <span className="text-xs text-gray-500">
                            ~{template.estimatedTokens.typical} tokens
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-xl text-left transition-all group flex items-center gap-4"
                  >
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-400 truncate">
                        {template.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          template.difficulty === 'beginner'
                            ? 'bg-green-500/20 text-green-400'
                            : template.difficulty === 'intermediate'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {template.difficulty}
                      </span>
                      <span className="text-sm text-gray-500">
                        ~{template.estimatedTokens.typical} tokens
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <div className="mt-6 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Experience Level Selection Stage */}
      {stage === 'experience-level' && selectedTemplate && (
        <ExperienceLevelSelector
          selectedLevel={experienceLevel}
          onSelect={handleExperienceLevelSelect}
          onBack={handleBackFromExperienceLevel}
          detectedLevel={detectedLevel?.level}
          detectedConfidence={detectedLevel?.confidence}
          detectedReasons={detectedLevel?.reasons}
          templateName={selectedTemplate.name}
        />
      )}

      {/* Conversational Onboarding Stage - EASY MODE (Companion) */}
      {stage === 'conversation' && selectedTemplate && agentConfig && (
        <ConversationalOnboarding
          template={{
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            description: selectedTemplate.description,
            category: selectedTemplate.category,
            difficulty: selectedTemplate.difficulty,
            estimatedTokens: selectedTemplate.estimatedTokens,
            estimatedBuildTime: selectedTemplate.estimatedBuildTime || '10-20 min',
            techStack: {
              frontend: selectedTemplate.techStack?.frontend || [],
              backend: selectedTemplate.techStack?.backend || [],
              database: selectedTemplate.techStack?.database || [],
              hosting: selectedTemplate.techStack?.hosting || [],
              integrations: selectedTemplate.techStack?.integrations || [],
            },
          }}
          agentConfig={agentConfig}
          onComplete={handleConversationComplete}
          onBack={handleBackFromConversation}
        />
      )}

      {/* Dream Board Stage - MEDIUM/EXPERIENCED (Visual ideation) */}
      {stage === 'dream-board' && selectedTemplate && experienceLevel && agentConfig && (
        <BuilderDreamBoard
          template={{
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            description: selectedTemplate.description,
            category: selectedTemplate.category,
            difficulty: selectedTemplate.difficulty,
            estimatedTokens: selectedTemplate.estimatedTokens,
            estimatedBuildTime: selectedTemplate.estimatedBuildTime || '10-20 min',
            techStack: {
              frontend: selectedTemplate.techStack?.frontend || [],
              backend: selectedTemplate.techStack?.backend || [],
              database: selectedTemplate.techStack?.database || [],
              hosting: selectedTemplate.techStack?.hosting || [],
              integrations: selectedTemplate.techStack?.integrations || [],
            },
          }}
          experienceLevel={experienceLevel}
          agentConfig={agentConfig}
          onComplete={handleDreamBoardComplete}
          onBack={handleBackFromDreamBoard}
          isProcessing={isSubmitting}
        />
      )}

      {/* Setup Choice Stage - Choose between Self-Service and White Glove */}
      {stage === 'setup-choice' && selectedTemplate && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-3xl mb-4">
                <span>{selectedTemplate.icon}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                How would you like to set up {selectedTemplate.name}?
              </h2>
              <p className="text-gray-400">
                Choose your preferred setup experience
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Self-Service Option */}
              <button
                type="button"
                onClick={() => handleSetupModeChoice('self-service')}
                className="p-6 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-2xl text-left transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                  <Wrench className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Self-Service Setup
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Create accounts yourself and enter your credentials. Best if you already have accounts or want full control.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    ~{selectedTemplate.estimatedTokens.typical} tokens
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </div>
              </button>

              {/* White Glove Option */}
              <button
                type="button"
                onClick={() => handleSetupModeChoice('white-glove')}
                className="p-6 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 border border-amber-500/30 hover:border-amber-500/50 rounded-2xl text-left transition-all group relative overflow-hidden"
              >
                {/* Premium Badge */}
                <div className="absolute top-3 right-3 px-2 py-1 bg-amber-500/20 rounded-full text-xs text-amber-400 font-medium">
                  Premium
                </div>

                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors">
                  <Crown className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  White Glove Service
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  We handle everything! Just provide your email and payment info - we create all accounts and configure everything for you.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-400">
                    $29 + ~{selectedTemplate.estimatedTokens.typical} tokens
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-amber-400 transition-colors" />
                </div>
              </button>
            </div>

            {/* Back Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleBackToTemplates}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Choose a different template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirements Stage (Self-Service) */}
      {stage === 'requirements' && selectedTemplate && (
        <div className="flex-1 overflow-y-auto">
          <BuilderRequirementsForm
            template={selectedTemplate}
            userTokenBalance={userTokenBalance}
            onSubmit={handleRequirementsSubmit}
            onBack={handleBackToSetupChoice}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* White Glove Stage */}
      {stage === 'white-glove' && selectedTemplate && (
        <div className="flex-1 overflow-y-auto">
          <WhiteGloveOnboarding
            template={selectedTemplate}
            onSubmit={handleWhiteGloveSubmit}
            onBack={handleBackToSetupChoice}
            session={whiteGloveSession ?? undefined}
            isProcessing={isSubmitting}
          />
        </div>
      )}

      {/* Completion Message */}
      {stage === 'complete' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-linear-to-br from-green-500 to-emerald-600 mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Your creation is complete!
            </h2>
            <p className="text-gray-400 max-w-md">
              {selectedTemplate?.name || projectName} has been successfully built and customized.
              {editorConfig?.template && ` Using the ${editorConfig.template} template.`}
            </p>
            {requirementsData && (
              <div className="text-sm text-gray-500">
                Tokens used: ~{requirementsData.estimatedTokens}
              </div>
            )}
            {setupMode === 'white-glove' && (
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <Crown className="w-4 h-4" />
                White Glove Service
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setStage('template-select');
                setSelectedTemplate(null);
                setSetupMode(null);
                setProjectName('');
                setEditorConfig(null);
                setRequirementsData(null);
                setWhiteGloveSession(null);
                setExperienceLevel(null);
                setAgentConfig(null);
                setDreamBoard(null);
                setWorkspaceSpec(null);
                setDetectedLevel(null);
                setConversationData(null);
                reset();
              }}
              className="mt-4 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
            >
              Start Another Build
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Phase Overlay - Growing Stage */}
      <BuilderPhaseOverlay
        projectName={selectedTemplate?.name || projectName || 'My Project'}
        projectDescription={selectedTemplate?.description || ''}
        phases={phases}
        workspaceFiles={overlayFiles}
        currentPhase={currentPhase}
        overallProgress={overallProgress}
        isVisible={stage === 'growing'}
        onClose={workspace?.status === 'completed' ? handleClose : undefined}
        onChoiceSelect={handleChoiceSelect}
        onApprove={handleApprove}
        onCancel={handleCancel}
      />

      {/* UI/UX Editor - Customizing Stage */}
      {stage === 'customizing' && workspace && (
        <UIUXEditor
          workspaceId={workspace.id}
          projectName={selectedTemplate?.name || projectName || 'My Project'}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}
