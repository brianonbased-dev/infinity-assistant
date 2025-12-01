/**
 * AI Agent Execution Runtime
 *
 * Handles autonomous agent execution including browser automation,
 * task queue processing, and agent-to-agent communication.
 */

// =============================================================================
// TYPES
// =============================================================================

export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

export interface AgentDefinition {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  capabilities: AgentCapability[];
  config: AgentConfig;
  createdAt: string;
}

export type AgentType =
  | 'builder'
  | 'monitor'
  | 'support'
  | 'analyst'
  | 'automation'
  | 'security'
  | 'research'
  | 'testing'
  | 'deployment'
  | 'custom';

export type AgentCapability =
  | 'web_browsing'
  | 'code_execution'
  | 'file_operations'
  | 'api_calls'
  | 'database_access'
  | 'email_send'
  | 'slack_integration'
  | 'github_operations'
  | 'shell_commands'
  | 'screenshot_capture'
  | 'pdf_generation'
  | 'data_analysis';

export interface AgentConfig {
  maxConcurrentTasks: number;
  taskTimeout: number; // seconds
  retryAttempts: number;
  retryDelay: number; // seconds
  browserHeadless: boolean;
  sandboxed: boolean;
  resourceLimits: ResourceLimits;
  permissions: AgentPermissions;
}

export interface ResourceLimits {
  maxMemory: number; // MB
  maxCpu: number; // percentage
  maxNetworkBandwidth: number; // Mbps
  maxStorageUsage: number; // MB
  maxExecutionTime: number; // seconds
}

export interface AgentPermissions {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedCommands: string[];
  blockedCommands: string[];
  fileAccessPaths: string[];
  networkAccess: boolean;
  systemAccess: boolean;
}

export interface AgentInstance {
  id: string;
  definitionId: string;
  userId: string;
  status: AgentStatus;
  currentTask?: AgentTask;
  taskHistory: TaskResult[];
  metrics: AgentMetrics;
  browserSession?: BrowserSession;
  createdAt: string;
  lastActiveAt: string;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageTaskDuration: number;
  totalExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  input: TaskInput;
  output?: TaskOutput;
  steps: TaskStep[];
  currentStep: number;
  retryCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: TaskError;
  metadata?: Record<string, unknown>;
}

export type TaskType =
  | 'web_scrape'
  | 'form_fill'
  | 'api_request'
  | 'code_generation'
  | 'file_processing'
  | 'data_extraction'
  | 'report_generation'
  | 'notification_send'
  | 'workflow_execution'
  | 'custom';

export interface TaskInput {
  instructions: string;
  parameters?: Record<string, unknown>;
  context?: TaskContext;
  files?: TaskFile[];
}

export interface TaskContext {
  projectId?: string;
  sessionId?: string;
  previousTaskId?: string;
  environmentVariables?: Record<string, string>;
}

export interface TaskFile {
  name: string;
  content: string;
  type: string;
}

export interface TaskOutput {
  result: unknown;
  artifacts: TaskArtifact[];
  logs: string[];
  screenshots?: string[];
  duration: number;
}

export interface TaskArtifact {
  id: string;
  name: string;
  type: 'file' | 'screenshot' | 'data' | 'report';
  content: string;
  mimeType: string;
  size: number;
}

export interface TaskStep {
  id: string;
  name: string;
  type: StepType;
  status: TaskStatus;
  action: StepAction;
  result?: StepResult;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export type StepType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'wait'
  | 'screenshot'
  | 'extract'
  | 'evaluate'
  | 'api_call'
  | 'file_operation'
  | 'conditional'
  | 'loop';

export interface StepAction {
  command: string;
  selector?: string;
  value?: string;
  url?: string;
  waitTime?: number;
  condition?: string;
  script?: string;
}

export interface StepResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  error?: string;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  output?: TaskOutput;
  error?: TaskError;
  duration: number;
  completedAt: string;
}

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  recoverable: boolean;
  step?: string;
}

export interface BrowserSession {
  id: string;
  agentId: string;
  status: 'active' | 'idle' | 'closed';
  currentUrl?: string;
  cookies: BrowserCookie[];
  localStorage: Record<string, string>;
  viewport: { width: number; height: number };
  createdAt: string;
}

export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
}

export interface TaskQueue {
  id: string;
  name: string;
  tasks: AgentTask[];
  processing: boolean;
  concurrency: number;
  rateLimit?: RateLimit;
}

