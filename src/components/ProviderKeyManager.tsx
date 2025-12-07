/**
 * Provider Key Manager Component
 * 
 * Allows users to add their own LLM provider API keys (BYOK - Bring Your Own Key)
 */

'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Check, Trash2, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface ProviderKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral';
  name: string;
  maskedKey: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🤖', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google', icon: '🔍', placeholder: 'AIza...' },
  { id: 'cohere', name: 'Cohere', icon: '💬', placeholder: 'co-...' },
  { id: 'mistral', name: 'Mistral', icon: '🌊', placeholder: '...' },
];

export function ProviderKeyManager() {
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviderKeys();
  }, []);

  const fetchProviderKeys = async () => {
    try {
      const response = await fetch('/api/provider-keys');
      const data = await response.json();
      if (data.success) {
        setProviderKeys(data.providerKeys || []);
      }
    } catch (error) {
      console.error('Failed to fetch provider keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateApiKey = (provider: string, key: string): boolean => {
    if (!key.trim()) return false;

    switch (provider) {
      case 'openai':
        return key.startsWith('sk-');
      case 'anthropic':
        return key.startsWith('sk-ant-');
      case 'google':
        return key.startsWith('AIza');
      case 'cohere':
        return key.startsWith('co-');
      case 'mistral':
        return key.length > 20; // Basic validation
      default:
        return key.length > 10;
    }
  };

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return '***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  const addProviderKey = async () => {
    if (!selectedProvider || !keyName.trim() || !apiKey.trim()) {
      setError('All fields are required');
      return;
    }

    if (!validateApiKey(selectedProvider, apiKey)) {
      setError(`Invalid ${PROVIDERS.find(p => p.id === selectedProvider)?.name} API key format`);
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/provider-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          name: keyName.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowAddModal(false);
        setSelectedProvider('');
        setKeyName('');
        setApiKey('');
        setShowKey(false);
        await fetchProviderKeys();
      } else {
        // Show validation error if available
        const errorMsg = data.validationError 
          ? `Key validation failed: ${data.validationError}`
          : data.error || 'Failed to add provider key';
        setError(errorMsg);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to add provider key');
    } finally {
      setAdding(false);
    }
  };

  const deleteProviderKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this provider key?')) return;

    try {
      const response = await fetch(`/api/provider-keys?id=${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await fetchProviderKeys();
      } else {
        alert(data.error || 'Failed to delete provider key');
      }
    } catch (error) {
      console.error('Failed to delete provider key:', error);
      alert('Failed to delete provider key');
    }
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">LLM Provider Keys</h2>
          <p className="text-sm text-gray-400 mt-1">
            Add your own LLM provider API keys to use your own accounts (BYOK)
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Provider Key
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-1">Bring Your Own Key (BYOK)</p>
            <p>
              When you add your own LLM provider keys, Infinity Assistant will use your keys instead of charging you for LLM usage.
              You'll only pay for the Infinity Assistant service itself.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Keys List */}
      {providerKeys.length === 0 ? (
        <div className="p-8 bg-gray-800/50 rounded-xl border border-gray-700 text-center">
          <Key className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No provider keys added</p>
          <p className="text-sm text-gray-500 mb-4">
            Add your own LLM provider keys to use your own accounts
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm"
          >
            Add Your First Provider Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providerKeys.map(key => {
            const provider = PROVIDERS.find(p => p.id === key.provider);
            return (
              <div key={key.id} className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl">
                      {provider?.icon || '🔑'}
                    </div>
                    <div>
                      <h4 className="font-medium text-white">
                        {provider?.name || key.provider} - {key.name}
                      </h4>
                      <p className="text-sm text-gray-400">
                        Added {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      key.isActive 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => deleteProviderKey(key.id)}
                      className="p-2 hover:bg-red-500/20 rounded transition-colors text-red-400"
                      title="Delete key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-900 rounded-lg">
                  <code className="flex-1 text-sm text-gray-300 font-mono">
                    {key.maskedKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(key.maskedKey, key.id)}
                    className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                    title="Copy masked key"
                  >
                    {copiedKeyId === key.id ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {key.lastUsed && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last used: {new Date(key.lastUsed).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Add Provider Key</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setApiKey('');
                    setError(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select a provider</option>
                  {PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.icon} {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Key Name</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production OpenAI Key"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setError(null);
                    }}
                    placeholder={selectedProvider ? PROVIDERS.find(p => p.id === selectedProvider)?.placeholder : 'Enter API key'}
                    className="w-full px-4 py-2 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-700 rounded transition-colors"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {selectedProvider && (
                  <p className="text-xs text-gray-500 mt-1">
                    Format: {PROVIDERS.find(p => p.id === selectedProvider)?.placeholder}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedProvider('');
                    setKeyName('');
                    setApiKey('');
                    setShowKey(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addProviderKey}
                  disabled={!selectedProvider || !keyName.trim() || !apiKey.trim() || adding}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </span>
                  ) : (
                    'Add Key'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

