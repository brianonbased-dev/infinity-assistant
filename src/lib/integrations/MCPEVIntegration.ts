/**
 * MCP + EV Cross-Service Integration
 *
 * Enables EV operations through the MCP Orchestrator.
 * Allows uaa2-service agents to control vehicles via infinityassistant-service.
 */

import { createSingleton } from '../createSingleton';
import { eventBus, createPayload } from '../EventBus';
import { ServiceError, internalError, externalServiceError } from '../ServiceError';
import { evService, EVService, UserVehicleConnection } from '../EV/EVService';
import { EVVehicle, BatteryState, EVCommandResult, ChargingSchedule, Manufacturer } from '../EV/types';

// ============================================================================
// Types
// ============================================================================

export interface MCPEVToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolCallRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  correlationId?: string;
}

export interface MCPToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface EVIntegrationConfig {
  /** uaa2-service MCP endpoint */
  mcpEndpoint?: string;
  /** Enable auto-registration of EV tools */
  autoRegisterTools: boolean;
  /** Emit events to uaa2 service */
  emitCrossServiceEvents: boolean;
  /** Timeout for MCP calls (ms) */
  timeout: number;
}

const DEFAULT_CONFIG: EVIntegrationConfig = {
  mcpEndpoint: process.env.UAA2_SERVICE_URL || 'http://localhost:3001',
  autoRegisterTools: true,
  emitCrossServiceEvents: true,
  timeout: 30000
};

// ============================================================================
// MCP EV Tools Definition
// ============================================================================