export interface RateLimit {
  maxRequests: number;
  windowSeconds: number;
  currentCount: number;
  windowStart: string;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  type: 'request' | 'response' | 'broadcast' | 'handoff';
  payload: unknown;
  timestamp: string;
  acknowledged: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentType: AgentType;
  taskType: TaskType;
  input: TaskInput;
  conditions?: WorkflowCondition[];
  onSuccess?: string; // Next step ID
  onFailure?: string; // Fallback step ID
}

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'exists';
  value: unknown;
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  config: Record<string, unknown>;
}

// =============================================================================
// BROWSER AUTOMATION
// =============================================================================

class BrowserAutomation {
  private sessions: Map<string, BrowserSession> = new Map();

  async createSession(agentId: string, config: AgentConfig): Promise<BrowserSession> {
    const sessionId = this.generateId();

    const session: BrowserSession = {
      id: sessionId,
      agentId,
      status: 'active',
      cookies: [],
      localStorage: {},
      viewport: { width: 1920, height: 1080 },
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    // In a real implementation, this would launch Playwright/Puppeteer
    console.log(`Browser session created: ${sessionId} (headless: ${config.browserHeadless})`);

    return session;
  }

  async navigate(sessionId: string, url: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    session.currentUrl = url;
    console.log(`Navigating to: ${url}`);

    // Simulate navigation
    return { success: true, data: { url, title: 'Page Title' } };
  }

  async click(sessionId: string, selector: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    console.log(`Clicking: ${selector}`);

    // Simulate click
    return { success: true };
  }

  async type(sessionId: string, selector: string, text: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    console.log(`Typing "${text}" into: ${selector}`);

    // Simulate typing
    return { success: true };
  }

  async select(sessionId: string, selector: string, value: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    console.log(`Selecting "${value}" in: ${selector}`);

    // Simulate select
    return { success: true };
  }

  async screenshot(sessionId: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    console.log('Taking screenshot');

    // Simulate screenshot
    return {
      success: true,
      screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };
  }

  async extract(sessionId: string, selector: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    console.log(`Extracting data from: ${selector}`);

    // Simulate extraction
    return { success: true, data: { text: 'Extracted content', html: '<div>Content</div>' } };
  }

  async evaluate(sessionId: string, script: string): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    console.log(`Evaluating script: ${script.substring(0, 50)}...`);

    // Simulate evaluation
    return { success: true, data: { result: 'Script result' } };
  }

  async wait(sessionId: string, ms: number): Promise<StepResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    await new Promise((resolve) => setTimeout(resolve, ms));

    return { success: true };
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'closed';
      this.sessions.delete(sessionId);
      console.log(`Browser session closed: ${sessionId}`);
    }
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  private generateId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// TASK QUEUE PROCESSOR
// =============================================================================

class TaskQueueProcessor {
  private queues: Map<string, TaskQueue> = new Map();
  private processing: Map<string, boolean> = new Map();

  createQueue(name: string, concurrency: number = 1): TaskQueue {
    const queueId = this.generateId();

    const queue: TaskQueue = {
      id: queueId,
      name,
      tasks: [],
      processing: false,
      concurrency,
    };

    this.queues.set(queueId, queue);
    return queue;
  }

  enqueue(queueId: string, task: AgentTask): void {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }

    // Insert based on priority
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const insertIndex = queue.tasks.findIndex(
      (t) => priorityOrder[t.priority] > priorityOrder[task.priority]
    );

    if (insertIndex === -1) {
      queue.tasks.push(task);
    } else {
      queue.tasks.splice(insertIndex, 0, task);
    }

    task.status = 'queued';
  }

  dequeue(queueId: string): AgentTask | undefined {
    const queue = this.queues.get(queueId);
    if (!queue || queue.tasks.length === 0) {
      return undefined;
    }

    return queue.tasks.shift();
  }

  async processQueue(
    queueId: string,
    executor: (task: AgentTask) => Promise<TaskResult>
  ): Promise<void> {
    const queue = this.queues.get(queueId);
    if (!queue || this.processing.get(queueId)) {
      return;
    }

    this.processing.set(queueId, true);
    queue.processing = true;

    while (queue.tasks.length > 0) {
      const activeTasks: Promise<void>[] = [];

      for (let i = 0; i < queue.concurrency && queue.tasks.length > 0; i++) {
        const task = this.dequeue(queueId);
        if (task) {
          activeTasks.push(
            executor(task)
              .then((result) => {
                task.status = result.status;
                task.output = result.output;
                task.completedAt = result.completedAt;
              })
              .catch((error) => {
                task.status = 'failed';
                task.error = {
                  code: 'EXECUTION_ERROR',
                  message: error.message,
                  recoverable: true,
                };
              })
          );
        }
      }

      await Promise.all(activeTasks);
    }

    this.processing.set(queueId, false);
    queue.processing = false;
  }

  getQueue(queueId: string): TaskQueue | undefined {
    return this.queues.get(queueId);
  }

  getQueueLength(queueId: string): number {
    return this.queues.get(queueId)?.tasks.length || 0;
  }

  private generateId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// AGENT COMMUNICATION
