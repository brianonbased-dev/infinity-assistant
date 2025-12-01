/**
 * User Mesh Service
 *
 * Enables every InfinityAssistant user to connect to the mesh network.
 * Each user gets their own mesh node registration and API key.
 *
 * Features:
 * - Per-user mesh node registration
 * - User API key generation and management
 * - Cross-user mesh communication
 * - User workspace sync with mesh
 */

import logger from '@/utils/logger';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import { meshNodeClient } from './MeshNodeClient';
import crypto from 'crypto';

// ============ TYPES ============

export interface UserMeshNode {
  userId: string;
  nodeId: string;
  nodeName: string;
  apiKey: string;
  apiKeyPreview: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'suspended';
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  lastActiveAt: Date;
  settings: UserMeshSettings;
}

export interface UserMeshSettings {
  allowRemoteAccess: boolean;
  shareKnowledge: boolean;
  syncWorkspace: boolean;
  notifyOnMeshEvents: boolean;
  preferredLLM: 'ollama' | 'cloud' | 'auto';
  meshVisibility: 'private' | 'friends' | 'public';
}

export interface MeshConnection {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'blocked';
  connectedAt?: Date;
}

export interface UserMeshStats {
  totalUsers: number;
  activeNodes: number;
  messagesExchanged: number;
  knowledgeShared: number;
}

// ============ DEFAULT SETTINGS ============

const DEFAULT_MESH_SETTINGS: UserMeshSettings = {
  allowRemoteAccess: false,
  shareKnowledge: false,
  syncWorkspace: true,
  notifyOnMeshEvents: true,
  preferredLLM: 'auto',
  meshVisibility: 'private',
};

// ============ SERVICE CLASS ============

class UserMeshService {
  private static instance: UserMeshService | null = null;

  private constructor() {
    logger.info('[UserMesh] Service initialized');
  }

  static getInstance(): UserMeshService {
    if (!UserMeshService.instance) {
      UserMeshService.instance = new UserMeshService();
    }
    return UserMeshService.instance;
  }

  // ============ USER NODE REGISTRATION ============

