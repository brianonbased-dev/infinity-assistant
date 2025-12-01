/**
 * IDE Extension Bridge Service
 *
 * Handles communication between Infinity Builder IDE extensions
 * (VS Code, JetBrains, etc.) and the orchestration backend.
 *
 * Features:
 * - WebSocket/SSE real-time communication
 * - Session state synchronization
 * - Tool execution forwarding
 * - Phase progress broadcasting
 *
 * @since 2025-12-01
 */

// Types
type AgentPhase =
  | 'INTAKE'
  | 'REFLECT'
  | 'EXECUTE'
  | 'COMPRESS'
  | 'GROW'
  | 'RE-INTAKE'
  | 'EVOLVE'
  | 'AUTONOMIZE';

type AgentMindset =
  | 'builder'
  | 'developer'
  | 'researcher'
  | 'architect'
  | 'optimizer'
  | 'security'
  | 'creative'
  | 'deployer'
  | 'orchestrator';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface IDEInfo {
  type: 'vscode' | 'jetbrains' | 'vim' | 'neovim' | 'other';
  version: string;
  extensionVersion: string;
  workspacePath: string;
  platform: 'windows' | 'macos' | 'linux';
}

interface BridgeMessage {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  sessionId?: string;
}

type MessageType =
  // Session
  | 'session:create'
  | 'session:join'
  | 'session:leave'
  | 'session:state'
  // Phase
  | 'phase:update'
  | 'phase:complete'
  | 'phase:error'
  // Todo
  | 'todo:add'
  | 'todo:update'
  | 'todo:complete'
  | 'todo:list'
  // Tool
  | 'tool:execute'
  | 'tool:result'
  | 'tool:error'
  // Agent
  | 'agent:spawn'
  | 'agent:message'
  | 'agent:mindset'
  // UI
  | 'ui:showOverlay'
  | 'ui:hideOverlay'
  | 'ui:notification'
  // Sync
  | 'sync:request'
  | 'sync:response'
  | 'ping'
  | 'pong';

interface SessionState {
  sessionId: string;
  workspaceId: string;
  workspaceType: string;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error';
  currentPhase: AgentPhase;
  currentCycle: number;
  activeAgent: AgentMindset;
  todos: any[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    progress: number;
  };
}

interface ToolExecutionRequest {
  toolId: string;
  toolName: string;
  parameters: Record<string, any>;
  timeout?: number;
}

interface ToolExecutionResult {
  toolId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

type MessageHandler = (message: BridgeMessage) => void | Promise<void>;

/**
 * IDE Extension Bridge
 *
 * Singleton service for managing IDE extension communication.
 */
class IDEExtensionBridgeService {
  private static instance: IDEExtensionBridgeService;

  private connection: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private status: ConnectionStatus = 'disconnected';
  private messageHandlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private ideInfo: IDEInfo | null = null;
  private sessionState: SessionState | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPong: number = 0;

  private constructor() {
    // Initialize default handlers
    this.setupDefaultHandlers();
  }

  static getInstance(): IDEExtensionBridgeService {
    if (!IDEExtensionBridgeService.instance) {
      IDEExtensionBridgeService.instance = new IDEExtensionBridgeService();
    }
    return IDEExtensionBridgeService.instance;
  }

  /**
   * Connect to the orchestration backend
   */
  async connect(options: {
    endpoint: string;
    ideInfo: IDEInfo;
    useSSE?: boolean;
    authToken?: string;
  }): Promise<void> {
    this.ideInfo = options.ideInfo;
    this.status = 'connecting';

    if (options.useSSE) {
      await this.connectSSE(options.endpoint, options.authToken);
    } else {
      await this.connectWebSocket(options.endpoint, options.authToken);
    }
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(endpoint: string, authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsEndpoint = endpoint.replace(/^http/, 'ws');
        const url = new URL(wsEndpoint);
        if (authToken) {
          url.searchParams.set('token', authToken);
        }

        this.connection = new WebSocket(url.toString());

        this.connection.onopen = () => {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.emit('connection:established', { ideInfo: this.ideInfo });
          resolve();
        };

        this.connection.onmessage = (event) => {
          try {
            const message: BridgeMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[IDEBridge] Failed to parse message:', error);
          }
        };

        this.connection.onerror = (error) => {
          this.status = 'error';
          this.emit('connection:error', { error });
          reject(error);
        };

        this.connection.onclose = () => {
          this.status = 'disconnected';
          this.stopPingInterval();
          this.emit('connection:closed', {});
          this.attemptReconnect(endpoint, authToken);
        };
      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });
  }

  /**
   * Connect via Server-Sent Events (SSE)
   */
  private async connectSSE(endpoint: string, authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(`${endpoint}/events`);
        if (authToken) {
          url.searchParams.set('token', authToken);
        }

        this.eventSource = new EventSource(url.toString());

        this.eventSource.onopen = () => {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.emit('connection:established', { ideInfo: this.ideInfo });
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message: BridgeMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[IDEBridge] Failed to parse SSE message:', error);
          }
        };

        this.eventSource.onerror = () => {
          this.status = 'error';
          reject(new Error('SSE connection failed'));
        };
      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the backend
   */
  disconnect(): void {
    this.stopPingInterval();

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.status = 'disconnected';
    this.sessionState = null;
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(endpoint: string, authToken?: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('connection:failed', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connectWebSocket(endpoint, authToken).catch(() => {
        // Reconnect failed, will try again
      });
    }, delay);
  }

  /**
   * Send a message to the backend
   */
  send(type: MessageType, payload: any, expectResponse = false): Promise<any> {
    const message: BridgeMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
      sessionId: this.sessionState?.sessionId,
    };