// =============================================================================

class AgentCommunication {
  private messages: Map<string, AgentMessage[]> = new Map();
  private subscribers: Map<string, Set<(msg: AgentMessage) => void>> = new Map();

  send(message: Omit<AgentMessage, 'id' | 'timestamp' | 'acknowledged'>): AgentMessage {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    // Store message
    if (!this.messages.has(message.toAgentId)) {
      this.messages.set(message.toAgentId, []);
    }
    this.messages.get(message.toAgentId)!.push(fullMessage);

    // Notify subscribers
    const subs = this.subscribers.get(message.toAgentId);
    if (subs) {
      subs.forEach((handler) => handler(fullMessage));
    }

    return fullMessage;
  }

  broadcast(fromAgentId: string, agentIds: string[], payload: unknown): AgentMessage[] {
    return agentIds.map((toAgentId) =>
      this.send({
        fromAgentId,
        toAgentId,
        type: 'broadcast',
        payload,
      })
    );
  }

  handoff(fromAgentId: string, toAgentId: string, task: AgentTask): AgentMessage {
    return this.send({
      fromAgentId,
      toAgentId,
      type: 'handoff',
      payload: { task },
    });
  }

  acknowledge(messageId: string, agentId: string): void {
    const messages = this.messages.get(agentId);
    if (messages) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.acknowledged = true;
      }
    }
  }

  getMessages(agentId: string, unacknowledgedOnly: boolean = false): AgentMessage[] {
    const messages = this.messages.get(agentId) || [];
    if (unacknowledgedOnly) {
      return messages.filter((m) => !m.acknowledged);
    }
    return messages;
  }

  subscribe(agentId: string, handler: (msg: AgentMessage) => void): () => void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }
    this.subscribers.get(agentId)!.add(handler);

    return () => {
      this.subscribers.get(agentId)?.delete(handler);
    };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// AGENT EXECUTION RUNTIME
// =============================================================================

export class AgentExecutionRuntime {
  private static instance: AgentExecutionRuntime;
  private definitions: Map<string, AgentDefinition> = new Map();
  private instances: Map<string, AgentInstance> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private browser: BrowserAutomation;
  private taskQueue: TaskQueueProcessor;
  private communication: AgentCommunication;

  private constructor() {
    this.browser = new BrowserAutomation();
    this.taskQueue = new TaskQueueProcessor();
    this.communication = new AgentCommunication();
    this.initializeDefaultAgents();
  }

  static getInstance(): AgentExecutionRuntime {
    if (!AgentExecutionRuntime.instance) {
      AgentExecutionRuntime.instance = new AgentExecutionRuntime();
    }
    return AgentExecutionRuntime.instance;
  }

  private initializeDefaultAgents(): void {
    const defaultAgents: Omit<AgentDefinition, 'id' | 'createdAt'>[] = [
      {
        name: 'Builder Agent',
        type: 'builder',
        description: 'Autonomous code generation and project building',
        capabilities: ['code_execution', 'file_operations', 'api_calls', 'github_operations'],
        config: this.getDefaultConfig(),
      },
      {
        name: 'Monitor Agent',
        type: 'monitor',
        description: 'Continuous monitoring and alerting',
        capabilities: ['api_calls', 'data_analysis', 'email_send', 'slack_integration'],
        config: this.getDefaultConfig(),
      },
      {
        name: 'Research Agent',
        type: 'research',
        description: 'Web research and data gathering',
        capabilities: ['web_browsing', 'screenshot_capture', 'data_analysis', 'pdf_generation'],
        config: this.getDefaultConfig(),
      },
      {
        name: 'Testing Agent',
        type: 'testing',
        description: 'Automated testing and QA',
        capabilities: ['code_execution', 'web_browsing', 'screenshot_capture', 'api_calls'],
        config: this.getDefaultConfig(),
      },
      {
        name: 'Deployment Agent',
        type: 'deployment',
        description: 'Automated deployment and infrastructure',
        capabilities: ['shell_commands', 'api_calls', 'file_operations', 'github_operations'],
        config: this.getDefaultConfig(),
      },
    ];

    for (const def of defaultAgents) {
      this.registerAgent(def);
    }
  }