  /**
   * Register a user as a mesh node
   */
  async registerUserNode(
    userId: string,
    options?: Partial<UserMeshSettings>
  ): Promise<UserMeshNode> {
    const supabase = getSupabaseClient();

    // Check if user already has a node
    const existing = await this.getUserNode(userId);
    if (existing) {
      return existing;
    }

    // Generate unique node ID and API key
    const nodeId = `user-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
    const apiKey = this.generateApiKey();

    const userNode: UserMeshNode = {
      userId,
      nodeId,
      nodeName: `User Node (${userId.slice(0, 8)})`,
      apiKey,
      apiKeyPreview: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
      capabilities: this.getDefaultCapabilities(),
      status: 'active',
      tier: 'free',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      settings: { ...DEFAULT_MESH_SETTINGS, ...options },
    };

    // Store in database
    const { error } = await supabase.from('user_mesh_nodes').insert({
      user_id: userId,
      node_id: nodeId,
      node_name: userNode.nodeName,
      api_key_hash: this.hashApiKey(apiKey),
      api_key_preview: userNode.apiKeyPreview,
      capabilities: userNode.capabilities,
      status: userNode.status,
      tier: userNode.tier,
      settings: userNode.settings,
      created_at: userNode.createdAt.toISOString(),
      last_active_at: userNode.lastActiveAt.toISOString(),
    });

    if (error) {
      logger.error('[UserMesh] Failed to register node:', error);
      throw new Error('Failed to register mesh node');
    }

    // Register with main mesh network
    await this.syncNodeWithMesh(userNode);

    logger.info('[UserMesh] User registered as mesh node', { userId, nodeId });

    // Return with actual API key (only shown once)
    return userNode;
  }

  /**
   * Get user's mesh node
   */
  async getUserNode(userId: string): Promise<UserMeshNode | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_mesh_nodes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      userId: data.user_id,
      nodeId: data.node_id,
      nodeName: data.node_name,
      apiKey: '', // Never return actual key
      apiKeyPreview: data.api_key_preview,
      capabilities: data.capabilities,
      status: data.status,
      tier: data.tier,
      createdAt: new Date(data.created_at),
      lastActiveAt: new Date(data.last_active_at),
      settings: data.settings,
    };
  }

  /**
   * Update user mesh settings
   */
  async updateUserSettings(
    userId: string,
    settings: Partial<UserMeshSettings>
  ): Promise<UserMeshNode | null> {
    const supabase = getSupabaseClient();

    const existing = await this.getUserNode(userId);
    if (!existing) {
      return null;
    }

    const newSettings = { ...existing.settings, ...settings };

    const { error } = await supabase
      .from('user_mesh_nodes')
      .update({
        settings: newSettings,
        last_active_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('[UserMesh] Failed to update settings:', error);
      return null;
    }

    return { ...existing, settings: newSettings };
  }

  // ============ API KEY MANAGEMENT ============

  /**
   * Generate a new API key
   */
  private generateApiKey(): string {
    const prefix = 'ia_mesh_';
    const random = crypto.randomBytes(24).toString('hex');
    return `${prefix}${random}`;
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Validate API key and return user node
   */
  async validateApiKey(apiKey: string): Promise<UserMeshNode | null> {
    const supabase = getSupabaseClient();
    const keyHash = this.hashApiKey(apiKey);

    const { data, error } = await supabase
      .from('user_mesh_nodes')
      .select('*')
      .eq('api_key_hash', keyHash)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    // Update last active
    await supabase
      .from('user_mesh_nodes')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', data.user_id);

    return {
      userId: data.user_id,
      nodeId: data.node_id,
      nodeName: data.node_name,
      apiKey: '', // Never return
      apiKeyPreview: data.api_key_preview,
      capabilities: data.capabilities,
      status: data.status,
      tier: data.tier,
      createdAt: new Date(data.created_at),
      lastActiveAt: new Date(),
      settings: data.settings,
    };
  }

  /**
   * Regenerate API key for user
   */
  async regenerateApiKey(userId: string): Promise<string | null> {
    const supabase = getSupabaseClient();

    const existing = await this.getUserNode(userId);
    if (!existing) {
      return null;
    }

    const newApiKey = this.generateApiKey();
    const newPreview = `${newApiKey.slice(0, 8)}...${newApiKey.slice(-4)}`;

    const { error } = await supabase
      .from('user_mesh_nodes')
      .update({
        api_key_hash: this.hashApiKey(newApiKey),
        api_key_preview: newPreview,
        last_active_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('[UserMesh] Failed to regenerate API key:', error);
      return null;
    }

    logger.info('[UserMesh] API key regenerated', { userId });
    return newApiKey;
  }

  // ============ MESH CONNECTIONS ============

  /**
   * Connect to another user's mesh node
   */
  async requestConnection(
    fromUserId: string,
    toUserId: string
  ): Promise<MeshConnection | null> {
    const supabase = getSupabaseClient();

    // Check if target user allows connections
    const targetNode = await this.getUserNode(toUserId);
    if (!targetNode || targetNode.settings.meshVisibility === 'private') {
      return null;
    }

    const connection: MeshConnection = {
      id: `conn-${Date.now().toString(36)}`,
      fromUserId,
      toUserId,
      status: 'pending',
    };

    const { error } = await supabase.from('mesh_connections').insert({
      id: connection.id,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: connection.status,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('[UserMesh] Failed to create connection:', error);
      return null;
    }

    return connection;
  }

  /**
   * Accept a connection request
   */
  async acceptConnection(
    connectionId: string,
    userId: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('mesh_connections')
      .update({
        status: 'accepted',
        connected_at: new Date().toISOString(),
      })
      .eq('id', connectionId)
      .eq('to_user_id', userId);

    return !error;
  }

  /**
   * Get user's mesh connections
   */
  async getUserConnections(userId: string): Promise<MeshConnection[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('mesh_connections')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (error || !data) {
      return [];
    }

    return data.map((c) => ({
      id: c.id,
      fromUserId: c.from_user_id,
      toUserId: c.to_user_id,
      status: c.status,
      connectedAt: c.connected_at ? new Date(c.connected_at) : undefined,
    }));
  }

  // ============ MESH SYNC ============

  /**
   * Sync user node with main mesh network
   */
  private async syncNodeWithMesh(userNode: UserMeshNode): Promise<void> {
    try {
      const uaa2Url = process.env.UAA2_SERVICE_URL || 'https://uaa2-service-production.up.railway.app';

      await fetch(`${uaa2Url}/api/mesh/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'infinityassistant',
        },
        body: JSON.stringify({
          action: 'register-user-node',
          payload: {
            nodeId: userNode.nodeId,
            nodeName: userNode.nodeName,
            type: 'user',
            capabilities: userNode.capabilities,
            tier: userNode.tier,
            visibility: userNode.settings.meshVisibility,
          },
        }),
      });

      logger.debug('[UserMesh] Synced with main mesh', { nodeId: userNode.nodeId });
    } catch (error) {
      logger.warn('[UserMesh] Failed to sync with main mesh:', error);
    }
  }

  // ============ CAPABILITIES ============

  /**
   * Get default capabilities for user nodes
   */
  private getDefaultCapabilities(): string[] {
    return [
      'chat',
      'knowledge-access',
      'workspace-sync',
      'user-preferences',
    ];
  }

  /**
   * Get capabilities based on tier
   */
  getCapabilitiesByTier(tier: UserMeshNode['tier']): string[] {
    const base = this.getDefaultCapabilities();

    switch (tier) {
      case 'enterprise':
        return [
          ...base,
          'agent-orchestration',
          'custom-agents',
          'priority-routing',
          'dedicated-resources',
          'api-access',
          'white-label',
        ];
      case 'pro':
        return [
          ...base,
          'agent-orchestration',
          'custom-agents',
          'priority-routing',
          'api-access',
        ];
      case 'free':
      default:
        return base;
    }
  }

  // ============ STATS ============

  /**
   * Get mesh network stats
   */
  async getMeshStats(): Promise<UserMeshStats> {
    const supabase = getSupabaseClient();

    const { count: totalUsers } = await supabase
      .from('user_mesh_nodes')
      .select('*', { count: 'exact', head: true });

    const { count: activeNodes } = await supabase
      .from('user_mesh_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('last_active_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      totalUsers: totalUsers || 0,
      activeNodes: activeNodes || 0,
      messagesExchanged: 0, // TODO: Track this
      knowledgeShared: 0, // TODO: Track this
    };
  }
}

// ============ EXPORTS ============

let userMeshServiceInstance: UserMeshService | null = null;

export function getUserMeshService(): UserMeshService {
  if (!userMeshServiceInstance) {
    userMeshServiceInstance = UserMeshService.getInstance();
  }
  return userMeshServiceInstance;
}

export default UserMeshService;
