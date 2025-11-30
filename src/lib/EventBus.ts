/**
 * Unified Event Bus
 *
 * Replaces fragmented event systems across services.
 * Provides type-safe pub/sub for cross-service communication.
 */

// ============================================================================
// Event Type Definitions
// ============================================================================

export type EventCategory =
  | 'vehicle'
  | 'charging'
  | 'build'
  | 'deployment'
  | 'user'
  | 'billing'
  | 'agent'
  | 'system'
  | 'error';

export type EventType =
  // Vehicle events
  | 'vehicle.connected'
  | 'vehicle.disconnected'
  | 'vehicle.status_updated'
  | 'vehicle.command_sent'
  | 'vehicle.command_completed'
  // Charging events
  | 'charging.started'
  | 'charging.stopped'
  | 'charging.completed'
  | 'charging.error'
  | 'charging.scheduled'
  // Build events
  | 'build.started'
  | 'build.progress'
  | 'build.completed'
  | 'build.failed'
  | 'build.cancelled'
  // Deployment events
  | 'deployment.started'
  | 'deployment.progress'
  | 'deployment.completed'
  | 'deployment.failed'
  | 'deployment.rollback'
  // User events
  | 'user.signup'
  | 'user.login'
  | 'user.logout'
  | 'user.updated'
  | 'user.deleted'
  // Billing events
  | 'billing.subscription_created'
  | 'billing.subscription_updated'
  | 'billing.subscription_cancelled'
  | 'billing.payment_succeeded'
  | 'billing.payment_failed'
  | 'billing.usage_recorded'
  // Agent events
  | 'agent.spawned'
  | 'agent.task_started'
  | 'agent.task_completed'
  | 'agent.task_failed'
  | 'agent.terminated'
  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.health_check'
  | 'system.config_updated'
  // Error events
  | 'error.service'
  | 'error.api'
  | 'error.database'
  | 'error.external';

// ============================================================================
// Event Payload Types
// ============================================================================

export interface BaseEventPayload {
  timestamp: Date;
  source: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface VehicleEventPayload extends BaseEventPayload {
  vehicleId: string;
  userId: string;
  manufacturer?: string;
  model?: string;
}

export interface ChargingEventPayload extends BaseEventPayload {
  vehicleId: string;
  userId: string;
  stationId?: string;
  batteryPercent?: number;
  chargingPower?: number;
  estimatedCompletion?: Date;
}

export interface BuildEventPayload extends BaseEventPayload {
  buildId: string;
  projectId: string;
  userId: string;
  phase?: string;
  progress?: number;
  duration?: number;
  error?: string;
}

export interface DeploymentEventPayload extends BaseEventPayload {
  deploymentId: string;
  projectId: string;
  userId: string;
  platform: string;
  environment: string;
  url?: string;
  error?: string;
}

export interface UserEventPayload extends BaseEventPayload {
  userId: string;
  email?: string;
  plan?: string;
}

export interface BillingEventPayload extends BaseEventPayload {
  customerId: string;
  userId: string;
  subscriptionId?: string;
  planId?: string;
  amount?: number;
  currency?: string;
}

export interface AgentEventPayload extends BaseEventPayload {
  agentId: string;
  agentType: string;
  userId: string;
  taskId?: string;
  taskType?: string;
  duration?: number;
  error?: string;
}

export interface SystemEventPayload extends BaseEventPayload {
  component: string;
  status?: string;
  message?: string;
}

export interface ErrorEventPayload extends BaseEventPayload {
  errorCode: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  retryable?: boolean;
}

// Type mapping for event payloads
export interface EventPayloadMap {
  'vehicle.connected': VehicleEventPayload;
  'vehicle.disconnected': VehicleEventPayload;
  'vehicle.status_updated': VehicleEventPayload;
  'vehicle.command_sent': VehicleEventPayload;
  'vehicle.command_completed': VehicleEventPayload;
  'charging.started': ChargingEventPayload;
  'charging.stopped': ChargingEventPayload;
  'charging.completed': ChargingEventPayload;
  'charging.error': ChargingEventPayload;
  'charging.scheduled': ChargingEventPayload;
  'build.started': BuildEventPayload;
  'build.progress': BuildEventPayload;
  'build.completed': BuildEventPayload;
  'build.failed': BuildEventPayload;
  'build.cancelled': BuildEventPayload;
  'deployment.started': DeploymentEventPayload;
  'deployment.progress': DeploymentEventPayload;
  'deployment.completed': DeploymentEventPayload;
  'deployment.failed': DeploymentEventPayload;
  'deployment.rollback': DeploymentEventPayload;
  'user.signup': UserEventPayload;
  'user.login': UserEventPayload;
  'user.logout': UserEventPayload;
  'user.updated': UserEventPayload;
  'user.deleted': UserEventPayload;
  'billing.subscription_created': BillingEventPayload;
  'billing.subscription_updated': BillingEventPayload;
  'billing.subscription_cancelled': BillingEventPayload;
  'billing.payment_succeeded': BillingEventPayload;
  'billing.payment_failed': BillingEventPayload;
  'billing.usage_recorded': BillingEventPayload;
  'agent.spawned': AgentEventPayload;
  'agent.task_started': AgentEventPayload;
  'agent.task_completed': AgentEventPayload;
  'agent.task_failed': AgentEventPayload;
  'agent.terminated': AgentEventPayload;
  'system.startup': SystemEventPayload;
  'system.shutdown': SystemEventPayload;
  'system.health_check': SystemEventPayload;
  'system.config_updated': SystemEventPayload;
  'error.service': ErrorEventPayload;
  'error.api': ErrorEventPayload;
  'error.database': ErrorEventPayload;
  'error.external': ErrorEventPayload;
}

// ============================================================================
// Event Handler Types
// ============================================================================

export type EventHandler<T extends EventType> = (
  event: Event<T>
) => void | Promise<void>;

export type WildcardHandler = (
  eventType: EventType,
  event: Event<EventType>
) => void | Promise<void>;

export interface Event<T extends EventType> {
  type: T;
  payload: EventPayloadMap[T];
  id: string;
  emittedAt: Date;
}

export interface Subscription {
  id: string;
  eventType: EventType | '*';
  handler: EventHandler<EventType> | WildcardHandler;
  once: boolean;
  priority: number;
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

export interface EventBusOptions {
  /** Enable async event processing */
  async?: boolean;
  /** Maximum event history size */
  historySize?: number;
  /** Enable event logging */
  logging?: boolean;
  /** Error handler for failed event processing */
  onError?: (error: Error, event: Event<EventType>) => void;
}

class EventBusImpl {
  private subscriptions = new Map<EventType | '*', Subscription[]>();
  private history: Event<EventType>[] = [];
  private readonly options: Required<EventBusOptions>;
  private eventCounter = 0;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      async: options.async ?? true,
      historySize: options.historySize ?? 100,
      logging: options.logging ?? false,
      onError: options.onError ?? ((err) => console.error('[EventBus] Error:', err))
    };
  }