  private getDefaultConfig(): AgentConfig {
    return {
      maxConcurrentTasks: 3,
      taskTimeout: 300,
      retryAttempts: 3,
      retryDelay: 5,
      browserHeadless: true,
      sandboxed: true,
      resourceLimits: {
        maxMemory: 512,
        maxCpu: 50,
        maxNetworkBandwidth: 10,
        maxStorageUsage: 100,
        maxExecutionTime: 600,
      },
      permissions: {
        allowedDomains: ['*'],
        blockedDomains: [],
        allowedCommands: [],
        blockedCommands: ['rm -rf', 'sudo'],
        fileAccessPaths: ['/tmp'],
        networkAccess: true,
        systemAccess: false,
      },
    };
  }

  // ===========================================================================
  // AGENT MANAGEMENT
  // ===========================================================================

  registerAgent(definition: Omit<AgentDefinition, 'id' | 'createdAt'>): AgentDefinition {
    const agentDef: AgentDefinition = {
      ...definition,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    this.definitions.set(agentDef.id, agentDef);
    return agentDef;
  }

  async spawnAgent(definitionId: string, userId: string): Promise<AgentInstance> {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`Agent definition not found: ${definitionId}`);
    }

    const instanceId = this.generateId();

    const instance: AgentInstance = {
      id: instanceId,
      definitionId,
      userId,
      status: 'initializing',
      taskHistory: [],
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageTaskDuration: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        errorRate: 0,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    // Create browser session if needed
    if (definition.capabilities.includes('web_browsing')) {
      instance.browserSession = await this.browser.createSession(instanceId, definition.config);
    }

    // Create task queue
    this.taskQueue.createQueue(instanceId, definition.config.maxConcurrentTasks);

    this.instances.set(instanceId, instance);
    instance.status = 'idle';

    return instance;
  }

  async terminateAgent(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    instance.status = 'terminated';

    // Close browser session
    if (instance.browserSession) {
      await this.browser.closeSession(instance.browserSession.id);
    }

    this.instances.delete(instanceId);
  }

  getAgent(instanceId: string): AgentInstance | undefined {
    return this.instances.get(instanceId);
  }

  listAgents(userId?: string): AgentInstance[] {
    const agents = Array.from(this.instances.values());
    if (userId) {
      return agents.filter((a) => a.userId === userId);
    }
    return agents;
  }

  getAgentDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  // ===========================================================================
  // TASK EXECUTION
  // ===========================================================================

