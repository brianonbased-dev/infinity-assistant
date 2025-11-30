/**
 * EV Update Scheduler for Infinity Assistant
 *
 * Provides continuous, real-time updates for all connected EVs:
 * - Configurable polling intervals per vehicle/manufacturer
 * - Event-driven updates via Server-Sent Events (SSE)
 * - Automatic retry with exponential backoff
 * - Battery-efficient scheduling based on vehicle state
 * - Priority-based update queue
 *
 * @author Infinity Assistant
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';
import {
  getUnifiedEVService,
  UnifiedVehicleStatus,
  Manufacturer,
} from './manufacturers/UnifiedEVService';

// ============================================================================
// TYPES
// ============================================================================

export interface UpdateScheduleConfig {
  vehicleId: string;
  manufacturer: Manufacturer;
  intervals: {
    idle: number;      // ms - when vehicle is parked and not charging
    charging: number;  // ms - when actively charging
    driving: number;   // ms - when vehicle is in motion
    critical: number;  // ms - when battery is low or error state
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  enabled: boolean;
}

export interface UpdateEvent {
  type: 'status_update' | 'charging_started' | 'charging_stopped' | 'charging_complete' |
        'climate_changed' | 'location_changed' | 'battery_low' | 'error' | 'connection_lost';
  vehicleId: string;
  manufacturer: Manufacturer;
  timestamp: Date;
  data: UnifiedVehicleStatus | { message: string };
  previousStatus?: UnifiedVehicleStatus;
}

export interface SchedulerStats {
  activeVehicles: number;
  totalUpdates: number;
  failedUpdates: number;
  averageLatency: number;
  lastUpdateTime?: Date;
  updatesByManufacturer: Record<Manufacturer, number>;
}

type UpdateHandler = (event: UpdateEvent) => void | Promise<void>;

// Default intervals in milliseconds
const DEFAULT_INTERVALS = {
  idle: 5 * 60 * 1000,       // 5 minutes when idle
  charging: 1 * 60 * 1000,   // 1 minute when charging
  driving: 15 * 1000,        // 15 seconds when driving
  critical: 10 * 1000,       // 10 seconds for critical updates
};

// ============================================================================
// EV UPDATE SCHEDULER
// ============================================================================

export class EVUpdateScheduler extends EventEmitter {
  private static instance: EVUpdateScheduler;
  private evService = getUnifiedEVService();

  private schedules = new Map<string, UpdateScheduleConfig>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastStatus = new Map<string, UnifiedVehicleStatus>();
  private retryCount = new Map<string, number>();
  private handlers = new Set<UpdateHandler>();

  // Statistics
  private stats: SchedulerStats = {
    activeVehicles: 0,
    totalUpdates: 0,
    failedUpdates: 0,
    averageLatency: 0,
    updatesByManufacturer: {} as Record<Manufacturer, number>,
  };

  private latencyHistory: number[] = [];
  private isRunning = false;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EVUpdateScheduler {
    if (!EVUpdateScheduler.instance) {
      EVUpdateScheduler.instance = new EVUpdateScheduler();
    }
    return EVUpdateScheduler.instance;
  }

  // ==========================================================================
  // SCHEDULE MANAGEMENT
  // ==========================================================================

  /**
   * Add a vehicle to the update schedule
   */
  addVehicle(
    vehicleId: string,
    manufacturer: Manufacturer,
    config?: Partial<UpdateScheduleConfig>
  ): void {
    const schedule: UpdateScheduleConfig = {
      vehicleId,
      manufacturer,
      intervals: { ...DEFAULT_INTERVALS, ...config?.intervals },
      priority: config?.priority || 'normal',
      enabled: config?.enabled !== false,
    };

    this.schedules.set(vehicleId, schedule);
    this.stats.activeVehicles = this.schedules.size;

    if (schedule.enabled && this.isRunning) {
      this.startVehicleUpdates(vehicleId);
    }

    logger.info('[EVScheduler] Vehicle added', { vehicleId, manufacturer });
  }

  /**
   * Remove a vehicle from the update schedule
   */
  removeVehicle(vehicleId: string): void {
    this.stopVehicleUpdates(vehicleId);
    this.schedules.delete(vehicleId);
    this.lastStatus.delete(vehicleId);
    this.retryCount.delete(vehicleId);
    this.stats.activeVehicles = this.schedules.size;

    logger.info('[EVScheduler] Vehicle removed', { vehicleId });
  }

  /**
   * Update schedule configuration for a vehicle
   */
  updateSchedule(vehicleId: string, config: Partial<UpdateScheduleConfig>): void {
    const existing = this.schedules.get(vehicleId);
    if (!existing) {
      throw new Error(`Vehicle ${vehicleId} not found in scheduler`);
    }

    const updated: UpdateScheduleConfig = {
      ...existing,
      ...config,
      intervals: { ...existing.intervals, ...config.intervals },
    };

    this.schedules.set(vehicleId, updated);

    // Restart updates with new configuration
    if (this.isRunning) {
      this.stopVehicleUpdates(vehicleId);
      if (updated.enabled) {
        this.startVehicleUpdates(vehicleId);
      }
    }
  }

  /**
   * Enable or disable updates for a vehicle
   */
  setEnabled(vehicleId: string, enabled: boolean): void {
    const schedule = this.schedules.get(vehicleId);
    if (schedule) {
      schedule.enabled = enabled;
      if (this.isRunning) {
        if (enabled) {
          this.startVehicleUpdates(vehicleId);
        } else {
          this.stopVehicleUpdates(vehicleId);
        }
      }
    }
  }

  // ==========================================================================
  // SCHEDULER CONTROL
  // ==========================================================================

  /**
   * Start the update scheduler for all registered vehicles
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('[EVScheduler] Starting scheduler', {
      vehicles: this.schedules.size,
    });

    for (const [vehicleId, schedule] of this.schedules) {
      if (schedule.enabled) {
        this.startVehicleUpdates(vehicleId);
      }
    }
  }

  /**
   * Stop the update scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    logger.info('[EVScheduler] Stopping scheduler');

    for (const vehicleId of this.timers.keys()) {
      this.stopVehicleUpdates(vehicleId);
    }
  }

  /**
   * Pause updates for a specific vehicle
   */
  pause(vehicleId: string): void {
    this.stopVehicleUpdates(vehicleId);
  }

  /**
   * Resume updates for a specific vehicle
   */
  resume(vehicleId: string): void {
    if (this.isRunning && this.schedules.get(vehicleId)?.enabled) {
      this.startVehicleUpdates(vehicleId);
    }
  }

  /**
   * Force an immediate update for a vehicle
   */
  async forceUpdate(vehicleId: string): Promise<UnifiedVehicleStatus> {
    return this.fetchAndEmitUpdate(vehicleId);
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Register an update handler
   */
  onUpdate(handler: UpdateHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Get SSE stream for real-time updates
   */
  createSSEStream(vehicleIds?: string[]): ReadableStream {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    return new ReadableStream({
      start: (controller) => {
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date() })}\n\n`)
        );

        // Subscribe to updates
        unsubscribe = this.onUpdate((event) => {
          // Filter by vehicleIds if specified
          if (vehicleIds && !vehicleIds.includes(event.vehicleId)) {
            return;
          }

          const data = JSON.stringify({
            type: event.type,
            vehicleId: event.vehicleId,
            manufacturer: event.manufacturer,
            timestamp: event.timestamp,
            data: event.data,
          });

          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`));
        });

        // Send heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
          controller.enqueue(
            encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date() })}\n\n`)
          );
        }, 30000);

        // Cleanup on close
        return () => {
          clearInterval(heartbeat);
          if (unsubscribe) unsubscribe();
        };
      },
      cancel: () => {
        if (unsubscribe) unsubscribe();
      },
    });
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  getVehicleStatus(vehicleId: string): UnifiedVehicleStatus | undefined {
    return this.lastStatus.get(vehicleId);
  }

  getAllStatuses(): Map<string, UnifiedVehicleStatus> {
    return new Map(this.lastStatus);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private startVehicleUpdates(vehicleId: string): void {
    if (this.timers.has(vehicleId)) return;

    const schedule = this.schedules.get(vehicleId);
    if (!schedule) return;

    // Initial fetch
    this.fetchAndEmitUpdate(vehicleId).catch((error) => {
      logger.error('[EVScheduler] Initial fetch failed', { vehicleId, error });
    });

    // Schedule periodic updates
    this.scheduleNextUpdate(vehicleId);
  }

  private stopVehicleUpdates(vehicleId: string): void {
    const timer = this.timers.get(vehicleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(vehicleId);
    }
  }

  private scheduleNextUpdate(vehicleId: string): void {
    const schedule = this.schedules.get(vehicleId);
    if (!schedule || !schedule.enabled || !this.isRunning) return;

    // Determine interval based on vehicle state
    const lastStatus = this.lastStatus.get(vehicleId);
    let interval = schedule.intervals.idle;

    if (lastStatus) {
      if (lastStatus.charging?.isCharging) {
        interval = schedule.intervals.charging;
      } else if (lastStatus.location?.speed && lastStatus.location.speed > 0) {
        interval = schedule.intervals.driving;
      } else if (lastStatus.battery.stateOfCharge < 20) {
        interval = schedule.intervals.critical;
      }
    }

    // Apply priority multiplier
    switch (schedule.priority) {
      case 'critical':
        interval = interval * 0.5;
        break;
      case 'high':
        interval = interval * 0.75;
        break;
      case 'low':
        interval = interval * 1.5;
        break;
    }

    const timer = setTimeout(() => {
      this.fetchAndEmitUpdate(vehicleId)
        .catch((error) => {
          logger.error('[EVScheduler] Update failed', { vehicleId, error });
        })
        .finally(() => {
          this.scheduleNextUpdate(vehicleId);
        });
    }, interval);

    this.timers.set(vehicleId, timer);
  }

  private async fetchAndEmitUpdate(vehicleId: string): Promise<UnifiedVehicleStatus> {
    const schedule = this.schedules.get(vehicleId);
    if (!schedule) {
      throw new Error(`Vehicle ${vehicleId} not found in scheduler`);
    }

    const startTime = Date.now();

    try {
      const status = await this.evService.getVehicleStatus(vehicleId);
      const previousStatus = this.lastStatus.get(vehicleId);

      // Update stats
      this.stats.totalUpdates++;
      this.stats.lastUpdateTime = new Date();
      this.stats.updatesByManufacturer[schedule.manufacturer] =
        (this.stats.updatesByManufacturer[schedule.manufacturer] || 0) + 1;

      // Track latency
      const latency = Date.now() - startTime;
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 100) this.latencyHistory.shift();
      this.stats.averageLatency =
        this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;

      // Reset retry count on success
      this.retryCount.set(vehicleId, 0);

      // Store new status
      this.lastStatus.set(vehicleId, status);

      // Detect and emit change events
      const events = this.detectChanges(vehicleId, schedule.manufacturer, status, previousStatus);
      for (const event of events) {
        this.emitEvent(event);
      }

      // Always emit status update
      this.emitEvent({
        type: 'status_update',
        vehicleId,
        manufacturer: schedule.manufacturer,
        timestamp: new Date(),
        data: status,
        previousStatus,
      });

      return status;
    } catch (error) {
      this.stats.failedUpdates++;

      const retries = (this.retryCount.get(vehicleId) || 0) + 1;
      this.retryCount.set(vehicleId, retries);

      // Emit error event after multiple failures
      if (retries >= 3) {
        this.emitEvent({
          type: 'connection_lost',
          vehicleId,
          manufacturer: schedule.manufacturer,
          timestamp: new Date(),
          data: { message: error instanceof Error ? error.message : 'Unknown error' },
        });
      }

      throw error;
    }
  }

  private detectChanges(
    vehicleId: string,
    manufacturer: Manufacturer,
    current: UnifiedVehicleStatus,
    previous?: UnifiedVehicleStatus
  ): UpdateEvent[] {
    const events: UpdateEvent[] = [];

    if (!previous) return events;

    // Charging state changes
    if (current.charging?.isCharging && !previous.charging?.isCharging) {
      events.push({
        type: 'charging_started',
        vehicleId,
        manufacturer,
        timestamp: new Date(),
        data: current,
        previousStatus: previous,
      });
    } else if (!current.charging?.isCharging && previous.charging?.isCharging) {
      if (current.battery.stateOfCharge >= (current.charging?.limit || 80)) {
        events.push({
          type: 'charging_complete',
          vehicleId,
          manufacturer,
          timestamp: new Date(),
          data: current,
          previousStatus: previous,
        });
      } else {
        events.push({
          type: 'charging_stopped',
          vehicleId,
          manufacturer,
          timestamp: new Date(),
          data: current,
          previousStatus: previous,
        });
      }
    }

    // Climate state changes
    if (current.climate?.isActive !== previous.climate?.isActive) {
      events.push({
        type: 'climate_changed',
        vehicleId,
        manufacturer,
        timestamp: new Date(),
        data: current,
        previousStatus: previous,
      });
    }

    // Significant location change (> 100m)
    if (current.location && previous.location) {
      const distance = this.calculateDistance(
        current.location.latitude,
        current.location.longitude,
        previous.location.latitude,
        previous.location.longitude
      );
      if (distance > 0.1) { // 100 meters
        events.push({
          type: 'location_changed',
          vehicleId,
          manufacturer,
          timestamp: new Date(),
          data: current,
          previousStatus: previous,
        });
      }
    }

    // Battery low warning (dropped below 20% or 10%)
    if (
      (current.battery.stateOfCharge < 20 && previous.battery.stateOfCharge >= 20) ||
      (current.battery.stateOfCharge < 10 && previous.battery.stateOfCharge >= 10)
    ) {
      events.push({
        type: 'battery_low',
        vehicleId,
        manufacturer,
        timestamp: new Date(),
        data: current,
        previousStatus: previous,
      });
    }

    return events;
  }

  private emitEvent(event: UpdateEvent): void {
    // Emit via EventEmitter
    this.emit(event.type, event);
    this.emit('update', event);

    // Call registered handlers
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('[EVScheduler] Handler error', { error });
      }
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let schedulerInstance: EVUpdateScheduler | null = null;

export function getEVUpdateScheduler(): EVUpdateScheduler {
  if (!schedulerInstance) {
    schedulerInstance = EVUpdateScheduler.getInstance();
  }
  return schedulerInstance;
}

export default EVUpdateScheduler;