  /**
   * Subscribe to an event type
   */
  on<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>,
    options?: { priority?: number }
  ): () => void {
    return this.addSubscription(eventType, handler as EventHandler<EventType>, {
      once: false,
      priority: options?.priority ?? 0
    });
  }

  /**
   * Subscribe to an event type (once)
   */
  once<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    return this.addSubscription(eventType, handler as EventHandler<EventType>, {
      once: true,
      priority: 0
    });
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: WildcardHandler): () => void {
    return this.addSubscription('*', handler as EventHandler<EventType>, {
      once: false,
      priority: 0
    });
  }

  /**
   * Unsubscribe from an event type
   */
  off<T extends EventType>(eventType: T, handler: EventHandler<T>): void {
    const subs = this.subscriptions.get(eventType);
    if (subs) {
      const idx = subs.findIndex(s => s.handler === handler);
      if (idx !== -1) {
        subs.splice(idx, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  emit<T extends EventType>(
    eventType: T,
    payload: Omit<EventPayloadMap[T], 'timestamp' | 'source'> & { source: string }
  ): Event<T> {
    const event: Event<T> = {
      type: eventType,
      payload: {
        ...payload,
        timestamp: new Date()
      } as EventPayloadMap[T],
      id: this.generateEventId(),
      emittedAt: new Date()
    };

    if (this.options.logging) {
      console.log(`[EventBus] Emitting: ${eventType}`, event.id);
    }

    // Add to history
    this.addToHistory(event as Event<EventType>);

    // Get handlers for this event type and wildcards
    const handlers = [
      ...(this.subscriptions.get(eventType) || []),
      ...(this.subscriptions.get('*') || [])
    ].sort((a, b) => b.priority - a.priority);

    // Process handlers
    if (this.options.async) {
      this.processAsync(handlers, event as Event<EventType>, eventType);
    } else {
      this.processSync(handlers, event as Event<EventType>, eventType);
    }

    return event;
  }

  /**
   * Emit and wait for all handlers to complete
   */
  async emitAsync<T extends EventType>(
    eventType: T,
    payload: Omit<EventPayloadMap[T], 'timestamp' | 'source'> & { source: string }
  ): Promise<Event<T>> {
    const event: Event<T> = {
      type: eventType,
      payload: {
        ...payload,
        timestamp: new Date()
      } as EventPayloadMap[T],
      id: this.generateEventId(),
      emittedAt: new Date()
    };

    this.addToHistory(event as Event<EventType>);

    const handlers = [
      ...(this.subscriptions.get(eventType) || []),
      ...(this.subscriptions.get('*') || [])
    ].sort((a, b) => b.priority - a.priority);

    await this.processAsync(handlers, event as Event<EventType>, eventType);

    return event;
  }

  /**
   * Get event history
   */
  getHistory(filter?: { type?: EventType; limit?: number }): Event<EventType>[] {
    let events = [...this.history];

    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(eventType?: EventType): number {
    if (eventType) {
      return this.subscriptions.get(eventType)?.length ?? 0;
    }

    let count = 0;
    for (const subs of this.subscriptions.values()) {
      count += subs.length;
    }
    return count;
  }

  /**
   * Remove all subscriptions
   */
  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.subscriptions.delete(eventType);
    } else {
      this.subscriptions.clear();
    }
  }

  // Private methods

  private addSubscription(
    eventType: EventType | '*',
    handler: EventHandler<EventType>,
    options: { once: boolean; priority: number }
  ): () => void {
    const subscription: Subscription = {
      id: this.generateEventId(),
      eventType,
      handler,
      once: options.once,
      priority: options.priority
    };

    const subs = this.subscriptions.get(eventType) || [];
    subs.push(subscription);
    this.subscriptions.set(eventType, subs);

    // Return unsubscribe function
    return () => {
      const currentSubs = this.subscriptions.get(eventType);
      if (currentSubs) {
        const idx = currentSubs.findIndex(s => s.id === subscription.id);
        if (idx !== -1) {
          currentSubs.splice(idx, 1);
        }
      }
    };
  }

  private processSync(
    handlers: Subscription[],
    event: Event<EventType>,
    eventType: EventType
  ): void {
    const toRemove: Subscription[] = [];

    for (const sub of handlers) {
      try {
        if (sub.eventType === '*') {
          (sub.handler as WildcardHandler)(eventType, event);
        } else {
          (sub.handler as EventHandler<EventType>)(event);
        }

        if (sub.once) {
          toRemove.push(sub);
        }
      } catch (error) {
        this.options.onError(error as Error, event);
      }
    }

    // Remove once handlers
    for (const sub of toRemove) {
      const subs = this.subscriptions.get(sub.eventType);
      if (subs) {
        const idx = subs.findIndex(s => s.id === sub.id);
        if (idx !== -1) subs.splice(idx, 1);
      }
    }
  }

  private async processAsync(
    handlers: Subscription[],
    event: Event<EventType>,
    eventType: EventType
  ): Promise<void> {
    const toRemove: Subscription[] = [];

    const promises = handlers.map(async (sub) => {
      try {
        if (sub.eventType === '*') {
          await (sub.handler as WildcardHandler)(eventType, event);
        } else {
          await (sub.handler as EventHandler<EventType>)(event);
        }

        if (sub.once) {
          toRemove.push(sub);
        }
      } catch (error) {
        this.options.onError(error as Error, event);
      }
    });

    await Promise.all(promises);

    // Remove once handlers
    for (const sub of toRemove) {
      const subs = this.subscriptions.get(sub.eventType);
      if (subs) {
        const idx = subs.findIndex(s => s.id === sub.id);
        if (idx !== -1) subs.splice(idx, 1);
      }
    }
  }

  private addToHistory(event: Event<EventType>): void {
    this.history.push(event);

    // Trim history if needed
    if (this.history.length > this.options.historySize) {
      this.history = this.history.slice(-this.options.historySize);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventCounter}`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let eventBusInstance: EventBusImpl | null = null;

export function getEventBus(options?: EventBusOptions): EventBusImpl {
  if (!eventBusInstance) {
    eventBusInstance = new EventBusImpl(options);
  }
  return eventBusInstance;
}

// Default export
export const eventBus = getEventBus();

// Helper to create event payload with defaults
export function createPayload<T extends EventType>(
  source: string,
  data: Omit<EventPayloadMap[T], 'timestamp' | 'source'>
): Omit<EventPayloadMap[T], 'timestamp' | 'source'> & { source: string } {
  return { ...data, source };
}

export default eventBus;
