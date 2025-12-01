/**
 * Settings Modal Component
 *
 * Allows users to edit their preferences after onboarding
 * Local-first: changes are saved to localStorage immediately
 * Optionally syncs to database when user enables it
 */

'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { X, Save, Cloud, CloudOff, User, Sparkles, MessageCircle, Brain, Trash2, AlertCircle, FileSearch, Lightbulb, AlertTriangle, Users, Mic, Edit2, Plus, Languages, Package } from 'lucide-react';
import { UserPreferences } from '@/components/BuilderOnboarding';
import type { MemoryEntry, CompressedMemory } from '@/lib/knowledge/types';
import type { KnowledgePacket } from '@/services/MasterRpcClient';

// Lazy load marketplace component
const KnowledgeMarketplace = lazy(() => import('@/components/marketplace/KnowledgeMarketplace'));

/**
 * UI-friendly memory format returned by the API
 * Maps from ConversationMemory (activeMemory/compressedMemory) to this format
 */
interface UIConversationMemory {
  recentMessages: Array<{
    id: string;
    type: string;
    content: string;
    importance: string;
    tags?: string[];
    timestamp: string;
  }>;
  compressedHistory: CompressedMemory[];
  criticalFacts: MemoryEntry[];
}

/**
 * Speaker profile for voice/family recognition
 */
interface SpeakerProfile {
  id: string;
  name?: string;
  nickname?: string;
  relationship?: string;
  preferredLanguage?: string;
  estimatedAge?: 'child' | 'teen' | 'adult' | 'senior';
  messageCount: number;
  firstSeen: string;
  lastSeen: string;
  interests: string[];
  rememberedFacts: string[];
}

/**
 * Essence/personality configuration
 */
interface EssenceConfig {
  voiceTone: 'friendly' | 'professional' | 'playful' | 'supportive' | 'neutral';
  responseStyle: 'concise' | 'detailed' | 'balanced';
  personalityTraits: string[];
  customGreeting?: string;
  familyMode: boolean;
  childSafetyLevel: 'open' | 'family' | 'strict';
}

interface SettingsModalProps {
  preferences: UserPreferences | null;
  onSave: (preferences: UserPreferences) => void;
  onClose: () => void;
  syncEnabled: boolean;
  onSyncChange: (enabled: boolean) => void;
  conversationId?: string;
  onPacketApplied?: (packet: KnowledgePacket, mode: 'assistant' | 'build') => void;
  onPacketRemoved?: (packetId: string, mode: 'assistant' | 'build') => void;
}

const roleOptions = [
  { value: 'developer', label: 'Developer', icon: '💻' },
  { value: 'designer', label: 'Designer', icon: '🎨' },
  { value: 'product_manager', label: 'Product Manager', icon: '📋' },
  { value: 'data_analyst', label: 'Data Analyst', icon: '📊' },
  { value: 'student', label: 'Student', icon: '📚' },
  { value: 'entrepreneur', label: 'Entrepreneur', icon: '🚀' },
  { value: 'researcher', label: 'Researcher', icon: '🔬' },
  { value: 'other', label: 'Other', icon: '👤' },
];

