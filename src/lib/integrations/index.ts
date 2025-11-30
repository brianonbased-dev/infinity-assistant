/**
 * Cross-Service Integration Exports
 *
 * Integrations between infinityassistant-service and other services.
 */

export {
  mcpEVIntegration,
  getMCPEVIntegration
} from './MCPEVIntegration';
export type {
  MCPEVToolDefinition,
  MCPToolCallRequest,
  MCPToolCallResult,
  EVIntegrationConfig
} from './MCPEVIntegration';
