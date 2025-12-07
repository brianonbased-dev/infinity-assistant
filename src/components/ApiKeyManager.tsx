/**
 * API Key Manager Component
 * 
 * Functional API key management UI for dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Check, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

interface NewApiKey {
  id: string;
  name: string;
  key: string; // Only shown once
  prefix: string;
  createdAt: string;
}

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<NewApiKey | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      const data = await response.json();
      if (data.success) {
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() })
      });

      const data = await response.json();
      if (data.success) {
        setNewKey(data.apiKey);
        setNewKeyName('');
        setShowCreateModal(false);
        await fetchApiKeys();
      } else {
        alert(data.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await fetch(`/api/api-keys?id=${keyId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await fetchApiKeys();
      } else {
        alert(data.error || 'Failed to revoke API key');
      }
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      alert('Failed to revoke API key');
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
          <h2 className="text-2xl font-bold text-white">API Keys</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage your Infinity Assistant API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* New Key Display (shown once after creation) */}
      {newKey && (
        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">API Key Created</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            Save this key now - it will not be shown again!
          </p>
          <div className="p-4 bg-gray-900 rounded-lg mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Key Name:</span>
              <span className="text-sm text-white font-medium">{newKey.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-gray-300 font-mono break-all">
                {newKey.key}
              </code>
              <button
                onClick={() => copyToClipboard(newKey.key, 'new-key')}
                className="p-2 hover:bg-gray-800 rounded transition-colors"
                title="Copy key"
              >
                {copiedKeyId === 'new-key' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            I've saved my key
          </button>
        </div>
      )}

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="p-8 bg-gray-800/50 rounded-xl border border-gray-700 text-center">
          <Key className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No API keys yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm"
          >
            Create Your First API Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map(key => (
            <div key={key.id} className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Key className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{key.name}</h4>
                    <p className="text-sm text-gray-400">Created {new Date(key.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    key.isActive 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {key.isActive ? 'Active' : 'Revoked'}
                  </span>
                  {key.isActive && (
                    <button
                      onClick={() => revokeApiKey(key.id)}
                      className="p-2 hover:bg-red-500/20 rounded transition-colors text-red-400"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-900 rounded-lg">
                <code className="flex-1 text-sm text-gray-300 font-mono">
                  {key.prefix}...
                </code>
                <button
                  onClick={() => copyToClipboard(key.prefix, key.id)}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                  title="Copy prefix"
                >
                  {copiedKeyId === key.id ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              {key.lastUsed ? (
                <p className="text-xs text-gray-500 mt-2">
                  Last used: {new Date(key.lastUsed).toLocaleDateString()} at {new Date(key.lastUsed).toLocaleTimeString()}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Never used
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Create API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewKeyName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createApiKey}
                  disabled={!newKeyName.trim() || creating}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Key'
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