const experienceOptions = [
  { value: 'beginner', label: 'Beginner', desc: 'New to this field' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years experience' },
  { value: 'advanced', label: 'Advanced', desc: '3-7 years experience' },
  { value: 'expert', label: 'Expert', desc: '7+ years experience' },
];

const styleOptions = [
  { value: 'concise', label: 'Concise', desc: 'Brief, to the point', icon: '⚡' },
  { value: 'detailed', label: 'Detailed', desc: 'Comprehensive explanations', icon: '📖' },
  { value: 'conversational', label: 'Conversational', desc: 'Friendly and engaging', icon: '💬' },
];

const modeOptions = [
  { value: 'search', label: 'Search', desc: 'Find information fast', color: 'blue' },
  { value: 'assist', label: 'Assist', desc: 'Get help and answers', color: 'purple' },
  { value: 'build', label: 'Build', desc: 'Create and generate', color: 'green' },
];

const goalOptions = [
  { value: 'learn', label: 'Learn new skills' },
  { value: 'build', label: 'Build projects' },
  { value: 'research', label: 'Conduct research' },
  { value: 'solve_problems', label: 'Solve problems' },
  { value: 'explore', label: 'Explore ideas' },
  { value: 'collaborate', label: 'Collaborate' },
];

const interestOptions = [
  'AI/ML', 'Web Development', 'Mobile Apps', 'DevOps', 'Cloud',
  'Data Science', 'Cybersecurity', 'Blockchain', 'Game Dev', 'Design',
  'Product', 'Business', 'Marketing', 'Writing', 'Research',
];

const defaultPreferences: UserPreferences = {
  role: '',
  experienceLevel: '',
  primaryGoals: [],
  preferredMode: 'assist',
  interests: [],
  customInterests: [],
  communicationStyle: 'conversational',
  workflowPhases: ['research', 'plan', 'deliver'],
  preferredLanguage: 'en',
};

export function SettingsModal({
  preferences,
  onSave,
  onClose,
  syncEnabled,
  onSyncChange,
  conversationId,
  onPacketApplied,
  onPacketRemoved,
}: SettingsModalProps) {
  const [editedPrefs, setEditedPrefs] = useState<UserPreferences>(
    preferences || defaultPreferences
  );
  const [activeTab, setActiveTab] = useState<'profile' | 'assistant' | 'voice' | 'memory' | 'packets' | 'sync'>('profile');

  // Memory management state
  const [memory, setMemory] = useState<UIConversationMemory | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  // Voice/Family management state
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([]);
  const [speakersLoading, setSpeakersLoading] = useState(false);
  const [speakersError, setSpeakersError] = useState<string | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editedSpeaker, setEditedSpeaker] = useState<Partial<SpeakerProfile>>({});

  // Essence/personality settings
  const [essence, setEssence] = useState<EssenceConfig>({
    voiceTone: 'friendly',
    responseStyle: 'balanced',
    personalityTraits: [],
    familyMode: false,
    childSafetyLevel: 'family',
  });

  useEffect(() => {
    if (preferences) {
      setEditedPrefs(preferences);
    }
  }, [preferences]);

  // Load speakers when switching to voice tab
  const loadSpeakers = useCallback(async () => {
    setSpeakersLoading(true);
    setSpeakersError(null);

    try {
      const response = await fetch('/api/speakers');
      if (!response.ok) {
        throw new Error('Failed to load speakers');
      }
      const data = await response.json();
      setSpeakers(data.speakers || []);

      // Also load essence config
      if (data.essence) {
        setEssence(data.essence);
      }
    } catch (error) {
      console.error('Failed to load speakers:', error);
      setSpeakersError('Failed to load voice profiles');
    } finally {
      setSpeakersLoading(false);
    }
  }, []);

  // Load memory when switching to memory tab
  const loadMemory = useCallback(async () => {
    if (!conversationId) {
      setMemoryError('No active conversation');
      return;
    }

    setMemoryLoading(true);
    setMemoryError(null);

    try {
      const response = await fetch(`/api/memory?conversationId=${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to load memory');
      }
      const data = await response.json();
      setMemory(data.memory);
    } catch (error) {
      console.error('Failed to load memory:', error);
      setMemoryError('Failed to load conversation memory');
    } finally {
      setMemoryLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (activeTab === 'memory') {
      loadMemory();
    }
    if (activeTab === 'voice') {
      loadSpeakers();
    }
  }, [activeTab, loadMemory, loadSpeakers]);

  // Update a speaker profile
  const updateSpeakerProfile = async (speakerId: string, updates: Partial<SpeakerProfile>) => {
    try {
      const response = await fetch('/api/speakers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId, updates }),
      });

      if (response.ok) {
        setSpeakers(prev => prev.map(s =>
          s.id === speakerId ? { ...s, ...updates } : s
        ));
        setEditingSpeaker(null);
        setEditedSpeaker({});
      }
    } catch (error) {
      console.error('Failed to update speaker:', error);
    }
  };

  // Delete a speaker profile
  const deleteSpeakerProfile = async (speakerId: string) => {
    if (!confirm('Remove this family member profile? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/speakers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId }),
      });

      if (response.ok) {
        setSpeakers(prev => prev.filter(s => s.id !== speakerId));
      }
    } catch (error) {
      console.error('Failed to delete speaker:', error);
    }
  };

  // Save essence configuration
  const saveEssenceConfig = async (config: EssenceConfig) => {
    try {
      const response = await fetch('/api/speakers/essence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setEssence(config);
      }
    } catch (error) {
      console.error('Failed to save essence config:', error);
    }
  };

  // Delete a critical fact
  const deleteCriticalFact = async (factId: string) => {
    if (!conversationId || !memory) return;

    try {
      const response = await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          type: 'critical',
          entryId: factId,
        }),
      });

      if (response.ok) {
        setMemory({
          ...memory,
          criticalFacts: memory.criticalFacts.filter(f => f.id !== factId),
        });
      }
    } catch (error) {
      console.error('Failed to delete fact:', error);
    }
  };

  // Clear all memory
  const clearAllMemory = async () => {
    if (!conversationId) return;

    if (!confirm('Are you sure you want to clear all conversation memory? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          type: 'all',
        }),
      });

      if (response.ok) {
        setMemory(null);
      }
    } catch (error) {
      console.error('Failed to clear memory:', error);
    }
  };

  const handleSave = () => {
    onSave(editedPrefs);
  };

  const toggleGoal = (goal: string) => {
    setEditedPrefs((prev) => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter((g) => g !== goal)
        : [...prev.primaryGoals, goal],
    }));
  };

  const toggleInterest = (interest: string) => {
    setEditedPrefs((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'assistant'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageCircle className="w-4 h-4 inline mr-2" />
            Assistant
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'voice'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Voice
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'memory'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4 inline mr-2" />
            Memory
          </button>
          <button
            onClick={() => setActiveTab('packets')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'packets'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Packets
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sync'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {syncEnabled ? (
              <Cloud className="w-4 h-4 inline mr-2" />
            ) : (
              <CloudOff className="w-4 h-4 inline mr-2" />
            )}
            Sync
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Your Role
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {roleOptions.map((role) => (
                    <button
                      key={role.value}
                      onClick={() => setEditedPrefs((p) => ({ ...p, role: role.value }))}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        editedPrefs.role === role.value
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl">{role.icon}</span>
                      <div className="text-xs mt-1">{role.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Experience Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {experienceOptions.map((exp) => (
                    <button
                      key={exp.value}
                      onClick={() => setEditedPrefs((p) => ({ ...p, experienceLevel: exp.value }))}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        editedPrefs.experienceLevel === exp.value
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium">{exp.label}</div>
                      <div className="text-xs opacity-75">{exp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Interests
                </label>
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        editedPrefs.interests.includes(interest)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Primary Goals
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {goalOptions.map((goal) => (
                    <button
                      key={goal.value}
                      onClick={() => toggleGoal(goal.value)}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        editedPrefs.primaryGoals.includes(goal.value)
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assistant' && (
            <div className="space-y-6">
              {/* Communication Style */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Communication Style
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {styleOptions.map((style) => (
                    <button
                      key={style.value}
                      onClick={() =>
                        setEditedPrefs((p) => ({
                          ...p,
                          communicationStyle: style.value as UserPreferences['communicationStyle'],
                        }))
                      }
                      className={`p-4 rounded-lg border text-center transition-all ${
                        editedPrefs.communicationStyle === style.value
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl">{style.icon}</span>
                      <div className="font-medium mt-2">{style.label}</div>
                      <div className="text-xs opacity-75 mt-1">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Default Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {modeOptions.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() =>
                        setEditedPrefs((p) => ({
                          ...p,
                          preferredMode: mode.value as UserPreferences['preferredMode'],
                        }))
                      }
                      className={`p-4 rounded-lg border text-center transition-all ${
                        editedPrefs.preferredMode === mode.value
                          ? `border-${mode.color}-500 bg-${mode.color}-500/20 text-white`
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                      style={{
                        borderColor:
                          editedPrefs.preferredMode === mode.value
                            ? mode.color === 'blue'
                              ? '#3b82f6'
                              : mode.color === 'purple'
                                ? '#a855f7'
                                : '#22c55e'
                            : undefined,
                        backgroundColor:
                          editedPrefs.preferredMode === mode.value
                            ? mode.color === 'blue'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : mode.color === 'purple'
                                ? 'rgba(168, 85, 247, 0.2)'
                                : 'rgba(34, 197, 94, 0.2)'
                            : undefined,
                      }}
                    >
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-xs opacity-75 mt-1">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Preview</h4>
                <p className="text-sm text-gray-400">
                  {editedPrefs.communicationStyle === 'concise' &&
                    'Responses will be brief and to the point, using bullet points when helpful.'}
                  {editedPrefs.communicationStyle === 'detailed' &&
                    'Responses will include comprehensive explanations with examples and context for thorough understanding.'}
                  {editedPrefs.communicationStyle === 'conversational' &&
                    "Responses will be friendly and engaging, like chatting with a knowledgeable friend who's happy to help."}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-6">
              {/* Voice/Family Info Header */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-400">Voice & Family Recognition</h4>
                    <p className="text-sm text-gray-300 mt-1">
                      Infinity learns to recognize different family members and adapts its communication style naturally.
                      Manage profiles and customize how Infinity responds to each person.
                    </p>
                  </div>
                </div>
              </div>

              {speakersLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}

              {speakersError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-400">Error Loading Profiles</h4>
                    <p className="text-sm text-gray-300 mt-1">{speakersError}</p>
                  </div>
                </div>
              )}

              {!speakersLoading && !speakersError && (
                <>
                  {/* Essence Configuration */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Mic className="w-4 h-4 text-purple-400" />
                      <h4 className="font-medium text-gray-300">Assistant Essence</h4>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
                      {/* Voice Tone */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Voice Tone</label>
                        <div className="flex flex-wrap gap-2">
                          {(['friendly', 'professional', 'playful', 'supportive', 'neutral'] as const).map((tone) => (
                            <button
                              key={tone}
                              onClick={() => {
                                const newEssence = { ...essence, voiceTone: tone };
                                setEssence(newEssence);
                                saveEssenceConfig(newEssence);
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all ${
                                essence.voiceTone === tone
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Family Mode Toggle */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                        <div>
                          <h5 className="text-sm font-medium text-gray-300">Family Mode</h5>
                          <p className="text-xs text-gray-500">Auto-adapt for children and family members</p>
                        </div>
                        <button
                          type="button"
                          title="Toggle family mode"
                          onClick={() => {
                            const newEssence = { ...essence, familyMode: !essence.familyMode };
                            setEssence(newEssence);
                            saveEssenceConfig(newEssence);
                          }}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            essence.familyMode ? 'bg-blue-600' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              essence.familyMode ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Child Safety Level */}
                      {essence.familyMode && (
                        <div className="pt-2">
                          <label className="block text-xs text-gray-400 mb-2">Child Safety Level</label>
                          <div className="flex gap-2">
                            {(['open', 'family', 'strict'] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => {
                                  const newEssence = { ...essence, childSafetyLevel: level };
                                  setEssence(newEssence);
                                  saveEssenceConfig(newEssence);
                                }}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs capitalize transition-all ${
                                  essence.childSafetyLevel === level
                                    ? level === 'strict' ? 'bg-red-600/30 text-red-400 border border-red-500'
                                    : level === 'family' ? 'bg-blue-600/30 text-blue-400 border border-blue-500'
                                    : 'bg-green-600/30 text-green-400 border border-green-500'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-transparent'
                                }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Family Members */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <h4 className="font-medium text-gray-300">Recognized Speakers</h4>
                        <span className="text-xs text-gray-500">({speakers.length})</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingSpeaker('new');
                          setEditedSpeaker({ name: '', relationship: '', estimatedAge: 'adult' });
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>

                    {speakers.length === 0 ? (
                      <div className="bg-gray-800 rounded-lg p-6 text-center">
                        <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium text-gray-400">No Profiles Yet</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Infinity will automatically learn to recognize different speakers as they interact.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {speakers.map((speaker) => (
                          <div
                            key={speaker.id}
                            className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                          >
                            {editingSpeaker === speaker.id ? (
                              // Edit mode
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={editedSpeaker.name || ''}
                                    onChange={(e) => setEditedSpeaker({ ...editedSpeaker, name: e.target.value })}
                                    placeholder="Name"
                                    className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                  />
                                  <input
                                    type="text"
                                    value={editedSpeaker.nickname || ''}
                                    onChange={(e) => setEditedSpeaker({ ...editedSpeaker, nickname: e.target.value })}
                                    placeholder="Nickname"
                                    className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={editedSpeaker.relationship || ''}
                                    onChange={(e) => setEditedSpeaker({ ...editedSpeaker, relationship: e.target.value })}
                                    className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                    title="Select relationship"
                                  >
                                    <option value="">Relationship</option>
                                    <option value="parent">Parent</option>
                                    <option value="child">Child</option>
                                    <option value="grandparent">Grandparent</option>
                                    <option value="friend">Friend</option>
                                    <option value="other">Other</option>
                                  </select>
                                  <select
                                    value={editedSpeaker.estimatedAge || 'adult'}
                                    onChange={(e) => setEditedSpeaker({ ...editedSpeaker, estimatedAge: e.target.value as SpeakerProfile['estimatedAge'] })}
                                    className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                    title="Select age group"
                                  >
                                    <option value="child">Child</option>
                                    <option value="teen">Teen</option>
                                    <option value="adult">Adult</option>
                                    <option value="senior">Senior</option>
                                  </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingSpeaker(null);
                                      setEditedSpeaker({});
                                    }}
                                    className="px-3 py-1 text-xs text-gray-400 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => updateSpeakerProfile(speaker.id, editedSpeaker)}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // View mode
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-white">
                                      {speaker.name || speaker.nickname || 'Unknown'}
                                    </span>
                                    {speaker.relationship && (
                                      <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                        {speaker.relationship}
                                      </span>
                                    )}
                                    {speaker.estimatedAge && speaker.estimatedAge !== 'adult' && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        speaker.estimatedAge === 'child' ? 'bg-green-500/20 text-green-400' :
                                        speaker.estimatedAge === 'teen' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-purple-500/20 text-purple-400'
                                      }`}>
                                        {speaker.estimatedAge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span>{speaker.messageCount} messages</span>
                                    {speaker.preferredLanguage && speaker.preferredLanguage !== 'en' && (
                                      <span className="flex items-center gap-1">
                                        <Languages className="w-3 h-3" />
                                        {speaker.preferredLanguage.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    title="Edit profile"
                                    onClick={() => {
                                      setEditingSpeaker(speaker.id);
                                      setEditedSpeaker({
                                        name: speaker.name,
                                        nickname: speaker.nickname,
                                        relationship: speaker.relationship,
                                        estimatedAge: speaker.estimatedAge,
                                      });
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete profile"
                                    onClick={() => deleteSpeakerProfile(speaker.id)}
                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Language Preferences */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Languages className="w-4 h-4 text-green-400" />
                      <h4 className="text-sm font-medium text-gray-300">Language Detection</h4>
                    </div>
                    <p className="text-xs text-gray-400">
                      Infinity automatically detects when you or family members speak in different languages
                      and responds bilingually. Currently supporting: English, Spanish, French, German, Italian,
                      Portuguese, Japanese, Korean, Chinese, and Arabic.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-6">
              {/* Memory Info Header */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-purple-400">Conversation Memory</h4>
                    <p className="text-sm text-gray-300 mt-1">
                      The assistant remembers key facts and insights from your conversations.
                      You can review and manage what&apos;s remembered here.
                    </p>
                  </div>
                </div>
              </div>

              {memoryLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              )}

              {memoryError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-400">Error Loading Memory</h4>
                    <p className="text-sm text-gray-300 mt-1">{memoryError}</p>
                  </div>
                </div>
              )}

              {!memoryLoading && !memoryError && memory && (
                <>
                  {/* Critical Facts */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                      <h4 className="font-medium text-gray-300">Critical Facts</h4>
                      <span className="text-xs text-gray-500">({memory.criticalFacts.length})</span>
                    </div>

                    {memory.criticalFacts.length === 0 ? (
                      <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500 text-sm">
                        No critical facts stored yet. Important information from your conversations will appear here.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {memory.criticalFacts.map((fact) => (
                          <div
                            key={fact.id}
                            className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-start justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-300 line-clamp-2">{fact.content}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  fact.importance === 'critical'
                                    ? 'bg-red-500/20 text-red-400'
                                    : fact.importance === 'high'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-gray-700 text-gray-400'
                                }`}>
                                  {fact.importance}
                                </span>
                                {fact.tags && fact.tags.length > 0 && (
                                  <span className="text-xs text-gray-500">
                                    {fact.tags.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => deleteCriticalFact(fact.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Remove this fact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Compressed History */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileSearch className="w-4 h-4 text-blue-400" />
                      <h4 className="font-medium text-gray-300">Compressed History</h4>
                      <span className="text-xs text-gray-500">({memory.compressedHistory.length})</span>
                    </div>

                    {memory.compressedHistory.length === 0 ? (
                      <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500 text-sm">
                        No compressed history yet. Older conversations are summarized here to save space while preserving insights.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {memory.compressedHistory.map((segment, index) => (
                          <div
                            key={`segment-${index}`}
                            className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                          >
                            <p className="text-sm text-gray-300">{segment.summary}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>Messages: {segment.originalCount}</span>
                              {segment.keyInsights && segment.keyInsights.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{segment.keyInsights.length} insights</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Messages Count */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-300">Recent Messages</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {memory.recentMessages.length} messages in active memory
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-400">
                          {memory.recentMessages.length}
                        </div>
                        <div className="text-xs text-gray-500">in context</div>
                      </div>
                    </div>
                  </div>

                  {/* Warning about gotchas */}
                  {memory.compressedHistory.some(h => h.keyInsights?.some(i => i.startsWith('G:'))) && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-400">Gotchas Detected</h4>
                        <p className="text-sm text-gray-300 mt-1">
                          Some pitfalls and warnings were identified in past conversations.
                          The assistant will remember these to help you avoid similar issues.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!memoryLoading && !memoryError && !memory && !conversationId && (
                <div className="bg-gray-800 rounded-lg p-6 text-center">
                  <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-400">No Active Conversation</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Start a conversation to begin building memory.
                  </p>
                </div>
              )}

              {/* Clear All Memory */}
              {memory && (memory.criticalFacts.length > 0 || memory.compressedHistory.length > 0) && (
                <div className="pt-4 border-t border-gray-700">
                  <button
                    onClick={clearAllMemory}
                    className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All Memory
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    This will remove all stored facts and compressed history. This cannot be undone.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'packets' && (
            <div className="space-y-4 -mx-6 -my-6">
              {/* Knowledge Marketplace Info */}
              <div className="px-6 pt-6">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-cyan-400">Knowledge Packets</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        Enhance your Assistant and Build experiences with specialized knowledge packets.
                        Apply patterns, insights, and expertise to get more contextual and helpful responses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Embedded Marketplace */}
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                  </div>
                }
              >
                <KnowledgeMarketplace
                  defaultMode="all"
                  onPacketApplied={onPacketApplied}
                  onPacketRemoved={onPacketRemoved}
                  className="h-[400px]"
                />
              </Suspense>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              {/* Sync Toggle */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">Cloud Sync</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Sync your preferences to the cloud so they persist across devices
                    </p>
                  </div>
                  <button
                    onClick={() => onSyncChange(!syncEnabled)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      syncEnabled ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                        syncEnabled ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-400 mb-2">Local-First Storage</h4>
                <p className="text-sm text-gray-300">
                  Your preferences are always saved locally in your browser first. Cloud sync
                  is optional and only used to persist preferences across different devices.
                </p>
              </div>

              {/* Privacy Info */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="font-medium text-gray-300 mb-2">Privacy</h4>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">-</span>
                    Preferences are stored locally in your browser
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">-</span>
                    Cloud sync only stores your preferences (no chat history)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">-</span>
                    You can clear all data at any time
                  </li>
                </ul>
              </div>

              {/* Clear Data */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all preferences?')) {
                      setEditedPrefs(defaultPreferences);
                      localStorage.removeItem('infinity_user_preferences');
                      localStorage.removeItem('infinity_sync_preferences');
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                >
                  Clear All Preferences
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-medium transition-all flex items-center gap-2 text-white"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
