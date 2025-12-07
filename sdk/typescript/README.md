# Infinity Assistant TypeScript SDK

Official TypeScript/JavaScript SDK for the Infinity Assistant API.

## Installation

```bash
npm install @infinityassistant/sdk
# or
yarn add @infinityassistant/sdk
# or
pnpm add @infinityassistant/sdk
```

## Quick Start

```typescript
import { InfinityAssistantClient } from '@infinityassistant/sdk';

// Initialize client
const client = new InfinityAssistantClient({
  apiKey: 'ia_your_api_key_here',
  baseUrl: 'https://infinityassistant.io/api', // optional, defaults to production
});

// Send a chat message
const response = await client.chat({
  message: 'Hello, how can you help me?',
});

console.log(response.response);
```

## Authentication

### API Key Authentication (Recommended)

```typescript
const client = new InfinityAssistantClient({
  apiKey: 'ia_your_api_key_here',
});
```

Get your API key from the [Infinity Assistant Dashboard](https://infinityassistant.io/dashboard).

### Setting API Key After Initialization

```typescript
const client = new InfinityAssistantClient();
client.setApiKey('ia_your_api_key_here');
```

## Features

### Chat

#### Basic Chat

```typescript
const response = await client.chat({
  message: 'What is the capital of France?',
});

console.log(response.response);
```

#### Chat with Context

```typescript
const response = await client.chat({
  message: 'What did we discuss earlier?',
  conversationId: 'conv_1234567890',
  mode: 'assist',
  preferences: {
    assistantMode: 'professional',
  },
});
```

#### Streaming Chat

```typescript
for await (const chunk of client.chatStream({
  message: 'Tell me a story',
})) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'metadata') {
    console.log('Metadata:', chunk.metadata);
  } else if (chunk.type === 'done') {
    console.log('\nDone!');
    break;
  } else if (chunk.type === 'error') {
    console.error('Error:', chunk.error);
    break;
  }
}
```

### Knowledge Base

```typescript
// Search knowledge base
const results = await client.searchKnowledge({
  query: 'best practices for TypeScript',
  limit: 10,
  filters: {
    type: 'wisdom',
    tags: ['typescript', 'programming'],
  },
});

console.log(`Found ${results.total} results`);
results.results?.forEach(result => {
  console.log(`- ${result.title}: ${result.content}`);
});
```

### Memory

```typescript
// Store memory
await client.storeMemory({
  key: 'user_preference',
  value: { theme: 'dark', language: 'en' },
  ttl: 3600, // 1 hour
});

// Retrieve memory
const memory = await client.retrieveMemory({
  key: 'user_preference',
});

if (memory.found) {
  console.log('Preference:', memory.value);
}
```

### Research

```typescript
const research = await client.research({
  query: 'latest developments in AI',
  depth: 'deep',
  sources: 5,
});

console.log('Summary:', research.summary);
research.results?.forEach(result => {
  console.log(`- ${result.title}: ${result.url}`);
});
```

### API Key Management

```typescript
// List API keys
const { apiKeys } = await client.listApiKeys();
console.log('API Keys:', apiKeys);

// Create new API key
const { apiKey } = await client.createApiKey('My App');
console.log('New API Key:', apiKey.key); // Save this - shown only once!

// Delete API key
await client.deleteApiKey(apiKey.id);
```

### Webhooks

```typescript
// List webhooks
const { webhooks } = await client.listWebhooks();
console.log('Webhooks:', webhooks);

// Create webhook
const { webhook } = await client.createWebhook(
  'https://your-app.com/webhooks',
  ['chat.message', 'chat.response']
);
console.log('Webhook Secret:', webhook.secret); // Save this!

// Delete webhook
await client.deleteWebhook(webhook.id);
```

## Error Handling

The SDK provides custom error classes for better error handling:

```typescript
import {
  InfinityAssistantError,
  InfinityAssistantRateLimitError,
  InfinityAssistantTimeoutError,
} from '@infinityassistant/sdk';

try {
  const response = await client.chat({ message: 'Hello' });
} catch (error) {
  if (error instanceof InfinityAssistantRateLimitError) {
    console.error('Rate limit exceeded. Please wait.');
  } else if (error instanceof InfinityAssistantTimeoutError) {
    console.error('Request timeout. Please try again.');
  } else if (error instanceof InfinityAssistantError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Error Code:', error.code);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Configuration

```typescript
const client = new InfinityAssistantClient({
  apiKey: 'ia_your_api_key_here',
  baseUrl: 'https://infinityassistant.io/api', // optional
  timeout: 60000, // 60 seconds, optional
  maxRetries: 3, // optional
  retryDelay: 1000, // 1 second, optional
  fetch: customFetch, // custom fetch implementation, optional
});
```

## Retry Logic

The SDK automatically retries failed requests with exponential backoff:
- Network errors: Retries up to `maxRetries` times
- Rate limit errors: Respects `Retry-After` header
- Timeout errors: Retries with exponential backoff

## TypeScript Support

Full TypeScript support with type definitions included:

```typescript
import type {
  ChatRequest,
  ChatResponse,
  KnowledgeSearchRequest,
  // ... all types exported
} from '@infinityassistant/sdk';
```

## Browser Support

Works in both Node.js and browser environments:

```typescript
// Node.js
import { InfinityAssistantClient } from '@infinityassistant/sdk';

// Browser (ES modules)
import { InfinityAssistantClient } from '@infinityassistant/sdk';

// Browser (UMD - if needed)
const { InfinityAssistantClient } = require('@infinityassistant/sdk');
```

## Examples

See the [examples directory](./examples) for more usage examples.

## API Reference

Full API reference available at [https://infinityassistant.io/docs](https://infinityassistant.io/docs).

## Support

- Documentation: [https://infinityassistant.io/docs](https://infinityassistant.io/docs)
- Issues: [GitHub Issues](https://github.com/infinityassistant/infinityassistant-service/issues)
- Support: [support@infinityassistant.io](mailto:support@infinityassistant.io)

## License

MIT

