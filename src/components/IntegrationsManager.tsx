'use client';

/**
 * Integrations Manager Component
 *
 * Allows users to connect, manage, and disconnect integrations.
 * Connected integrations are stored in the user's profile and
 * accessible by agents for automation tasks.
 *
 * Features:
 * - OAuth connection flow
 * - API key input for non-OAuth providers
 * - Browser session capture toggle
 * - Connection status monitoring
 * - Integration event history
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  Globe,
  Key,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Search,
  Filter,
} from 'lucide-react';
import {
  type IntegrationProvider,
  type UserIntegration,
  type IntegrationCategory,
  type ConnectionStatus,
  INTEGRATION_CONFIGS,
  INTEGRATION_CATEGORIES,
  getIntegrationConfig,
} from '@/types/integrations';
import { integrationService } from '@/services/IntegrationService';

// ============================================================================
// TYPES
// ============================================================================

interface IntegrationsManagerProps {
  userId: string;
  onIntegrationChange?: (integrations: UserIntegration[]) => void;
}

type ViewMode = 'grid' | 'list';

// ============================================================================
// STATUS HELPERS
// ============================================================================

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  connected: { label: 'Connected', color: 'text-green-400', icon: <CheckCircle2 className="w-4 h-4" /> },
  expired: { label: 'Expired', color: 'text-yellow-400', icon: <Clock className="w-4 h-4" /> },
  revoked: { label: 'Disconnected', color: 'text-gray-400', icon: <X className="w-4 h-4" /> },
  pending: { label: 'Pending', color: 'text-blue-400', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  error: { label: 'Error', color: 'text-red-400', icon: <AlertCircle className="w-4 h-4" /> },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function IntegrationsManager({
  userId,
  onIntegrationChange,
}: IntegrationsManagerProps) {
  const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // API key input state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Load integrations
  useEffect(() => {
    loadIntegrations();
  }, [userId]);

  const loadIntegrations = async () => {
    setIsLoading(true);
    try {
      const userIntegrations = await integrationService.getUserIntegrations(userId);
      setIntegrations(userIntegrations);
      onIntegrationChange?.(userIntegrations);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter available providers
  const availableProviders = Object.values(INTEGRATION_CONFIGS).filter((config) => {
    const matchesSearch =
      searchQuery === '' ||
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || config.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Check if provider is connected
  const isProviderConnected = (provider: IntegrationProvider): boolean => {
    return integrations.some((i) => i.provider === provider && i.status === 'connected');
  };

  // Get integration for provider
  const getProviderIntegration = (provider: IntegrationProvider): UserIntegration | undefined => {
    return integrations.find((i) => i.provider === provider);
  };

  // Start OAuth connection
  const handleOAuthConnect = useCallback(async (provider: IntegrationProvider) => {
    setIsConnecting(true);
    setConnectError(null);

    try {
      const redirectUri = `${window.location.origin}/api/integrations/callback`;
      const result = await integrationService.startOAuthFlow(userId, provider, redirectUri);

      // Store state in sessionStorage for callback
      sessionStorage.setItem('oauth_state', result.state);

      // Redirect to provider
      window.location.href = result.authUrl;
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Failed to start OAuth flow');
      setIsConnecting(false);
    }
  }, [userId]);

  // Connect with API key
  const handleApiKeyConnect = useCallback(async () => {
    if (!selectedProvider || !apiKeyInput.trim()) return;

    setIsConnecting(true);
    setConnectError(null);

    try {
      const result = await integrationService.connectWithApiKey(
        userId,
        selectedProvider,
        apiKeyInput.trim(),
        displayName || undefined
      );

      if (result.success && result.integration) {
        setIntegrations((prev) => [...prev, result.integration!]);
        onIntegrationChange?.([...integrations, result.integration]);
        setShowConnectModal(false);
        setSelectedProvider(null);
        setApiKeyInput('');
        setDisplayName('');
      } else {
        setConnectError(result.error || 'Failed to connect');
      }
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [selectedProvider, apiKeyInput, displayName, userId, integrations, onIntegrationChange]);

  // Connect Telegram bot
  const handleTelegramConnect = useCallback(async () => {
    if (!apiKeyInput.trim()) return;

    setIsConnecting(true);
    setConnectError(null);

    try {
      const result = await integrationService.connectTelegramBot(
        userId,
        apiKeyInput.trim(),
        displayName || undefined
      );

      if (result.success && result.integration) {
        setIntegrations((prev) => [...prev, result.integration!]);
        onIntegrationChange?.([...integrations, result.integration]);
        setShowConnectModal(false);
        setSelectedProvider(null);
        setApiKeyInput('');
        setDisplayName('');
      } else {
        setConnectError(result.error || 'Failed to connect');
      }
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [apiKeyInput, displayName, userId, integrations, onIntegrationChange]);

  // Disconnect integration
  const handleDisconnect = useCallback(async (integrationId: string) => {
    try {
      await integrationService.disconnect(integrationId);
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId ? { ...i, status: 'revoked' as ConnectionStatus } : i
        )
      );
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, []);

  // Refresh token
  const handleRefresh = useCallback(async (integrationId: string) => {
    try {
      const result = await integrationService.refreshToken(integrationId);
      if (result.success) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status: 'connected' as ConnectionStatus, expiresAt: result.newExpiry }
              : i
          )
        );
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  }, []);

  // Handle provider selection
  const handleProviderSelect = (provider: IntegrationProvider) => {
    const config = getIntegrationConfig(provider);
    setSelectedProvider(provider);
    setConnectError(null);
    setApiKeyInput('');
    setDisplayName('');

    if (config.authMethod === 'oauth2') {
      handleOAuthConnect(provider);
    }
    // For API key and bot token, show the modal
  };

  // Render connect modal
  const renderConnectModal = () => {
    if (!selectedProvider) return null;

    const config = getIntegrationConfig(selectedProvider);
    const isOAuth = config.authMethod === 'oauth2';
    const isTelegram = selectedProvider === 'telegram';

    if (isOAuth) {
      // OAuth is handled by redirect, show loading
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Connecting to {config.name}
              </h3>
              <p className="text-gray-400">
                Redirecting to {config.name} for authorization...
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{config.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Connect {config.name}
                </h3>
                <p className="text-sm text-gray-400">{config.description}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowConnectModal(false);
                setSelectedProvider(null);
              }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-400 font-medium">How to get your {isTelegram ? 'bot token' : 'API key'}</p>
                <ol className="mt-2 space-y-1 text-blue-300/70 list-decimal list-inside">
                  {isTelegram ? (
                    <>
                      <li>Open Telegram and search for @BotFather</li>
                      <li>Send /newbot to create a new bot</li>
                      <li>Copy the bot token provided</li>
                    </>
                  ) : (
                    <>
                      <li>Go to {config.name} dashboard</li>
                      <li>Navigate to API keys or settings</li>
                      <li>Create and copy your API key</li>
                    </>
                  )}
                </ol>
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:underline"
                >
                  View documentation
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isTelegram ? 'Bot Token' : 'API Key'}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={isTelegram ? '123456789:ABCdefGHI...' : 'sk-...'}
                  className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Name <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={`My ${config.name}`}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {connectError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {connectError}
              </div>
            )}

            <button
              onClick={isTelegram ? handleTelegramConnect : handleApiKeyConnect}
              disabled={!apiKeyInput.trim() || isConnecting}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Connect {config.name}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render connected integration card
  const renderIntegrationCard = (integration: UserIntegration) => {
    const config = getIntegrationConfig(integration.provider);
    const status = STATUS_CONFIG[integration.status];

    return (
      <div
        key={integration.id}
        className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h4 className="font-medium text-white">{integration.displayName}</h4>
              <div className={`flex items-center gap-1 text-sm ${status.color}`}>
                {status.icon}
                {status.label}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {integration.status === 'expired' && (
              <button
                onClick={() => handleRefresh(integration.id)}
                className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
                title="Refresh token"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleDisconnect(integration.id)}
              className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Disconnect"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        {integration.metadata.email && (
          <p className="mt-2 text-sm text-gray-500">{integration.metadata.email}</p>
        )}

        {/* Browser access indicator */}
        {integration.browserAccessEnabled && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Globe className="w-3 h-3" />
            Browser access enabled
          </div>
        )}

        {/* Last used */}
        {integration.lastUsedAt && (
          <p className="mt-1 text-xs text-gray-600">
            Last used: {new Date(integration.lastUsedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Integrations</h2>
          <p className="text-sm text-gray-400 mt-1">
            Connect services to enable agent automation
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Integration
        </button>
      </div>

      {/* Connected Integrations */}
      {integrations.filter((i) => i.status === 'connected').length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Connected</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations
              .filter((i) => i.status === 'connected')
              .map(renderIntegrationCard)}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      {showConnectModal && !selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Add Integration</h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search integrations..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              {INTEGRATION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
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

            {/* Provider Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableProviders.map((config) => {
                  const connected = isProviderConnected(config.provider);
                  return (
                    <button
                      key={config.provider}
                      onClick={() => !connected && handleProviderSelect(config.provider)}
                      disabled={connected}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        connected
                          ? 'bg-green-500/10 border-green-500/30 cursor-default'
                          : 'bg-gray-800/50 border-gray-700 hover:border-purple-500/50 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">{config.name}</h4>
                            {connected && (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {config.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {config.authMethod === 'oauth2' ? (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                OAuth
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
                                API Key
                              </span>
                            )}
                            {config.supportsBrowserAccess && (
                              <Globe className="w-3 h-3 text-gray-500" title="Browser access supported" />
                            )}
                          </div>
                        </div>
                        {!connected && (
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider-specific connect modal */}
      {selectedProvider && renderConnectModal()}

      {/* Empty State */}
      {!isLoading && integrations.length === 0 && (
        <div className="text-center py-12 bg-gray-800/30 border border-gray-800 rounded-2xl">
          <Key className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No integrations yet</h3>
          <p className="text-gray-400 mb-6">
            Connect services to enable powerful agent automation
          </p>
          <button
            onClick={() => setShowConnectModal(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
          >
            Add Your First Integration
          </button>
        </div>
      )}
    </div>
  );
}