    if (expectResponse) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(message.id);
          reject(new Error('Request timeout'));
        }, 30000);

        this.pendingRequests.set(message.id, { resolve, reject, timeout });
        this.sendMessage(message);
      });
    }

    this.sendMessage(message);
    return Promise.resolve();
  }

  /**
   * Send raw message
   */
  private sendMessage(message: BridgeMessage): void {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(message));
    } else {
      console.warn('[IDEBridge] Cannot send message - not connected');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: BridgeMessage): void {
    // Check if this is a response to a pending request
    if (this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.type.includes('error')) {
        pending.reject(message.payload);
      } else {
        pending.resolve(message.payload);
      }
      return;
    }

    // Handle pong
    if (message.type === 'pong') {
      this.lastPong = Date.now();
      return;
    }

    // Update session state
    if (message.type === 'session:state') {
      this.sessionState = message.payload;
    }

    // Dispatch to handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`[IDEBridge] Handler error for ${message.type}:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to message type
   */
  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Emit a local event (for internal use)
   */
  private emit(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event as MessageType);
    if (handlers) {
      const message: BridgeMessage = {
        id: this.generateMessageId(),
        type: event as MessageType,
        payload: data,
        timestamp: Date.now(),
      };
      handlers.forEach(handler => handler(message));
    }
  }

  /**
   * Start ping interval for keepalive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.status === 'connected') {
        this.send('ping', { timestamp: Date.now() });

        // Check if we've missed pongs
        if (Date.now() - this.lastPong > 60000) {
          console.warn('[IDEBridge] No pong received, connection may be dead');
        }
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Setup default message handlers
   */
  private setupDefaultHandlers(): void {
    // Handle phase updates
    this.on('phase:update', (msg) => {
      if (this.sessionState) {
        this.sessionState.currentPhase = msg.payload.phase;
      }
    });

    // Handle todo updates
    this.on('todo:update', (msg) => {
      if (this.sessionState) {
        const todoIndex = this.sessionState.todos.findIndex(t => t.id === msg.payload.id);
        if (todoIndex >= 0) {
          this.sessionState.todos[todoIndex] = msg.payload;
        }
      }
    });

    // Handle todo add
    this.on('todo:add', (msg) => {
      if (this.sessionState) {
        this.sessionState.todos.push(msg.payload);
      }
    });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================
  // High-level API Methods
  // ============================================

  /**
   * Create a new orchestration session
   */
  async createSession(options: {
    workspaceId: string;
    workspaceType: string;
    initialTask?: string;
  }): Promise<SessionState> {
    const result = await this.send('session:create', {
      ...options,
      ideInfo: this.ideInfo,
    }, true);

    this.sessionState = result;
    return result;
  }

  /**
   * Join an existing session
   */
  async joinSession(sessionId: string): Promise<SessionState> {
    const result = await this.send('session:join', {
      sessionId,
      ideInfo: this.ideInfo,
    }, true);

    this.sessionState = result;
    return result;
  }

  /**
   * Leave the current session
   */
  async leaveSession(): Promise<void> {
    if (this.sessionState) {
      await this.send('session:leave', {
        sessionId: this.sessionState.sessionId,
      });
      this.sessionState = null;
    }
  }

  /**
   * Add a todo item
   */
  async addTodo(todo: {
    content: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    phase?: AgentPhase;
  }): Promise<any> {
    return this.send('todo:add', {
      ...todo,
      sessionId: this.sessionState?.sessionId,
    }, true);
  }

  /**
   * Update a todo item
   */
  async updateTodo(todoId: string, updates: {
    status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
    content?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<any> {
    return this.send('todo:update', {
      todoId,
      updates,
      sessionId: this.sessionState?.sessionId,
    }, true);
  }

  /**
   * Execute a tool
   */
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return this.send('tool:execute', {
      ...request,
      sessionId: this.sessionState?.sessionId,
    }, true);
  }

  /**
   * Send an inter-agent message
   */
  async sendAgentMessage(targetAgent: AgentMindset, message: any): Promise<any> {
    return this.send('agent:message', {
      targetAgent,
      message,
      sessionId: this.sessionState?.sessionId,
    }, true);
  }

  /**
   * Show UI overlay in IDE
   */
  showOverlay(options: {
    type: 'phase' | 'todo' | 'notification';
    data?: any;
  }): void {
    this.send('ui:showOverlay', options);
  }

  /**
   * Hide UI overlay
   */
  hideOverlay(): void {
    this.send('ui:hideOverlay', {});
  }

  /**
   * Show notification in IDE
   */
  notify(options: {
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
  }): void {
    this.send('ui:notification', options);
  }

  /**
   * Request full state sync
   */
  async requestSync(): Promise<SessionState | null> {
    if (!this.sessionState) return null;

    const result = await this.send('sync:request', {
      sessionId: this.sessionState.sessionId,
    }, true);

    this.sessionState = result;
    return result;
  }

  // ============================================
  // Getters
  // ============================================

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSessionState(): SessionState | null {
    return this.sessionState;
  }

  getIDEInfo(): IDEInfo | null {
    return this.ideInfo;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }
}

// Export singleton instance
export const ideExtensionBridge = IDEExtensionBridgeService.getInstance();

// Export types
export type {
  IDEInfo,
  BridgeMessage,
  MessageType,
  SessionState,
  ToolExecutionRequest,
  ToolExecutionResult,
  ConnectionStatus,
  AgentPhase,
  AgentMindset,
};

export default ideExtensionBridge;
