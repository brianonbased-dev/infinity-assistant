/**
 * Unified Build Module
 *
 * Consolidates build, deployment, and code generation services.
 * Replaces fragmented services with a single orchestration layer.
 */

export * from './types';
export * from './BuildOrchestrator';
export { buildOrchestrator, getBuildOrchestrator } from './BuildOrchestrator';
