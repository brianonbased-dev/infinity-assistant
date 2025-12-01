/**
 * Device Mesh Service
 *
 * Manages user's IoT device network including:
 * - Mobile devices (phones, tablets, wearables)
 * - Vehicles (EV integration, car systems)
 * - Home automation (hubs, sensors, appliances)
 * - Robotics (robots, drones, automated systems)
 * - Smart appliances (cooking equipment, entertainment)
 *
 * Features:
 * - Device registration and discovery
 * - Real-time status monitoring
 * - Command routing to devices
 * - Event aggregation from devices
 * - Scene/automation execution
 * - Energy optimization across devices
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';
import { meshNodeClient, type MeshLevel, type UserDevice } from './MeshNodeClient';

// ============================================================================
// TYPES
// ============================================================================

export type DeviceCategory =
  | 'mobile'      // Phones, tablets, wearables
  | 'vehicle'     // EVs, cars, motorcycles
  | 'home-hub'    // Smart home hubs, controllers
  | 'sensor'      // Environmental sensors, security
  | 'appliance'   // Kitchen, laundry, entertainment
  | 'lighting'    // Smart lights, switches
  | 'climate'     // HVAC, thermostats
  | 'security'    // Cameras, locks, alarms
  | 'robot'       // Robots, vacuums, lawn mowers
  | 'entertainment' // TVs, speakers, gaming
  | 'energy'      // Solar, batteries, EV chargers
  | 'health';     // Fitness, medical devices

export type DeviceProtocol =
  | 'mqtt'
  | 'websocket'
  | 'http'
  | 'bluetooth'
  | 'zigbee'
  | 'zwave'
  | 'matter'
  | 'homekit'
  | 'custom';

export interface DeviceCapability {
  name: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'object';
  readable: boolean;
  writable: boolean;
  values?: string[]; // For enum type
  min?: number;      // For number type
  max?: number;      // For number type
  unit?: string;     // For number type
}

export interface DeviceState {
  [key: string]: unknown;
}

export interface MeshDevice {
  id: string;
  userId: string;
  name: string;
  category: DeviceCategory;
  protocol: DeviceProtocol;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  capabilities: DeviceCapability[];
  state: DeviceState;
  status: 'online' | 'offline' | 'error' | 'updating';
  lastSeen: Date;
  lastStateChange: Date;
  batteryLevel?: number;
  signalStrength?: number;
  location?: {
    room?: string;
    zone?: string;
    coordinates?: { lat: number; lng: number };
  };
  metadata?: Record<string, unknown>;
}

export interface DeviceCommand {
  deviceId: string;
  capability: string;
  value: unknown;
  requestId?: string;
}

export interface DeviceEvent {
  deviceId: string;
  type: 'state_change' | 'alert' | 'error' | 'info';
  capability?: string;
  oldValue?: unknown;
  newValue?: unknown;
  message?: string;
  timestamp: Date;
}

export interface Scene {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  actions: Array<{
    deviceId: string;
    capability: string;
    value: unknown;
    delay?: number; // ms delay before executing
  }>;
  triggers?: Array<{
    type: 'schedule' | 'device_state' | 'location' | 'voice' | 'manual';
    config: Record<string, unknown>;
  }>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Automation {
  id: string;
  userId: string;
  name: string;
  description?: string;
  condition: {
    type: 'all' | 'any';
    rules: Array<{
      deviceId: string;
      capability: string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
      value: unknown;
    }>;
  };
  actions: Array<{
    deviceId: string;
    capability: string;
    value: unknown;
  }>;
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface EnergyMetrics {
  userId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  consumption: {
    total: number;
    byCategory: Record<DeviceCategory, number>;
    byDevice: Record<string, number>;
  };
  generation?: {
    solar: number;
    other: number;
  };
  storage?: {
    batteryLevel: number;
    capacity: number;
  };
  evCharging?: {
    energyUsed: number;
    sessionsCount: number;
    avgSessionDuration: number;
  };
  timestamp: Date;
}

// ============================================================================
// DEVICE MESH SERVICE
// ============================================================================

class DeviceMeshService extends EventEmitter {
  private static instance: DeviceMeshService | null = null;
  private devices: Map<string, MeshDevice> = new Map();
  private devicesByUser: Map<string, Set<string>> = new Map();
  private scenes: Map<string, Scene> = new Map();
  private automations: Map<string, Automation> = new Map();
  private eventLog: DeviceEvent[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    logger.info('[DeviceMesh] Service initialized');
  }

  static getInstance(): DeviceMeshService {
    if (!DeviceMeshService.instance) {
      DeviceMeshService.instance = new DeviceMeshService();
    }
    return DeviceMeshService.instance;
  }

  // ============================================================================
  // DEVICE REGISTRATION
  // ============================================================================

  /**
   * Register a new device
   */
  async registerDevice(device: Omit<MeshDevice, 'status' | 'lastSeen' | 'lastStateChange'>): Promise<MeshDevice> {
    const meshDevice: MeshDevice = {
      ...device,
      status: 'online',
      lastSeen: new Date(),
      lastStateChange: new Date(),
    };

    this.devices.set(device.id, meshDevice);

    // Index by user
    if (!this.devicesByUser.has(device.userId)) {
      this.devicesByUser.set(device.userId, new Set());
    }
    this.devicesByUser.get(device.userId)!.add(device.id);

    // Register with UAA2 mesh
    await this.registerWithMesh(meshDevice);

    logger.info('[DeviceMesh] Device registered', {
      deviceId: device.id,
      category: device.category,
      userId: device.userId,
    });

    this.emit('deviceRegistered', meshDevice);
    return meshDevice;
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    this.devices.delete(deviceId);

    // Clean up user index
    const userDevices = this.devicesByUser.get(device.userId);
    if (userDevices) {
      userDevices.delete(deviceId);
      if (userDevices.size === 0) {
        this.devicesByUser.delete(device.userId);
      }
    }

    logger.info('[DeviceMesh] Device unregistered', { deviceId });
    this.emit('deviceUnregistered', { deviceId, userId: device.userId });
    return true;
  }

  /**
   * Register device with UAA2 mesh network
   */
  private async registerWithMesh(device: MeshDevice): Promise<boolean> {
    const userDevice: UserDevice = {
      id: device.id,
      userId: device.userId,
      type: this.categoryToNodeType(device.category),
      name: device.name,
      capabilities: device.capabilities.map(c => c.name),
      status: device.status === 'online' ? 'online' : 'offline',
      lastSeen: device.lastSeen,
      metadata: {
        category: device.category,
        protocol: device.protocol,
        manufacturer: device.manufacturer,
        model: device.model,
      },
    };

    return meshNodeClient.registerUserDeviceWithMesh(userDevice);
  }

  private categoryToNodeType(category: DeviceCategory): UserDevice['type'] {
    switch (category) {
      case 'mobile':
        return 'mobile';
      case 'vehicle':
        return 'vehicle';
      case 'home-hub':
        return 'home-hub';
      case 'robot':
        return 'robot';
      default:
        return 'appliance';
    }
  }

  // ============================================================================
  // DEVICE QUERIES
  // ============================================================================

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): MeshDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all devices for a user
   */
  getUserDevices(userId: string): MeshDevice[] {
    const deviceIds = this.devicesByUser.get(userId);
    if (!deviceIds) return [];

    return Array.from(deviceIds)
      .map(id => this.devices.get(id))
      .filter((d): d is MeshDevice => d !== undefined);
  }

  /**
   * Get devices by category
   */
  getDevicesByCategory(userId: string, category: DeviceCategory): MeshDevice[] {
    return this.getUserDevices(userId).filter(d => d.category === category);
  }

  /**
   * Get devices by location
   */
  getDevicesByRoom(userId: string, room: string): MeshDevice[] {
    return this.getUserDevices(userId).filter(d => d.location?.room === room);
  }

  /**
   * Get online devices
   */
  getOnlineDevices(userId: string): MeshDevice[] {
    return this.getUserDevices(userId).filter(d => d.status === 'online');
  }

  /**
   * Search devices by capability
   */
  findDevicesWithCapability(userId: string, capabilityName: string): MeshDevice[] {
    return this.getUserDevices(userId).filter(d =>
      d.capabilities.some(c => c.name === capabilityName)
    );
  }

  // ============================================================================
  // DEVICE CONTROL
  // ============================================================================

  /**
   * Send command to device
   */
  async sendCommand(command: DeviceCommand): Promise<{ success: boolean; error?: string }> {
    const device = this.devices.get(command.deviceId);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    if (device.status !== 'online') {
      return { success: false, error: 'Device is offline' };
    }

    const capability = device.capabilities.find(c => c.name === command.capability);
    if (!capability) {
      return { success: false, error: `Unknown capability: ${command.capability}` };
    }

    if (!capability.writable) {
      return { success: false, error: `Capability ${command.capability} is read-only` };
    }

    // Validate value type
    const validationError = this.validateValue(capability, command.value);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // In real implementation, this would send to the actual device
    // For now, we simulate by updating local state
    const oldValue = device.state[command.capability];
    device.state[command.capability] = command.value;
    device.lastStateChange = new Date();

    // Log event
    this.logEvent({
      deviceId: command.deviceId,
      type: 'state_change',
      capability: command.capability,
      oldValue,
      newValue: command.value,
      timestamp: new Date(),
    });

    logger.debug('[DeviceMesh] Command sent', {
      deviceId: command.deviceId,
      capability: command.capability,
      value: command.value,
    });

    this.emit('commandSent', command);
    this.checkAutomations(device.userId, command.deviceId, command.capability, command.value);

    return { success: true };
  }

  /**
   * Batch send commands
   */
  async sendCommands(commands: DeviceCommand[]): Promise<Array<{ deviceId: string; success: boolean; error?: string }>> {
    const results = await Promise.all(commands.map(async cmd => ({
      deviceId: cmd.deviceId,
      ...(await this.sendCommand(cmd)),
    })));
    return results;
  }

  /**
   * Get device state
   */
  getDeviceState(deviceId: string): DeviceState | null {
    const device = this.devices.get(deviceId);
    return device?.state ?? null;
  }

  /**
   * Update device state (from device push)
   */
  updateDeviceState(deviceId: string, state: Partial<DeviceState>): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    // Track changes for events
    for (const [key, newValue] of Object.entries(state)) {
      const oldValue = device.state[key];
      if (oldValue !== newValue) {
        this.logEvent({
          deviceId,
          type: 'state_change',
          capability: key,
          oldValue,
          newValue,
          timestamp: new Date(),
        });
      }
    }

    device.state = { ...device.state, ...state };
    device.lastStateChange = new Date();
    device.lastSeen = new Date();

    this.emit('stateUpdated', { deviceId, state });

    // Check automations
    for (const [key, value] of Object.entries(state)) {
      this.checkAutomations(device.userId, deviceId, key, value);
    }

    return true;
  }

  private validateValue(capability: DeviceCapability, value: unknown): string | null {
    switch (capability.type) {
      case 'boolean':
        if (typeof value !== 'boolean') return 'Expected boolean value';
        break;
      case 'number':
        if (typeof value !== 'number') return 'Expected number value';
        if (capability.min !== undefined && value < capability.min) {
          return `Value must be >= ${capability.min}`;
        }
        if (capability.max !== undefined && value > capability.max) {
          return `Value must be <= ${capability.max}`;
        }
        break;
      case 'string':
        if (typeof value !== 'string') return 'Expected string value';
        break;
      case 'enum':
        if (!capability.values?.includes(value as string)) {
          return `Value must be one of: ${capability.values?.join(', ')}`;
        }
        break;
    }
    return null;
  }

  // ============================================================================
  // SCENES
  // ============================================================================

  /**
   * Create a scene
   */
  createScene(scene: Omit<Scene, 'createdAt' | 'updatedAt'>): Scene {
    const fullScene: Scene = {
      ...scene,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.scenes.set(scene.id, fullScene);
    logger.info('[DeviceMesh] Scene created', { sceneId: scene.id, name: scene.name });
    this.emit('sceneCreated', fullScene);
    return fullScene;
  }

  /**
   * Execute a scene
   */
  async executeScene(sceneId: string): Promise<{ success: boolean; results: Array<{ deviceId: string; success: boolean }> }> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return { success: false, results: [] };
    }

    if (!scene.enabled) {
      return { success: false, results: [] };
    }

    const results: Array<{ deviceId: string; success: boolean }> = [];

    // Execute actions in order with delays
    for (const action of scene.actions) {
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }

      const result = await this.sendCommand({
        deviceId: action.deviceId,
        capability: action.capability,
        value: action.value,
      });

      results.push({ deviceId: action.deviceId, success: result.success });
    }

    logger.info('[DeviceMesh] Scene executed', { sceneId, resultsCount: results.length });
    this.emit('sceneExecuted', { sceneId, results });

    return {
      success: results.every(r => r.success),
      results,
    };
  }

  /**
   * Get user scenes
   */
  getUserScenes(userId: string): Scene[] {
    return Array.from(this.scenes.values()).filter(s => s.userId === userId);
  }

  // ============================================================================
  // AUTOMATIONS
  // ============================================================================

  /**
   * Create an automation
   */
  createAutomation(automation: Omit<Automation, 'triggerCount' | 'lastTriggered'>): Automation {
    const fullAutomation: Automation = {
      ...automation,
      triggerCount: 0,
    };

    this.automations.set(automation.id, fullAutomation);
    logger.info('[DeviceMesh] Automation created', { automationId: automation.id, name: automation.name });
    this.emit('automationCreated', fullAutomation);
    return fullAutomation;
  }

  /**
   * Check and run automations based on device state change
   */
  private async checkAutomations(userId: string, deviceId: string, capability: string, value: unknown): Promise<void> {
    const userAutomations = Array.from(this.automations.values()).filter(
      a => a.userId === userId && a.enabled
    );

    for (const automation of userAutomations) {
      // Check if this state change affects any rules
      const affectedRules = automation.condition.rules.filter(
        r => r.deviceId === deviceId && r.capability === capability
      );

      if (affectedRules.length === 0) continue;

      // Evaluate all conditions
      const conditionMet = this.evaluateCondition(automation.condition);

      if (conditionMet) {
        await this.executeAutomation(automation);
      }
    }
  }

  private evaluateCondition(condition: Automation['condition']): boolean {
    const results = condition.rules.map(rule => {
      const device = this.devices.get(rule.deviceId);
      if (!device) return false;

      const currentValue = device.state[rule.capability];
      return this.evaluateRule(currentValue, rule.operator, rule.value);
    });

    return condition.type === 'all'
      ? results.every(r => r)
      : results.some(r => r);
  }

  private evaluateRule(current: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'eq': return current === expected;
      case 'ne': return current !== expected;
      case 'gt': return (current as number) > (expected as number);
      case 'lt': return (current as number) < (expected as number);
      case 'gte': return (current as number) >= (expected as number);
      case 'lte': return (current as number) <= (expected as number);
      case 'contains': return String(current).includes(String(expected));
      default: return false;
    }
  }

  private async executeAutomation(automation: Automation): Promise<void> {
    logger.info('[DeviceMesh] Automation triggered', { automationId: automation.id });

    automation.lastTriggered = new Date();
    automation.triggerCount++;

    for (const action of automation.actions) {
      await this.sendCommand({
        deviceId: action.deviceId,
        capability: action.capability,
        value: action.value,
      });
    }

    this.emit('automationTriggered', automation);
  }

  /**
   * Get user automations
   */
  getUserAutomations(userId: string): Automation[] {
    return Array.from(this.automations.values()).filter(a => a.userId === userId);
  }

  // ============================================================================
  // ENERGY & METRICS
  // ============================================================================

  /**
   * Get energy metrics for user
   */
  getEnergyMetrics(userId: string, period: EnergyMetrics['period'] = 'day'): EnergyMetrics {
    const devices = this.getUserDevices(userId);

    // Calculate consumption by category and device
    const byCategory: Record<DeviceCategory, number> = {} as Record<DeviceCategory, number>;
    const byDevice: Record<string, number> = {};

    for (const device of devices) {
      const consumption = (device.state.energyConsumption as number) || 0;
      byCategory[device.category] = (byCategory[device.category] || 0) + consumption;
      byDevice[device.id] = consumption;
    }

    const total = Object.values(byDevice).reduce((sum, v) => sum + v, 0);

    // Get solar/battery info from energy devices
    const energyDevices = devices.filter(d => d.category === 'energy');
    let solarGeneration = 0;
    let batteryLevel = 0;
    let batteryCapacity = 0;

    for (const device of energyDevices) {
      solarGeneration += (device.state.solarOutput as number) || 0;
      if (device.state.batteryLevel !== undefined) {
        batteryLevel = device.state.batteryLevel as number;
        batteryCapacity = device.state.batteryCapacity as number || 0;
      }
    }

    // Get EV charging info
    const vehicles = devices.filter(d => d.category === 'vehicle');
    let evEnergyUsed = 0;
    let chargingSessions = 0;

    for (const vehicle of vehicles) {
      evEnergyUsed += (vehicle.state.chargingEnergyUsed as number) || 0;
      chargingSessions += (vehicle.state.chargingSessionsToday as number) || 0;
    }

    return {
      userId,
      period,
      consumption: {
        total,
        byCategory,
        byDevice,
      },
      generation: solarGeneration > 0 ? {
        solar: solarGeneration,
        other: 0,
      } : undefined,
      storage: batteryCapacity > 0 ? {
        batteryLevel,
        capacity: batteryCapacity,
      } : undefined,
      evCharging: evEnergyUsed > 0 ? {
        energyUsed: evEnergyUsed,
        sessionsCount: chargingSessions,
        avgSessionDuration: 0, // Would calculate from actual data
      } : undefined,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // EVENTS & HISTORY
  // ============================================================================

  private logEvent(event: DeviceEvent): void {
    this.eventLog.push(event);
    this.emit('deviceEvent', event);

    // Keep only last 10000 events
    if (this.eventLog.length > 10000) {
      this.eventLog = this.eventLog.slice(-10000);
    }
  }

  /**
   * Get device event history
   */
  getDeviceEvents(deviceId: string, limit: number = 100): DeviceEvent[] {
    return this.eventLog
      .filter(e => e.deviceId === deviceId)
      .slice(-limit);
  }

  /**
   * Get user event history
   */
  getUserEvents(userId: string, limit: number = 100): DeviceEvent[] {
    const userDeviceIds = this.devicesByUser.get(userId);
    if (!userDeviceIds) return [];

    return this.eventLog
      .filter(e => userDeviceIds.has(e.deviceId))
      .slice(-limit);
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  /**
   * Start device health monitoring
   */
  startHealthMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkDeviceHealth();
    }, intervalMs);

    logger.info('[DeviceMesh] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private checkDeviceHealth(): void {
    const now = Date.now();
    const offlineThreshold = 5 * 60 * 1000; // 5 minutes

    for (const device of this.devices.values()) {
      const timeSinceLastSeen = now - device.lastSeen.getTime();

      if (timeSinceLastSeen > offlineThreshold && device.status === 'online') {
        device.status = 'offline';
        this.emit('deviceOffline', { deviceId: device.id });
        this.logEvent({
          deviceId: device.id,
          type: 'alert',
          message: 'Device went offline',
          timestamp: new Date(),
        });
      }
    }
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get device mesh statistics
   */
  getStats(): {
    totalDevices: number;
    onlineDevices: number;
    byCategory: Record<DeviceCategory, number>;
    byProtocol: Record<DeviceProtocol, number>;
    totalScenes: number;
    totalAutomations: number;
    eventsLogged: number;
  } {
    const byCategory: Record<DeviceCategory, number> = {} as Record<DeviceCategory, number>;
    const byProtocol: Record<DeviceProtocol, number> = {} as Record<DeviceProtocol, number>;
    let onlineCount = 0;

    for (const device of this.devices.values()) {
      byCategory[device.category] = (byCategory[device.category] || 0) + 1;
      byProtocol[device.protocol] = (byProtocol[device.protocol] || 0) + 1;
      if (device.status === 'online') onlineCount++;
    }

    return {
      totalDevices: this.devices.size,
      onlineDevices: onlineCount,
      byCategory,
      byProtocol,
      totalScenes: this.scenes.size,
      totalAutomations: this.automations.size,
      eventsLogged: this.eventLog.length,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let deviceMeshInstance: DeviceMeshService | null = null;

export function getDeviceMeshService(): DeviceMeshService {
  if (!deviceMeshInstance) {
    deviceMeshInstance = DeviceMeshService.getInstance();
  }
  return deviceMeshInstance;
}

export default DeviceMeshService;
