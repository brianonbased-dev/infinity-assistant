/**
 * Infinity Assistant TypeScript SDK
 * 
 * Official SDK for Infinity Assistant API
 * 
 * @example
 * ```typescript
 * import { InfinityAssistantClient } from '@infinityassistant/sdk';
 * 
 * const client = new InfinityAssistantClient({
 *   apiKey: 'ia_your_api_key_here'
 * });
 * 
 * const response = await client.chat({
 *   message: 'Hello, how can you help me?'
 * });
 * 
 * console.log(response.response);
 * ```
 */

export { InfinityAssistantClient } from './client';
export * from './types';

// Default export
export { InfinityAssistantClient as default } from './client';

