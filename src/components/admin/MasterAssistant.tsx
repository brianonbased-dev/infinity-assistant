'use client';

/**
 * Master Infinity Assistant - Admin Control Center
 *
 * A powerful admin tool for:
 * - Managing InfinityAssistant settings and configuration
 * - Knowledge base management (CRUD, graduation, sync)
 * - Master mesh connectivity with full RPC access
 * - MCP server management
 * - System diagnostics and fixes
 *
 * NOT a chat interface - this is an ADMIN CONTROL PANEL.
 *
 * @since 2025-12-02
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Network,
  Terminal,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Server,
  Shield,
  BookOpen,
  Wrench,
  Upload,
  Trash2,
  Play,
  Search,
  Eye,
  Activity,
  Cpu,
  Cloud,
  PlugZap,
  Database,
  Users,
  Flower2,
  Brain,
  Lightbulb,
  Target,
  Radio,
  Zap,
  Crown,
  Bot,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface MeshNode {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'degraded';
  url: string;
  capabilities: string[];
  level: 'master' | 'service' | 'user';
  latencyMs?: number;
}

interface RpcAction {
  action: string;
  domain: string;
  requiredLevel: string;
  description?: string;
}

interface KnowledgeEntry {
  id: string;
  type: 'wisdom' | 'pattern' | 'gotcha';
  title: string;
  domain: string;
  confidence: number;
  updatedAt: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'error';
  uptime: number;
  memory: { used: number; total: number };
  services: {
    name: string;
    status: 'ok' | 'warn' | 'error';
    message?: string;
  }[];
}

interface MasterAssistantProps {
  userId: string;
}

interface LotusAgent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'busy' | 'offline';
  currentTask?: string;
  completedTasks: number;
  lastActivity: string;
}

type TabId = 'overview' | 'settings' | 'knowledge' | 'agents' | 'rpc' | 'mesh';

// ============================================================================
// COMPONENT
// ============================================================================

export function MasterAssistant({ userId }: MasterAssistantProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // System state
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [meshNodes, setMeshNodes] = useState<MeshNode[]>([]);
  const [rpcActions, setRpcActions] = useState<RpcAction[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [lotusAgents, setLotusAgents] = useState<LotusAgent[]>([]);

  // Mesh registration state - admin becomes a support node
  const [meshRegistered, setMeshRegistered] = useState(false);
  const [meshNodeId, setMeshNodeId] = useState<string | null>(null);
  const [heartbeatActive, setHeartbeatActive] = useState(false);

  // Broadcast message
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // RPC Console
  const [rpcCommand, setRpcCommand] = useState('');
  const [rpcResult, setRpcResult] = useState<string | null>(null);
  const [rpcHistory, setRpcHistory] = useState<{ cmd: string; result: string; success: boolean }[]>([]);

  // Knowledge filters
  const [knowledgeFilter, setKnowledgeFilter] = useState({ type: 'all', domain: '', search: '' });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchSystemHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setSystemHealth({
          status: data.status === 'ok' ? 'healthy' : 'degraded',
          uptime: data.uptime || 0,
          memory: data.memory || { used: 0, total: 0 },
          services: data.services || [],
        });
      }
    } catch (err) {
      console.error('[MasterAssistant] Health check failed:', err);
    }
  }, []);

  const fetchMeshNodes = useCallback(async () => {
    try {
      const response = await fetch('/api/mesh/stats');
      if (response.ok) {
        const data = await response.json();
        setMeshNodes(data.nodes || []);
      }
    } catch (err) {
      console.error('[MasterAssistant] Mesh fetch failed:', err);
    }
  }, []);

  const fetchRpcActions = useCallback(async () => {
    try {
      const response = await fetch('/api/mesh/rpc');
      if (response.ok) {
        const data = await response.json();
        setRpcActions(data.data?.actions || []);
      }
    } catch (err) {
      console.error('[MasterAssistant] RPC actions fetch failed:', err);
    }
  }, []);

  const fetchKnowledge = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (knowledgeFilter.type !== 'all') params.set('type', knowledgeFilter.type);
      if (knowledgeFilter.domain) params.set('domain', knowledgeFilter.domain);
      if (knowledgeFilter.search) params.set('q', knowledgeFilter.search);

      const response = await fetch(`/api/knowledge?${params}`);
      if (response.ok) {
        const data = await response.json();
        setKnowledgeEntries(data.entries || []);
      }
    } catch (err) {
      console.error('[MasterAssistant] Knowledge fetch failed:', err);
    }
  }, [knowledgeFilter]);

  const fetchLotusAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/mesh/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'agent.lotus.list' }),
      });
      if (response.ok) {
        const data = await response.json();
        setLotusAgents(data.data?.agents || []);
      }
    } catch (err) {
      console.error('[MasterAssistant] Lotus agents fetch failed:', err);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchSystemHealth();
    fetchMeshNodes();
    const interval = setInterval(() => {
      fetchSystemHealth();
      fetchMeshNodes();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemHealth, fetchMeshNodes]);

  // Tab-specific data
  useEffect(() => {
    if (activeTab === 'rpc') fetchRpcActions();
    if (activeTab === 'knowledge') fetchKnowledge();
    if (activeTab === 'agents') fetchLotusAgents();
  }, [activeTab, fetchRpcActions, fetchKnowledge, fetchLotusAgents]);

  // ============================================================================
  // RPC EXECUTION
  // ============================================================================

  const executeRpc = useCallback(async (action: string, params?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mesh/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      });

      const data = await response.json();
      const result = JSON.stringify(data, null, 2);

      setRpcResult(result);
      setRpcHistory(prev => [
        { cmd: action, result, success: data.success },
        ...prev.slice(0, 19),
      ]);

      return data;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'RPC failed';
      setError(errMsg);
      setRpcResult(JSON.stringify({ error: errMsg }, null, 2));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRpcSubmit = useCallback(() => {
    if (!rpcCommand.trim()) return;

    // Parse command: "action.name param1=value1 param2=value2"
    const parts = rpcCommand.trim().split(' ');
    const action = parts[0];
    const params: Record<string, unknown> = {};

    for (let i = 1; i < parts.length; i++) {
      const [key, value] = parts[i].split('=');
      if (key && value) {
        // Try to parse as JSON, otherwise use string
        try {
          params[key] = JSON.parse(value);
        } catch {
          params[key] = value;
        }
      }
    }

    executeRpc(action, Object.keys(params).length > 0 ? params : undefined);
    setRpcCommand('');
  }, [rpcCommand, executeRpc]);

  // ============================================================================
  // ADMIN ACTIONS
  // ============================================================================

  const syncKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      await executeRpc('knowledge.sync');
      await fetchKnowledge();
    } finally {
      setLoading(false);
    }
  }, [executeRpc, fetchKnowledge]);

  const graduateKnowledge = useCallback(async (entryId: string) => {
    await executeRpc('knowledge.graduate', { entryId });
    await fetchKnowledge();
  }, [executeRpc, fetchKnowledge]);

  const deleteKnowledge = useCallback(async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge entry?')) return;
    await executeRpc('knowledge.delete', { entryId });
    await fetchKnowledge();
  }, [executeRpc, fetchKnowledge]);

  const refreshMesh = useCallback(async () => {
    setLoading(true);
    try {
      await executeRpc('mesh.refresh');
      await fetchMeshNodes();
    } finally {
      setLoading(false);
    }
  }, [executeRpc, fetchMeshNodes]);

  const repairSettings = useCallback(async () => {
    setLoading(true);
    try {
      await executeRpc('system.repair-settings');
      await fetchSystemHealth();
    } finally {
      setLoading(false);
    }
  }, [executeRpc, fetchSystemHealth]);

  // ============================================================================
  // AGENT ORCHESTRATION (Lotus Flower)
  // ============================================================================

  const activateAgent = useCallback(async (agentId: string) => {
    await executeRpc('agent.lotus.activate', { agentId });
    await fetchLotusAgents();
  }, [executeRpc, fetchLotusAgents]);

  const deactivateAgent = useCallback(async (agentId: string) => {
    await executeRpc('agent.lotus.deactivate', { agentId });
    await fetchLotusAgents();
  }, [executeRpc, fetchLotusAgents]);

  const assignTask = useCallback(async (agentId: string, task: string) => {
    await executeRpc('agent.lotus.assign', { agentId, task });
    await fetchLotusAgents();
  }, [executeRpc, fetchLotusAgents]);

  const broadcastToMesh = useCallback(async () => {
    if (!broadcastMessage.trim()) return;
    setLoading(true);
    try {
      await executeRpc('mesh.broadcast', {
        message: broadcastMessage,
        from: meshNodeId || userId,
        level: 'master',
      });
      setBroadcastMessage('');
    } finally {
      setLoading(false);
    }
  }, [broadcastMessage, executeRpc, meshNodeId, userId]);

  // ============================================================================
  // MESH REGISTRATION - Admin becomes a support node
  // ============================================================================

  const registerAsMeshSupport = useCallback(async () => {
    setLoading(true);
    try {
      const nodeId = `admin-support-${userId}-${Date.now()}`;

      const response = await fetch('/api/mesh/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          nodeType: 'admin-support',
          level: 'master',
          userId,
          capabilities: [
            'admin-support',
            'knowledge-management',
            'settings-repair',
            'diagnostics',
            'mesh-monitoring',
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMeshNodeId(data.nodeId || nodeId);
        setMeshRegistered(true);
        setHeartbeatActive(true);
        console.log('[MasterAssistant] Registered as mesh support node:', nodeId);
      } else {
        throw new Error('Failed to register with mesh');
      }
    } catch (err) {
      console.error('[MasterAssistant] Mesh registration failed:', err);
      setError('Failed to register as mesh support node');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const unregisterFromMesh = useCallback(async () => {
    if (!meshNodeId) return;

    setLoading(true);
    try {
      await fetch('/api/mesh/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: meshNodeId }),
      });

      setMeshRegistered(false);
      setMeshNodeId(null);
      setHeartbeatActive(false);
      console.log('[MasterAssistant] Unregistered from mesh');
    } catch (err) {
      console.error('[MasterAssistant] Mesh unregistration failed:', err);
    } finally {
      setLoading(false);
    }
  }, [meshNodeId]);

  // Auto-register on mount, unregister on unmount
  useEffect(() => {
    registerAsMeshSupport();

    return () => {
      // Cleanup: unregister when component unmounts
      if (meshNodeId) {
        fetch('/api/mesh/register', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: meshNodeId }),
        }).catch(console.error);
      }
    };
  }, [registerAsMeshSupport, meshNodeId]);

  // Send heartbeat every 30 seconds while registered
  useEffect(() => {
    if (!meshRegistered || !meshNodeId) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/mesh/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: meshNodeId }),
        });
      } catch (err) {
        console.warn('[MasterAssistant] Heartbeat failed:', err);
        setHeartbeatActive(false);
      }
    };

    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [meshRegistered, meshNodeId]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const StatusBadge = ({ status }: { status: 'ok' | 'warn' | 'error' | 'online' | 'offline' | 'degraded' | 'healthy' }) => {
    const colors = {
      ok: 'bg-green-500/20 text-green-400 border-green-500/30',
      healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
      online: 'bg-green-500/20 text-green-400 border-green-500/30',
      warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      offline: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded border ${colors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'knowledge', label: 'Knowledge', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'agents', label: 'Agents', icon: <Flower2 className="w-4 h-4" /> },
    { id: 'rpc', label: 'RPC Console', icon: <Terminal className="w-4 h-4" /> },
    { id: 'mesh', label: 'Mesh Network', icon: <Network className="w-4 h-4" /> },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              Master Control Center
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">ADMIN</span>
            </h1>
            <p className="text-xs text-gray-400">UAA2 Master Portal Connection</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mesh Support Node Status */}
          <div className="flex items-center gap-2">
            {meshRegistered ? (
              <button
                type="button"
                onClick={unregisterFromMesh}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 border border-green-500/30 rounded-lg hover:bg-green-600/30 transition-colors"
                title={`Connected as support node: ${meshNodeId}`}
              >
                <span className={`w-2 h-2 rounded-full ${heartbeatActive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                <span className="text-xs text-green-400">Mesh Support Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={registerAsMeshSupport}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
                title="Connect as mesh support node"
              >
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-400">Connect to Mesh</span>
              </button>
            )}
          </div>

          {systemHealth && <StatusBadge status={systemHealth.status} />}
          <button
            type="button"
            onClick={() => { fetchSystemHealth(); fetchMeshNodes(); }}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Server className="w-4 h-4" />
                  <span className="text-sm">Mesh Nodes</span>
                </div>
                <p className="text-2xl font-semibold">
                  {meshNodes.filter(n => n.status === 'online').length}/{meshNodes.length}
                </p>
              </div>

              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Database className="w-4 h-4" />
                  <span className="text-sm">Knowledge</span>
                </div>
                <p className="text-2xl font-semibold">{knowledgeEntries.length}</p>
              </div>

              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Cpu className="w-4 h-4" />
                  <span className="text-sm">Memory</span>
                </div>
                <p className="text-2xl font-semibold">
                  {systemHealth ? `${Math.round(systemHealth.memory.used / 1024 / 1024)}MB` : '--'}
                </p>
              </div>

              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Cloud className="w-4 h-4" />
                  <span className="text-sm">MCP Status</span>
                </div>
                <p className="text-2xl font-semibold text-green-400">Active</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={syncKnowledge}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync Knowledge
                </button>
                <button
                  onClick={refreshMesh}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50"
                >
                  <Network className="w-4 h-4" />
                  Refresh Mesh
                </button>
                <button
                  onClick={repairSettings}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm disabled:opacity-50"
                >
                  <Wrench className="w-4 h-4" />
                  Repair Settings
                </button>
                <button
                  onClick={() => executeRpc('system.health')}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm disabled:opacity-50"
                >
                  <Activity className="w-4 h-4" />
                  Run Diagnostics
                </button>
              </div>
            </div>

            {/* Services Status */}
            {systemHealth && systemHealth.services.length > 0 && (
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Services</h3>
                <div className="space-y-2">
                  {systemHealth.services.map((service, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <span className="text-sm text-gray-300">{service.name}</span>
                      <div className="flex items-center gap-2">
                        {service.message && (
                          <span className="text-xs text-gray-500">{service.message}</span>
                        )}
                        <StatusBadge status={service.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3">InfinityAssistant Configuration</h3>
              <div className="space-y-3">
                <button
                  onClick={() => executeRpc('config.get', { scope: 'all' })}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">View All Settings</span>
                  </div>
                  <span className="text-xs text-gray-500">config.get</span>
                </button>

                <button
                  onClick={() => executeRpc('config.validate')}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm">Validate Configuration</span>
                  </div>
                  <span className="text-xs text-gray-500">config.validate</span>
                </button>

                <button
                  onClick={repairSettings}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Wrench className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm">Auto-Repair Settings</span>
                  </div>
                  <span className="text-xs text-gray-500">system.repair-settings</span>
                </button>

                <button
                  onClick={() => executeRpc('config.reset', { confirm: true })}
                  className="w-full flex items-center justify-between p-3 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors border border-red-800"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-300">Reset to Defaults</span>
                  </div>
                  <span className="text-xs text-red-500">config.reset</span>
                </button>
              </div>
            </div>

            {/* MCP Configuration */}
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <PlugZap className="w-4 h-4 text-purple-400" />
                MCP Server Configuration
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => executeRpc('mcp.list')}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span className="text-sm">List MCP Servers</span>
                  <span className="text-xs text-gray-500">mcp.list</span>
                </button>
                <button
                  onClick={() => executeRpc('mcp.status')}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span className="text-sm">Check MCP Status</span>
                  <span className="text-xs text-gray-500">mcp.status</span>
                </button>
                <button
                  onClick={() => executeRpc('mcp.reconnect')}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span className="text-sm">Reconnect All</span>
                  <span className="text-xs text-gray-500">mcp.reconnect</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Knowledge Tab */}
        {activeTab === 'knowledge' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={knowledgeFilter.type}
                onChange={(e) => setKnowledgeFilter(f => ({ ...f, type: e.target.value }))}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              >
                <option value="all">All Types</option>
                <option value="wisdom">Wisdom</option>
                <option value="pattern">Patterns</option>
                <option value="gotcha">Gotchas</option>
              </select>

              <input
                type="text"
                placeholder="Filter by domain..."
                value={knowledgeFilter.domain}
                onChange={(e) => setKnowledgeFilter(f => ({ ...f, domain: e.target.value }))}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm flex-1 min-w-[200px]"
              />

              <button
                onClick={fetchKnowledge}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                onClick={syncKnowledge}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>

            {/* Knowledge List */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="grid grid-cols-[1fr,auto,auto,auto] gap-4 p-3 bg-gray-800/50 text-xs font-medium text-gray-400 uppercase">
                <span>Entry</span>
                <span>Type</span>
                <span>Confidence</span>
                <span>Actions</span>
              </div>

              <div className="divide-y divide-gray-800">
                {knowledgeEntries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No knowledge entries found
                  </div>
                ) : (
                  knowledgeEntries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[1fr,auto,auto,auto] gap-4 p-3 items-center hover:bg-gray-800/30">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{entry.title}</p>
                        <p className="text-xs text-gray-500">{entry.domain}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        entry.type === 'wisdom' ? 'bg-blue-500/20 text-blue-400' :
                        entry.type === 'pattern' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {entry.type}
                      </span>
                      <span className="text-sm text-gray-400">{Math.round(entry.confidence * 100)}%</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => executeRpc('knowledge.get', { id: entry.id })}
                          className="p-1.5 hover:bg-gray-700 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => graduateKnowledge(entry.id)}
                          className="p-1.5 hover:bg-gray-700 rounded"
                          title="Graduate"
                        >
                          <Upload className="w-4 h-4 text-green-400" />
                        </button>
                        <button
                          onClick={() => deleteKnowledge(entry.id)}
                          className="p-1.5 hover:bg-gray-700 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab - Lotus Flower Orchestration */}
        {activeTab === 'agents' && (
          <div className="space-y-4">
            {/* Broadcast to Mesh */}
            <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-400" />
                Master Broadcast
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && broadcastToMesh()}
                  placeholder="Broadcast message to all mesh nodes..."
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={broadcastToMesh}
                  disabled={loading || !broadcastMessage.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Broadcast
                </button>
              </div>
            </div>

            {/* Quick Agent Actions */}
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Flower2 className="w-4 h-4 text-pink-400" />
                Lotus Flower Orchestration
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => executeRpc('agent.lotus.overview')}
                  className="flex items-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-500 rounded text-sm"
                >
                  <Eye className="w-4 h-4" />
                  View Overview
                </button>
                <button
                  onClick={() => executeRpc('agent.lotus.spawn', { type: 'researcher' })}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"
                >
                  <Brain className="w-4 h-4" />
                  Spawn Researcher
                </button>
                <button
                  onClick={() => executeRpc('agent.lotus.spawn', { type: 'builder' })}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm"
                >
                  <Wrench className="w-4 h-4" />
                  Spawn Builder
                </button>
                <button
                  onClick={() => executeRpc('agent.lotus.spawn', { type: 'analyst' })}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm"
                >
                  <Lightbulb className="w-4 h-4" />
                  Spawn Analyst
                </button>
                <button
                  onClick={() => executeRpc('agent.lotus.cycle')}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Run Cycle
                </button>
              </div>
            </div>

            {/* Agent List */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-400" />
                  Active Agents ({lotusAgents.length})
                </h3>
                <button
                  type="button"
                  onClick={fetchLotusAgents}
                  disabled={loading}
                  className="p-1.5 hover:bg-gray-800 rounded"
                  title="Refresh agents"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="divide-y divide-gray-800">
                {lotusAgents.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Flower2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No active agents</p>
                    <p className="text-xs mt-1">Use Lotus Flower Orchestration to spawn agents</p>
                  </div>
                ) : (
                  lotusAgents.map((agent) => (
                    <div key={agent.id} className="p-4 hover:bg-gray-800/30">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            agent.role === 'researcher' ? 'bg-blue-500/20' :
                            agent.role === 'builder' ? 'bg-green-500/20' :
                            agent.role === 'analyst' ? 'bg-yellow-500/20' :
                            'bg-purple-500/20'
                          }`}>
                            {agent.role === 'researcher' ? <Brain className="w-5 h-5 text-blue-400" /> :
                             agent.role === 'builder' ? <Wrench className="w-5 h-5 text-green-400" /> :
                             agent.role === 'analyst' ? <Lightbulb className="w-5 h-5 text-yellow-400" /> :
                             <Bot className="w-5 h-5 text-purple-400" />}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-200">{agent.name}</h4>
                            <p className="text-xs text-gray-500">{agent.role}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          agent.status === 'busy' ? 'bg-yellow-500/20 text-yellow-400' :
                          agent.status === 'idle' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {agent.status.toUpperCase()}
                        </span>
                      </div>

                      {agent.currentTask && (
                        <div className="mb-2 p-2 bg-gray-800 rounded text-xs">
                          <span className="text-gray-400">Current: </span>
                          <span className="text-gray-200">{agent.currentTask}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{agent.completedTasks} tasks completed</span>
                        <span>Last active: {agent.lastActivity}</span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {agent.status === 'idle' ? (
                          <button
                            type="button"
                            onClick={() => activateAgent(agent.id)}
                            className="text-xs text-green-400 hover:text-green-300"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deactivateAgent(agent.id)}
                            className="text-xs text-yellow-400 hover:text-yellow-300"
                          >
                            Pause
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const task = prompt('Enter task for agent:');
                            if (task) assignTask(agent.id, task);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Assign Task
                        </button>
                        <button
                          type="button"
                          onClick={() => executeRpc('agent.lotus.info', { agentId: agent.id })}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Admin Privileges Banner */}
            <div className="p-4 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-lg border border-yellow-800/50">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-yellow-400" />
                <div>
                  <h3 className="font-medium text-yellow-300">Admin Master Access</h3>
                  <p className="text-xs text-yellow-400/70">All InfinityAssistant features are unlimited for admin users. No tier restrictions apply.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RPC Console Tab */}
        {activeTab === 'rpc' && (
          <div className="space-y-4">
            {/* Command Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={rpcCommand}
                onChange={(e) => setRpcCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRpcSubmit()}
                placeholder="system.health or mesh.status nodeId=uaa2-service"
                className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleRpcSubmit}
                disabled={loading || !rpcCommand.trim()}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {['system.health', 'system.info', 'mesh.status', 'agent.lotus.overview', 'analytics.stats'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => { setRpcCommand(cmd); executeRpc(cmd); }}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Result */}
            {rpcResult && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
                  Response
                </div>
                <pre className="p-4 text-sm font-mono overflow-x-auto text-green-400 max-h-[400px] overflow-y-auto">
                  {rpcResult}
                </pre>
              </div>
            )}

            {/* Available Actions */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-medium">Available RPC Actions ({rpcActions.length})</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-800">
                {rpcActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setRpcCommand(action.action)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-purple-400">{action.action}</span>
                      <span className="text-xs text-gray-500">{action.requiredLevel}</span>
                    </div>
                    {action.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mesh Tab */}
        {activeTab === 'mesh' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-300">Master Mesh Network</h3>
              <button
                onClick={refreshMesh}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {meshNodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-4 bg-gray-900 rounded-lg border ${
                    node.status === 'online' ? 'border-green-800' :
                    node.status === 'degraded' ? 'border-yellow-800' :
                    'border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        {node.name}
                      </h4>
                      <p className="text-xs text-gray-500 font-mono">{node.url}</p>
                    </div>
                    <StatusBadge status={node.status} />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      node.level === 'master' ? 'bg-purple-500/20 text-purple-400' :
                      node.level === 'service' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {node.level.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{node.type}</span>
                    {node.latencyMs && (
                      <span className="text-xs text-gray-500">{node.latencyMs}ms</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {node.capabilities.slice(0, 5).map((cap) => (
                      <span key={cap} className="px-2 py-0.5 text-xs bg-gray-800 rounded">
                        {cap}
                      </span>
                    ))}
                    {node.capabilities.length > 5 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-800 rounded">
                        +{node.capabilities.length - 5}
                      </span>
                    )}
                  </div>

                  {node.status === 'online' && (
                    <div className="mt-3 pt-3 border-t border-gray-800 flex gap-2">
                      <button
                        onClick={() => executeRpc('mesh.ping', { nodeId: node.id })}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        Ping
                      </button>
                      <button
                        onClick={() => executeRpc('mesh.node.info', { nodeId: node.id })}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Info
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterAssistant;
