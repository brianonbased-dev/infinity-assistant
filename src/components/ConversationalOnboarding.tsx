'use client';

/**
 * Conversational Onboarding Component
 *
 * For EASY MODE users - a friendly conversation with the assistant
 * that extracts ALL the data needed to build a complete V1.
 *
 * Philosophy:
 * - Feels like chatting with a helpful friend, not filling forms
 * - Assistant asks smart questions based on context
 * - Extracts everything needed for a COMPLETE build
 * - User never touches code or technical details
 * - Result: Fully working app with no gaps
 *
 * The conversation is structured but feels natural:
 * 1. Greeting & context setting
 * 2. Understanding the vision (what & why)
 * 3. Target audience (who)
 * 4. Core features (must-haves)
 * 5. Style preferences (look & feel)
 * 6. Integrations & auth preferences
 * 7. Confirmation & build start
 *
 * @since 2025-12-01
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  Sparkles,
  CheckCircle,
  ArrowLeft,
  Bot,
  User,
  Lightbulb,
  ChevronRight,
  AlertTriangle,
  Star,
} from 'lucide-react';
import type {
  ExperienceLevel,
  AgentConfig,
  BuilderTemplate,
  WorkspaceSpecification,
} from '@/services/BuilderOnboardingClient';
import {
  getAdaptiveBuilderService,
  type PersonalityType,
  type CommunicationTone,
} from '@/services/AdaptiveBuilderService';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  options?: QuickOption[];
  isTyping?: boolean;
  knowledgeHint?: string;      // Wisdom/pattern from knowledge base
  warning?: string;            // Gotcha to watch out for
  recommended?: string[];      // Pattern-based recommendations
}

interface QuickOption {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

interface ConversationPhase {
  id: string;
  name: string;
  description: string;
  questions: string[];
  extractedData: string[];
  completed: boolean;
}

interface ExtractedData {
  projectName?: string;
  tagline?: string;
  vision?: string;
  targetAudience?: string;
  features: string[];
  stylePreferences: string[];
  integrations: string[];
  authMethod?: string;
  additionalNotes: string[];
}

interface ConversationalOnboardingProps {
  template: BuilderTemplate;
  agentConfig: AgentConfig;
  onComplete: (data: ExtractedData) => void;
  onBack?: () => void;
}

// ============================================================================
// CONVERSATION FLOW CONFIGURATION
// ============================================================================

const CONVERSATION_PHASES: ConversationPhase[] = [
  {
    id: 'greeting',
    name: 'Getting Started',
    description: 'Introduction and context',
    questions: ['greeting'],
    extractedData: [],
    completed: false,
  },
  {
    id: 'vision',
    name: 'Your Vision',
    description: 'What you want to build',
    questions: ['vision', 'why'],
    extractedData: ['vision', 'tagline'],
    completed: false,
  },
  {
    id: 'audience',
    name: 'Target Audience',
    description: 'Who will use it',
    questions: ['audience'],
    extractedData: ['targetAudience'],
    completed: false,
  },
  {
    id: 'features',
    name: 'Core Features',
    description: 'Must-have functionality',
    questions: ['features', 'priority'],
    extractedData: ['features'],
    completed: false,
  },
  {
    id: 'style',
    name: 'Look & Feel',
    description: 'Visual preferences',
    questions: ['style', 'inspiration'],
    extractedData: ['stylePreferences'],
    completed: false,
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Services to connect',
    questions: ['integrations', 'auth'],
    extractedData: ['integrations', 'authMethod'],
    completed: false,
  },
  {
    id: 'confirm',
    name: 'Confirmation',
    description: 'Review and start',
    questions: ['confirm'],
    extractedData: [],
    completed: false,
  },
];

// Smart question templates based on template type
const getQuestionForPhase = (
  phaseId: string,
  template: BuilderTemplate,
  extractedData: ExtractedData,
  questionIndex: number
): { message: string; options?: QuickOption[] } => {
  const templateName = template.name;
  const category = template.category;

  switch (phaseId) {
    case 'greeting':
      return {
        message: `Hey! I'm excited to help you build your ${templateName}! This is going to be fun. I'll ask you a few questions to make sure we build exactly what you're dreaming of. Ready to get started?`,
        options: [
          { id: 'yes', label: "Yes, let's go!", value: 'yes' },
          { id: 'tell-more', label: 'Tell me more first', value: 'tell-more' },
        ],
      };

    case 'vision':
      if (questionIndex === 0) {
        return {
          message: `Perfect! So tell me - in your own words, what do you want your ${templateName} to do? Don't worry about technical stuff, just describe your dream version.`,
        };
      } else {
        return {
          message: `Love it! And what's the main reason you want to build this? Is it for yourself, your business, or something else?`,
          options: [
            { id: 'personal', label: 'Personal project', value: 'personal' },
            { id: 'business', label: 'For my business', value: 'business' },
            { id: 'startup', label: 'Building a startup', value: 'startup' },
            { id: 'learning', label: 'Learning & experimenting', value: 'learning' },
            { id: 'other', label: 'Something else', value: 'other' },
          ],
        };
      }

    case 'audience':
      return {
        message: `Got it! Now, who's going to use this? Describe your ideal user - are they tech-savvy or beginners? Young or older? What problem are they trying to solve?`,
        options: category === 'productivity' ? [
          { id: 'myself', label: 'Just me', value: 'myself' },
          { id: 'team', label: 'My team/company', value: 'team' },
          { id: 'customers', label: 'My customers', value: 'customers' },
          { id: 'public', label: 'Anyone/Public', value: 'public' },
        ] : undefined,
      };

    case 'features':
      if (questionIndex === 0) {
        const featureSuggestions = getFeatureSuggestions(template);
        return {
          message: `Now for the fun part - features! What are the absolute MUST-HAVE features? I have some suggestions based on ${templateName}, but feel free to add your own:`,
          options: featureSuggestions.slice(0, 6).map((f, i) => ({
            id: `feature-${i}`,
            label: f,
            value: f,
          })),
        };
      } else {
        return {
          message: `Great choices! Anything else that's essential? Or should we move on to how you want it to look?`,
          options: [
            { id: 'add-more', label: 'I want to add more features', value: 'add-more' },
            { id: 'done', label: "That's good, let's continue", value: 'done' },
          ],
        };
      }

    case 'style':
      if (questionIndex === 0) {
        return {
          message: `Let's talk about the vibe! How do you want your ${templateName} to feel? Pick one or describe your own:`,
          options: [
            { id: 'minimal', label: 'Clean & Minimal', value: 'clean and minimal' },
            { id: 'bold', label: 'Bold & Colorful', value: 'bold and colorful' },
            { id: 'professional', label: 'Professional & Corporate', value: 'professional and corporate' },
            { id: 'playful', label: 'Playful & Fun', value: 'playful and fun' },
            { id: 'dark', label: 'Dark & Modern', value: 'dark and modern' },
            { id: 'custom', label: 'Let me describe...', value: 'custom' },
          ],
        };
      } else {
        return {
          message: `Nice! Any websites or apps you love the look of? I can use them as inspiration. (Just type names or URLs, or skip if none come to mind)`,
        };
      }

    case 'integrations':
      if (questionIndex === 0) {
        const integrationSuggestions = getIntegrationSuggestions(template);
        return {
          message: `Almost done! What services do you want to connect? Here are some common ones for ${templateName}:`,
          options: integrationSuggestions.map((i, idx) => ({
            id: `int-${idx}`,
            label: i,
            value: i,
          })),
        };
      } else {
        return {
          message: `And for user login - how do you want people to sign in?`,
          options: [
            { id: 'magic-link', label: 'Magic Link (email)', value: 'magic-link' },
            { id: 'google', label: 'Google Sign-in', value: 'google' },
            { id: 'email-password', label: 'Email & Password', value: 'email-password' },
            { id: 'no-auth', label: 'No login needed', value: 'no-auth' },
            { id: 'all', label: 'All of the above', value: 'all' },
          ],
        };
      }

    case 'confirm':
      const summary = generateSummary(extractedData, template);
      return {
        message: `Amazing! Here's what I've got:\n\n${summary}\n\nDoes this look right? Once you confirm, I'll start building your ${templateName}!`,
        options: [
          { id: 'build', label: "Perfect, let's build!", value: 'build' },
          { id: 'change', label: 'I want to change something', value: 'change' },
        ],
      };

    default:
      return { message: 'Let me think about that...' };
  }
};

// Feature suggestions based on template
const getFeatureSuggestions = (template: BuilderTemplate): string[] => {
  const baseFeatures: Record<string, string[]> = {
    'todo-app': [
      'Create & organize tasks',
      'Due dates & reminders',
      'Categories/tags',
      'Priority levels',
      'Task completion tracking',
      'Search tasks',
      'Share lists with others',
      'Daily/weekly views',
    ],
    'ecommerce-store': [
      'Product catalog',
      'Shopping cart',
      'Secure checkout',
      'Payment processing',
      'Order tracking',
      'User accounts',
      'Product search & filters',
      'Reviews & ratings',
    ],
    'telegram-bot': [
      'Custom commands',
      'AI responses',
      'User management',
      'Scheduled messages',
      'Media handling',
      'Inline keyboards',
      'Group support',
      'Analytics',
    ],
    'blog-platform': [
      'Write & publish posts',
      'Categories & tags',
      'Comments',
      'Author profiles',
      'Search',
      'RSS feed',
      'Social sharing',
      'Draft saving',
    ],
    'research-assistant': [
      'Web search',
      'Document analysis',
      'Knowledge base',
      'Citation management',
      'Export to PDF/Word',
      'Collaboration',
      'AI summaries',
      'Source tracking',
    ],
  };

  return baseFeatures[template.id] || [
    'User accounts',
    'Dashboard',
    'Data storage',
    'Search functionality',
    'Notifications',
    'Export data',
  ];
};

// Integration suggestions based on template
const getIntegrationSuggestions = (template: BuilderTemplate): string[] => {
  const integrations = template.techStack?.integrations || [];
  const common = [
    'Google Analytics',
    'Email (SendGrid/Resend)',
    'Cloud Storage',
  ];

  return [...new Set([...integrations, ...common])].slice(0, 6);
};

// Generate summary for confirmation
const generateSummary = (data: ExtractedData, template: BuilderTemplate): string => {
  const lines: string[] = [];

  if (data.vision) {
    lines.push(`**Vision:** ${data.vision}`);
  }
  if (data.targetAudience) {
    lines.push(`**For:** ${data.targetAudience}`);
  }
  if (data.features.length > 0) {
    lines.push(`**Features:** ${data.features.join(', ')}`);
  }
  if (data.stylePreferences.length > 0) {
    lines.push(`**Style:** ${data.stylePreferences.join(', ')}`);
  }
  if (data.integrations.length > 0) {
    lines.push(`**Integrations:** ${data.integrations.join(', ')}`);
  }
  if (data.authMethod) {
    lines.push(`**Login:** ${data.authMethod}`);
  }

  return lines.join('\n');
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function ConversationalOnboarding({
  template,
  agentConfig,
  onComplete,
  onBack,
}: ConversationalOnboardingProps) {
  // Adaptive service for personalization (pulls from existing user profile)
  const adaptiveService = getAdaptiveBuilderService();
  const userId = 'current-user'; // TODO: Get from auth context

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phases, setPhases] = useState(CONVERSATION_PHASES);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Personality & adaptation state (loaded from existing profile, NOT detected in real-time)
  // Users have already gone through assistant onboarding - we know who they are
  const [userPersonality, setUserPersonality] = useState<PersonalityType>('amiable');
  const [communicationStyle, setCommunicationStyle] = useState<{
    tone: CommunicationTone;
    verbosity: 'concise' | 'detailed' | 'balanced';
    encouragement: boolean;
  }>({ tone: 'encouraging', verbosity: 'balanced', encouragement: true });

  // Load user's existing profile on mount (from assistant onboarding)
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // This pulls the user's established profile from assistant onboarding
        const context = await adaptiveService.getUserContext(userId, 'easy');
        if (context.personalityType) {
          setUserPersonality(context.personalityType);
        }
        const style = adaptiveService.getCommunicationStyle(userId);
        setCommunicationStyle({
          tone: style.tone,
          verbosity: style.verbosity,
          encouragement: style.encouragement,
        });
        setProfileLoaded(true);
      } catch (error) {
        console.debug('[ConversationalOnboarding] Could not load profile:', error);
        setProfileLoaded(true); // Continue with defaults
      }
    };
    loadUserProfile();
  }, [adaptiveService, userId]);

  // Extracted data
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    features: [],
    stylePreferences: [],
    integrations: [],
    additionalNotes: [],
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Add assistant message with typing effect and knowledge context
  const addAssistantMessage = useCallback(async (
    content: string,
    options?: QuickOption[],
    phaseId?: string
  ) => {
    const messageId = crypto.randomUUID();

    // Show typing indicator
    setIsTyping(true);

    // Fetch knowledge context and adapt question based on personality
    let adaptedContent = content;
    let knowledgeHint: string | undefined;
    let warning: string | undefined;
    let recommended: string[] | undefined;

    if (phaseId && template.id) {
      try {
        const adaptation = await adaptiveService.adaptQuestion(
          userId,
          template.id,
          phaseId,
          content,
          options?.map(o => ({
            id: o.id,
            label: o.label,
            description: o.value,
          }))
        );

        // Use personality-adapted question text
        if (adaptation.adaptedQuestion.question) {
          adaptedContent = adaptation.adaptedQuestion.question;
        }

        // Extract knowledge hints
        if (adaptation.adaptedQuestion.knowledgeHint) {
          knowledgeHint = adaptation.adaptedQuestion.knowledgeHint;
        }

        // Extract warnings from gotchas
        if (adaptation.warnings.length > 0) {
          warning = adaptation.warnings[0];
        }

        // Extract recommendations
        if (adaptation.suggestedNextSteps.length > 0) {
          recommended = adaptation.suggestedNextSteps.slice(0, 3);
        }
      } catch (error) {
        // Silently continue without adaptation
        console.debug('[ConversationalOnboarding] Could not fetch adaptation:', error);
      }
    }

    // Simulate typing delay based on message length
    const typingDelay = Math.min(adaptedContent.length * 15, 2000);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: messageId,
          role: 'assistant',
          content: adaptedContent,
          timestamp: new Date(),
          options,
          knowledgeHint,
          warning,
          recommended,
        },
      ]);
    }, typingDelay);
  }, [adaptiveService, userId, template.id]);

  // Add user message
  // Note: Personality already known from assistant onboarding - no need to detect
  const addUserMessage = useCallback((content: string) => {
    // Process message for any session-level micro-adjustments
    // (doesn't change established personality, just tracks conversation flow)
    adaptiveService.processUserMessage(userId, content);

    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      },
    ]);
  }, [adaptiveService, userId]);

  // Process user response and extract data
  const processResponse = useCallback((response: string, optionValue?: string) => {
    const currentPhase = phases[currentPhaseIndex];
    const value = optionValue || response;

    // Extract data based on current phase
    switch (currentPhase.id) {
      case 'vision':
        if (questionIndex === 0) {
          setExtractedData(prev => ({ ...prev, vision: value }));
        } else {
          setExtractedData(prev => ({
            ...prev,
            additionalNotes: [...prev.additionalNotes, `Purpose: ${value}`],
          }));
        }
        break;

      case 'audience':
        setExtractedData(prev => ({ ...prev, targetAudience: value }));
        break;

      case 'features':
        if (value !== 'done' && value !== 'add-more') {
          setExtractedData(prev => ({
            ...prev,
            features: [...prev.features, value],
          }));
        }
        break;

      case 'style':
        if (questionIndex === 0 && value !== 'custom') {
          setExtractedData(prev => ({
            ...prev,
            stylePreferences: [...prev.stylePreferences, value],
          }));
        } else if (questionIndex === 1 && value.trim()) {
          setExtractedData(prev => ({
            ...prev,
            additionalNotes: [...prev.additionalNotes, `Inspiration: ${value}`],
          }));
        }
        break;

      case 'integrations':
        if (questionIndex === 0) {
          setExtractedData(prev => ({
            ...prev,
            integrations: [...prev.integrations, value],
          }));
        } else {
          setExtractedData(prev => ({ ...prev, authMethod: value }));
        }
        break;

      case 'confirm':
        if (value === 'build') {
          // Complete the onboarding
          onComplete(extractedData);
          return;
        } else if (value === 'change') {
          // Go back to beginning (simplified - could be smarter)
          setCurrentPhaseIndex(1);
          setQuestionIndex(0);
        }
        break;
    }

    // Move to next question or phase
    const phaseQuestions = currentPhase.questions;
    if (questionIndex < phaseQuestions.length - 1 && value !== 'done') {
      setQuestionIndex(prev => prev + 1);
    } else if (currentPhaseIndex < phases.length - 1) {
      // Mark current phase as complete
      setPhases(prev =>
        prev.map((p, i) => (i === currentPhaseIndex ? { ...p, completed: true } : p))
      );
      setCurrentPhaseIndex(prev => prev + 1);
      setQuestionIndex(0);
    }
  }, [currentPhaseIndex, questionIndex, phases, extractedData, onComplete]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isTyping) return;

    addUserMessage(inputValue);
    processResponse(inputValue);
    setInputValue('');
  }, [inputValue, isTyping, addUserMessage, processResponse]);

  // Handle quick option click
  const handleOptionClick = useCallback((option: QuickOption) => {
    addUserMessage(option.label);
    processResponse(option.value, option.value);
  }, [addUserMessage, processResponse]);

  // Start conversation on mount
  useEffect(() => {
    const startConversation = async () => {
      const phaseId = phases[0].id;
      const { message, options } = getQuestionForPhase(
        phaseId,
        template,
        extractedData,
        0
      );
      await addAssistantMessage(message, options, phaseId);
    };

    if (messages.length === 0) {
      startConversation();
    }
  }, []);

  // Send next question when phase/question changes
  useEffect(() => {
    if (messages.length > 0 && !isTyping) {
      const currentPhase = phases[currentPhaseIndex];
      const phaseId = currentPhase.id;
      const { message, options } = getQuestionForPhase(
        phaseId,
        template,
        extractedData,
        questionIndex
      );

      // Don't re-send if the last message was from assistant
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'user') {
        setTimeout(async () => {
          await addAssistantMessage(message, options, phaseId);
        }, 500);
      }
    }
  }, [currentPhaseIndex, questionIndex]);

  // Current phase info
  const currentPhase = phases[currentPhaseIndex];
  const progress = ((currentPhaseIndex + 1) / phases.length) * 100;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header with progress */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-white">Building {template.name}</span>
          </div>
          <div className="text-sm text-gray-400">
            {currentPhaseIndex + 1} / {phases.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Phase indicators */}
        <div className="flex gap-1 mt-2">
          {phases.map((phase, idx) => (
            <div
              key={phase.id}
              className={`flex-1 h-1 rounded-full transition-colors ${
                idx < currentPhaseIndex
                  ? 'bg-green-500'
                  : idx === currentPhaseIndex
                    ? 'bg-purple-500'
                    : 'bg-gray-700'
              }`}
              title={phase.name}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-fade-in-up ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            style={{
              animationDelay: `${Math.min(index * 50, 200)}ms`,
              animationFillMode: 'backwards',
            }}
          >
            {/* Avatar with pulse effect for latest assistant message */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                message.role === 'assistant'
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
                  : 'bg-gray-700'
              } ${message.role === 'assistant' && index === messages.length - 1 ? 'ring-2 ring-purple-400/50 ring-offset-2 ring-offset-gray-900' : ''}`}
            >
              {message.role === 'assistant' ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-gray-300" />
              )}
            </div>

            {/* Message content */}
            <div
              className={`max-w-[80%] ${
                message.role === 'user' ? 'text-right' : ''
              }`}
            >
              <div
                className={`inline-block p-3 rounded-2xl ${
                  message.role === 'assistant'
                    ? 'bg-gray-800 text-gray-100 rounded-tl-sm'
                    : 'bg-purple-600 text-white rounded-tr-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>

              {/* Knowledge hint from wisdom/patterns */}
              {message.role === 'assistant' && message.knowledgeHint && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <Lightbulb className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-200">{message.knowledgeHint}</p>
                </div>
              )}

              {/* Warning from gotchas */}
              {message.role === 'assistant' && message.warning && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">{message.warning}</p>
                </div>
              )}

              {/* Pattern-based recommendations */}
              {message.role === 'assistant' && message.recommended && message.recommended.length > 0 && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <Star className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-green-300 font-medium mb-1">Recommended based on similar projects:</p>
                    <ul className="text-xs text-green-200 space-y-0.5">
                      {message.recommended.map((rec, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Quick options */}
              {message.role === 'assistant' && message.options && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {message.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOptionClick(option)}
                      disabled={isTyping}
                      className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-full border border-gray-700 hover:border-purple-500 transition-colors disabled:opacity-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator with smooth entrance */}
        {isTyping && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your response..."
            disabled={isTyping}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            title="Send message"
            aria-label="Send message"
            className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Current phase hint and communication style indicator */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3 h-3" />
            <span>Currently: {currentPhase.name} - {currentPhase.description}</span>
          </div>
          {/* Communication style indicator (from established profile) */}
          {profileLoaded && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-800 rounded-full">
              <div className={`w-1.5 h-1.5 rounded-full ${
                userPersonality === 'analytical' ? 'bg-blue-400' :
                userPersonality === 'driver' ? 'bg-orange-400' :
                userPersonality === 'expressive' ? 'bg-pink-400' :
                'bg-green-400'
              }`} />
              <span className="text-gray-400">
                {communicationStyle.tone} mode
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ExtractedData };
