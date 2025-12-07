/**
 * Webhook Manager Component
 * 
 * Functional webhook management UI for dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Loader2, Check, Copy } from 'lucide-react';

interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
  failureCount: number;
}

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [newWebhook, setNewWebhook] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const availableEvents = [
    'chat.message',
    'chat.response',
    'knowledge.created',
    'memory.stored',
    'user.preferences.updated',
    'subscription.created',
    'subscription.updated',
    'subscription.cancelled'
  ];

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks');
      const data = await response.json();
      if (data.success) {
        setWebhooks(data.webhooks);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.trim() || selectedEvents.length === 0) return;

    setCreating(true);
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newWebhookUrl.trim(),
          events: selectedEvents
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewWebhook(data.webhook);
        setNewWebhookUrl('');
        setSelectedEvents([]);
        setShowCreateModal(false);
        await fetchWebhooks();
      } else {
        alert(data.error || 'Failed to create webhook');
      }
    } catch (error) {
      console.error('Failed to create webhook:', error);
      alert('Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/webhooks?id=${webhookId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await fetchWebhooks();
      } else {
        alert(data.error || 'Failed to delete webhook');
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook');
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
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
          <h2 className="text-2xl font-bold text-white">Webhooks</h2>
          <p className="text-sm text-gray-400 mt-1">
            Receive real-time events from Infinity Assistant
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Register Webhook
        </button>
      </div>

      {/* New Webhook Display (shown once after creation) */}
      {newWebhook && (
        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Webhook Registered</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            Save this secret now - it will not be shown again!
          </p>
          <div className="p-4 bg-gray-900 rounded-lg mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Secret:</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-gray-300 font-mono break-all">
                {newWebhook.secret}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newWebhook.secret);
                }}
                className="p-2 hover:bg-gray-800 rounded transition-colors"
                title="Copy secret"
              >
                <Copy className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setNewWebhook(null)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            I've saved my secret
          </button>
        </div>
      )}

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="p-8 bg-gray-800/50 rounded-xl border border-gray-700 text-center">
          <Webhook className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No webhooks registered</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm"
          >
            Register Your First Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map(webhook => (
            <div key={webhook.id} className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Webhook className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{webhook.url}</h4>
                    <p className="text-sm text-gray-400">
                      {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    webhook.isActive 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {webhook.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => deleteWebhook(webhook.id)}
                    className="p-2 hover:bg-red-500/20 rounded transition-colors text-red-400"
                    title="Delete webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Events:</p>
                  <div className="flex flex-wrap gap-2">
                    {webhook.events.map(event => (
                      <span
                        key={event}
                        className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                {webhook.lastTriggered && (
                  <p className="text-xs text-gray-500">
                    Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                  </p>
                )}
                {webhook.failureCount > 0 && (
                  <p className="text-xs text-yellow-400">
                    Failures: {webhook.failureCount}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Register Webhook</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://your-app.com/webhooks"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Events</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableEvents.map(event => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-300">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewWebhookUrl('');
                    setSelectedEvents([]);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createWebhook}
                  disabled={!newWebhookUrl.trim() || selectedEvents.length === 0 || creating}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </span>
                  ) : (
                    'Register Webhook'
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