const EV_MCP_TOOLS: MCPEVToolDefinition[] = [
  {
    name: 'ev_list_vehicles',
    description: 'List all connected electric vehicles for a user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' }
      },
      required: ['userId']
    }
  },
  {
    name: 'ev_get_battery_status',
    description: 'Get battery and charging status for a vehicle',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' }
      },
      required: ['userId', 'vehicleId']
    }
  },
  {
    name: 'ev_start_charging',
    description: 'Start charging an electric vehicle',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' }
      },
      required: ['userId', 'vehicleId']
    }
  },
  {
    name: 'ev_stop_charging',
    description: 'Stop charging an electric vehicle',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' }
      },
      required: ['userId', 'vehicleId']
    }
  },
  {
    name: 'ev_set_charge_limit',
    description: 'Set the charge limit for a vehicle',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' },
        limit: { type: 'number', description: 'Charge limit percentage (0-100)', minimum: 50, maximum: 100 }
      },
      required: ['userId', 'vehicleId', 'limit']
    }
  },
  {
    name: 'ev_control_climate',
    description: 'Control vehicle climate (AC/heating)',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' },
        action: { type: 'string', enum: ['on', 'off'], description: 'Turn climate on or off' },
        temperature: { type: 'number', description: 'Target temperature in Celsius', minimum: 15, maximum: 30 }
      },
      required: ['userId', 'vehicleId', 'action']
    }
  },
  {
    name: 'ev_lock_unlock',
    description: 'Lock or unlock vehicle doors',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' },
        action: { type: 'string', enum: ['lock', 'unlock'], description: 'Lock or unlock doors' }
      },
      required: ['userId', 'vehicleId', 'action']
    }
  },
  {
    name: 'ev_get_location',
    description: 'Get current vehicle location',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' }
      },
      required: ['userId', 'vehicleId']
    }
  },
  {
    name: 'ev_find_charging_stations',
    description: 'Find nearby charging stations',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' },
        latitude: { type: 'number', description: 'Latitude' },
        longitude: { type: 'number', description: 'Longitude' },
        radiusKm: { type: 'number', description: 'Search radius in km', default: 25 }
      },
      required: ['userId', 'vehicleId', 'latitude', 'longitude']
    }
  },
  {
    name: 'ev_optimize_charging',
    description: 'Generate optimized charging schedule',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        vehicleId: { type: 'string', description: 'Vehicle ID' },
        targetSoC: { type: 'number', description: 'Target state of charge', minimum: 50, maximum: 100 },
        readyBy: { type: 'string', description: 'ISO timestamp for when charging should complete' },
        minimizeCost: { type: 'boolean', description: 'Optimize for cost savings', default: true }
      },
      required: ['userId', 'vehicleId', 'targetSoC']
    }
  },
  {
    name: 'ev_get_supported_manufacturers',
    description: 'Get list of supported EV manufacturers',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// ============================================================================
// MCP EV Integration Implementation
// ============================================================================

class MCPEVIntegrationImpl {
  private config: EVIntegrationConfig;
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
  private registered = false;

  constructor(config: Partial<EVIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolHandlers = new Map();
    this.registerToolHandlers();
  }

  /**
   * Register tool handlers for each EV MCP tool
   */
  private registerToolHandlers(): void {
    this.toolHandlers.set('ev_list_vehicles', async (args) => {
      const { userId } = args as { userId: string };
      return evService.getUserVehicles(userId);
    });

    this.toolHandlers.set('ev_get_battery_status', async (args) => {
      const { userId, vehicleId } = args as { userId: string; vehicleId: string };
      return evService.getBatteryState(userId, vehicleId);
    });

    this.toolHandlers.set('ev_start_charging', async (args) => {
      const { userId, vehicleId } = args as { userId: string; vehicleId: string };
      return evService.startCharging(userId, vehicleId);
    });

    this.toolHandlers.set('ev_stop_charging', async (args) => {
      const { userId, vehicleId } = args as { userId: string; vehicleId: string };
      return evService.stopCharging(userId, vehicleId);
    });

    this.toolHandlers.set('ev_set_charge_limit', async (args) => {
      const { userId, vehicleId, limit } = args as { userId: string; vehicleId: string; limit: number };
      return evService.setChargeLimit(userId, vehicleId, limit);
    });

    this.toolHandlers.set('ev_control_climate', async (args) => {
      const { userId, vehicleId, action, temperature } = args as {
        userId: string;
        vehicleId: string;
        action: 'on' | 'off';
        temperature?: number;
      };
      return evService.setClimate(userId, vehicleId, action === 'on', temperature);
    });

    this.toolHandlers.set('ev_lock_unlock', async (args) => {
      const { userId, vehicleId, action } = args as {
        userId: string;
        vehicleId: string;
        action: 'lock' | 'unlock';
      };
      return action === 'lock'
        ? evService.lockDoors(userId, vehicleId)
        : evService.unlockDoors(userId, vehicleId);
    });

    this.toolHandlers.set('ev_get_location', async (args) => {
      const { userId, vehicleId } = args as { userId: string; vehicleId: string };
      return evService.getLocation(userId, vehicleId);
    });

    this.toolHandlers.set('ev_find_charging_stations', async (args) => {
      const { userId, vehicleId, latitude, longitude, radiusKm } = args as {
        userId: string;
        vehicleId: string;
        latitude: number;
        longitude: number;
        radiusKm?: number;
      };
      return evService.findChargingStations(userId, vehicleId, latitude, longitude, radiusKm);
    });

    this.toolHandlers.set('ev_optimize_charging', async (args) => {
      const { userId, vehicleId, targetSoC, readyBy, minimizeCost } = args as {
        userId: string;
        vehicleId: string;
        targetSoC: number;
        readyBy?: string;
        minimizeCost?: boolean;
      };
      return evService.generateChargingSchedule(userId, vehicleId, {
        targetSoC,
        readyBy: readyBy ? new Date(readyBy) : undefined,
        minimizeCost: minimizeCost ?? true,
        useGridPricing: true
      });
    });

    this.toolHandlers.set('ev_get_supported_manufacturers', async () => {
      return evService.getSupportedManufacturers();
    });
  }

  /**
   * Get all EV tool definitions for MCP registration
   */
  getToolDefinitions(): MCPEVToolDefinition[] {
    return [...EV_MCP_TOOLS];
  }

  /**
   * Execute an EV tool by name
   */
  async executeTool(request: MCPToolCallRequest): Promise<MCPToolCallResult> {
    const startTime = Date.now();

    const handler = this.toolHandlers.get(request.toolName);
    if (!handler) {
      return {
        success: false,
        error: `Unknown EV tool: ${request.toolName}`,
        executionTimeMs: Date.now() - startTime
      };
    }

    try {
      const result = await Promise.race([
        handler(request.arguments),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
        )
      ]);

      // Emit cross-service event
      if (this.config.emitCrossServiceEvents) {
        eventBus.emit('mcp.ev_tool_executed', createPayload('MCPEVIntegration', {
          toolName: request.toolName,
          correlationId: request.correlationId,
          success: true
        }));
      }

      return {
        success: true,
        result,
        executionTimeMs: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.config.emitCrossServiceEvents) {
        eventBus.emit('mcp.ev_tool_error', createPayload('MCPEVIntegration', {
          toolName: request.toolName,
          correlationId: request.correlationId,
          error: errorMessage
        }));
      }

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Register EV tools with uaa2-service MCP Orchestrator
   */
  async registerWithMCPOrchestrator(): Promise<boolean> {
    if (this.registered || !this.config.autoRegisterTools) {
      return this.registered;
    }

    try {
      const endpoint = `${this.config.mcpEndpoint}/api/mcp/register-tools`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'infinityassistant-service',
          tools: this.getToolDefinitions().map(tool => ({
            ...tool,
            serverId: 'infinityassistant-ev',
            serverName: 'Infinity Assistant EV Service'
          }))
        })
      });

      if (response.ok) {
        this.registered = true;
        console.log('[MCP-EV] Successfully registered EV tools with uaa2-service');
        return true;
      }

      console.warn('[MCP-EV] Failed to register tools:', await response.text());
      return false;
    } catch (error) {
      // uaa2-service might not be running - that's okay
      console.debug('[MCP-EV] Could not reach uaa2-service for tool registration:', error);
      return false;
    }
  }

  /**
   * Create an HTTP handler for incoming MCP tool calls from uaa2-service
   */
  createToolHandler() {
    return async (req: Request): Promise<Response> => {
      try {
        const body = await req.json() as MCPToolCallRequest;
        const result = await this.executeTool(body);

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request',
          executionTimeMs: 0
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };
  }

  /**
   * Health check
   */
  getHealth(): { healthy: boolean; toolsRegistered: boolean; toolCount: number } {
    return {
      healthy: true,
      toolsRegistered: this.registered,
      toolCount: this.toolHandlers.size
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const getMCPEVIntegration = createSingleton(
  () => new MCPEVIntegrationImpl(),
  { name: 'MCPEVIntegration' }
);

export const mcpEVIntegration = getMCPEVIntegration.instance;

export default mcpEVIntegration;