  async executeTask(instanceId: string, task: Omit<AgentTask, 'id' | 'agentId' | 'status' | 'steps' | 'currentStep' | 'retryCount' | 'createdAt'>): Promise<AgentTask> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Agent instance not found: ${instanceId}`);
    }

    const definition = this.definitions.get(instance.definitionId);
    if (!definition) {
      throw new Error(`Agent definition not found: ${instance.definitionId}`);
    }

    const taskId = this.generateId();

    const fullTask: AgentTask = {
      ...task,
      id: taskId,
      agentId: instanceId,
      status: 'pending',
      steps: this.generateTaskSteps(task.type, task.input),
      currentStep: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Queue the task
    this.taskQueue.enqueue(instanceId, fullTask);

    // Start processing
    this.processAgentTasks(instanceId, instance, definition);

    return fullTask;
  }

  private async processAgentTasks(instanceId: string, instance: AgentInstance, definition: AgentDefinition): Promise<void> {
    await this.taskQueue.processQueue(instanceId, async (task) => {
      instance.status = 'running';
      instance.currentTask = task;
      instance.lastActiveAt = new Date().toISOString();
      task.status = 'running';
      task.startedAt = new Date().toISOString();

      const startTime = Date.now();

      try {
        // Execute each step
        for (let i = 0; i < task.steps.length; i++) {
          task.currentStep = i;
          const step = task.steps[i];
          step.status = 'running';
          step.startedAt = new Date().toISOString();

          try {
            step.result = await this.executeStep(instance, step, definition);
            step.status = 'completed';
          } catch (error) {
            step.status = 'failed';
            step.error = error instanceof Error ? error.message : 'Unknown error';

            // Check if we should retry
            if (task.retryCount < definition.config.retryAttempts) {
              task.retryCount++;
              task.status = 'retrying';
              await new Promise((r) => setTimeout(r, definition.config.retryDelay * 1000));
              i--; // Retry this step
              continue;
            }

            throw error;
          }

          step.completedAt = new Date().toISOString();
        }

        const duration = Date.now() - startTime;

        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.output = {
          result: task.steps.map((s) => s.result),
          artifacts: [],
          logs: task.steps.map((s) => `${s.name}: ${s.status}`),
          duration,
        };

        // Update metrics
        instance.metrics.tasksCompleted++;
        instance.metrics.totalExecutionTime += duration;
        instance.metrics.averageTaskDuration =
          instance.metrics.totalExecutionTime / instance.metrics.tasksCompleted;

        instance.taskHistory.push({
          taskId: task.id,
          status: task.status,
          output: task.output,
          duration,
          completedAt: task.completedAt,
        });

        return {
          taskId: task.id,
          status: task.status,
          output: task.output,
          duration,
          completedAt: task.completedAt,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        task.status = 'failed';
        task.completedAt = new Date().toISOString();
        task.error = {
          code: 'TASK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false,
        };

        instance.metrics.tasksFailed++;
        instance.metrics.errorRate =
          instance.metrics.tasksFailed /
          (instance.metrics.tasksCompleted + instance.metrics.tasksFailed);

        instance.taskHistory.push({
          taskId: task.id,
          status: task.status,
          error: task.error,
          duration,
          completedAt: task.completedAt,
        });

        return {
          taskId: task.id,
          status: task.status,
          error: task.error,
          duration,
          completedAt: task.completedAt,
        };
      } finally {
        instance.currentTask = undefined;
        instance.status = 'idle';
        instance.lastActiveAt = new Date().toISOString();
      }
    });
  }

  private async executeStep(instance: AgentInstance, step: TaskStep, definition: AgentDefinition): Promise<StepResult> {
    const sessionId = instance.browserSession?.id;

    switch (step.type) {
      case 'navigate':
        if (!sessionId || !step.action.url) {
          return { success: false, error: 'No browser session or URL' };
        }
        return this.browser.navigate(sessionId, step.action.url);

      case 'click':
        if (!sessionId || !step.action.selector) {
          return { success: false, error: 'No browser session or selector' };
        }
        return this.browser.click(sessionId, step.action.selector);

      case 'type':
        if (!sessionId || !step.action.selector || !step.action.value) {
          return { success: false, error: 'Missing required parameters' };
        }
        return this.browser.type(sessionId, step.action.selector, step.action.value);

      case 'select':
        if (!sessionId || !step.action.selector || !step.action.value) {
          return { success: false, error: 'Missing required parameters' };
        }
        return this.browser.select(sessionId, step.action.selector, step.action.value);

      case 'wait':
        if (!sessionId) {
          return { success: false, error: 'No browser session' };
        }
        return this.browser.wait(sessionId, step.action.waitTime || 1000);

      case 'screenshot':
        if (!sessionId) {
          return { success: false, error: 'No browser session' };
        }
        return this.browser.screenshot(sessionId);

      case 'extract':
        if (!sessionId || !step.action.selector) {
          return { success: false, error: 'Missing required parameters' };
        }
        return this.browser.extract(sessionId, step.action.selector);

      case 'evaluate':
        if (!sessionId || !step.action.script) {
          return { success: false, error: 'Missing required parameters' };
        }
        return this.browser.evaluate(sessionId, step.action.script);

      case 'api_call':
        return this.executeApiCall(step.action);

      case 'file_operation':
        return this.executeFileOperation(step.action, definition);

      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  }

  private async executeApiCall(action: StepAction): Promise<StepResult> {
    try {
      const response = await fetch(action.url!, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'API call failed' };
    }
  }

  private async executeFileOperation(action: StepAction, _definition: AgentDefinition): Promise<StepResult> {
    console.log(`File operation: ${action.command}`);
    return { success: true };
  }

  private generateTaskSteps(taskType: TaskType, input: TaskInput): TaskStep[] {
    const steps: TaskStep[] = [];

    switch (taskType) {
      case 'web_scrape':
        steps.push(
          {
            id: this.generateId(),
            name: 'Navigate to target',
            type: 'navigate',
            status: 'pending',
            action: { command: 'navigate', url: input.parameters?.url as string },
          },
          {
            id: this.generateId(),
            name: 'Wait for content',
            type: 'wait',
            status: 'pending',
            action: { command: 'wait', waitTime: 2000 },
          },
          {
            id: this.generateId(),
            name: 'Extract data',
            type: 'extract',
            status: 'pending',
            action: { command: 'extract', selector: input.parameters?.selector as string || 'body' },
          },
          {
            id: this.generateId(),
            name: 'Take screenshot',
            type: 'screenshot',
            status: 'pending',
            action: { command: 'screenshot' },
          }
        );
        break;

      case 'form_fill':
        steps.push(
          {
            id: this.generateId(),
            name: 'Navigate to form',
            type: 'navigate',
            status: 'pending',
            action: { command: 'navigate', url: input.parameters?.url as string },
          },
          {
            id: this.generateId(),
            name: 'Wait for form',
            type: 'wait',
            status: 'pending',
            action: { command: 'wait', waitTime: 1000 },
          }
        );

        // Add steps for each form field
        const fields = input.parameters?.fields as Record<string, string> || {};
        for (const [selector, value] of Object.entries(fields)) {
          steps.push({
            id: this.generateId(),
            name: `Fill field ${selector}`,
            type: 'type',
            status: 'pending',
            action: { command: 'type', selector, value },
          });
        }

        steps.push({
          id: this.generateId(),
          name: 'Submit form',
          type: 'click',
          status: 'pending',
          action: { command: 'click', selector: input.parameters?.submitSelector as string || 'button[type="submit"]' },
        });
        break;

      case 'api_request':
        steps.push({
          id: this.generateId(),
          name: 'Execute API call',
          type: 'api_call',
          status: 'pending',
          action: { command: 'api_call', url: input.parameters?.url as string },
        });
        break;

      default:
        steps.push({
          id: this.generateId(),
          name: 'Execute task',
          type: 'evaluate',
          status: 'pending',
          action: { command: 'evaluate', script: input.instructions },
        });
    }

    return steps;
  }

  // ===========================================================================
  // WORKFLOW MANAGEMENT
  // ===========================================================================

  createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Workflow {
    const fullWorkflow: Workflow = {
      ...workflow,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workflows.set(fullWorkflow.id, fullWorkflow);
    return fullWorkflow;
  }

  async executeWorkflow(workflowId: string, userId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    let currentStepId: string | undefined = workflow.steps[0]?.id;

    while (currentStepId) {
      const step = workflow.steps.find((s) => s.id === currentStepId);
      if (!step) break;

      // Find or spawn agent for this step
      const agentDef = Array.from(this.definitions.values()).find(
        (d) => d.type === step.agentType
      );
      if (!agentDef) {
        throw new Error(`No agent found for type: ${step.agentType}`);
      }

      const agent = await this.spawnAgent(agentDef.id, userId);

      try {
        const task = await this.executeTask(agent.id, {
          type: step.taskType,
          priority: 'normal',
          input: step.input,
        });

        // Wait for task completion
        while (task.status === 'running' || task.status === 'queued') {
          await new Promise((r) => setTimeout(r, 1000));
        }

        if (task.status === 'completed') {
          currentStepId = step.onSuccess;
        } else {
          currentStepId = step.onFailure;
        }
      } finally {
        await this.terminateAgent(agent.id);
      }
    }
  }

  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  // ===========================================================================
  // AGENT COMMUNICATION
  // ===========================================================================

  sendMessage(fromAgentId: string, toAgentId: string, payload: unknown): AgentMessage {
    return this.communication.send({
      fromAgentId,
      toAgentId,
      type: 'request',
      payload,
    });
  }

  broadcastMessage(fromAgentId: string, payload: unknown): AgentMessage[] {
    const otherAgents = Array.from(this.instances.keys()).filter((id) => id !== fromAgentId);
    return this.communication.broadcast(fromAgentId, otherAgents, payload);
  }

  handoffTask(fromAgentId: string, toAgentId: string, task: AgentTask): AgentMessage {
    return this.communication.handoff(fromAgentId, toAgentId, task);
  }

  getMessages(agentId: string): AgentMessage[] {
    return this.communication.getMessages(agentId);
  }

  subscribeToMessages(agentId: string, handler: (msg: AgentMessage) => void): () => void {
    return this.communication.subscribe(agentId, handler);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private generateId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton
export const agentRuntime = AgentExecutionRuntime.getInstance();
