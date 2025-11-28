/**
 * Settings Modal Component
 *
 * Allows users to edit their preferences after onboarding
 * Local-first: changes are saved to localStorage immediately
 * Optionally syncs to database when user enables it
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Save, Cloud, CloudOff, User, Sparkles, MessageCircle } from 'lucide-react';
import { UserPreferences } from '@/components/AssistantOnboarding';

interface SettingsModalProps {
  preferences: UserPreferences | null;
  onSave: (preferences: UserPreferences) => void;
  onClose: () => void;
  syncEnabled: boolean;
  onSyncChange: (enabled: boolean) => void;
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
  communicationStyle: 'conversational',
};

export function SettingsModal({
  preferences,
  onSave,
  onClose,
  syncEnabled,
  onSyncChange,
}: SettingsModalProps) {
  const [editedPrefs, setEditedPrefs] = useState<UserPreferences>(
    preferences || defaultPreferences
  );
  const [activeTab, setActiveTab] = useState<'profile' | 'assistant' | 'sync'>('profile');

  useEffect(() => {
    if (preferences) {
      setEditedPrefs(preferences);
    }
  }, [preferences]);

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
