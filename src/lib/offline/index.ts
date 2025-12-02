/**
 * Offline Module
 *
 * Provides offline-first capabilities for the Infinity Assistant.
 */

export {
  OfflinePersistenceService,
  getOfflinePersistence,
  type OfflineConversation,
  type OfflineMessage,
  type OfflineMemory,
  type OfflineKnowledge,
  type OfflinePreferences,
  type OfflineStatus,
  type SyncQueueItem,
} from './OfflinePersistenceService';

export {
  OfflineAssistantService,
  getOfflineAssistant,
  type OfflineResponse,
} from './OfflineAssistantService';
