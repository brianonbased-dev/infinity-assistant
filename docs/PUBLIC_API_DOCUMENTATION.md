# Infinity Assistant - Public API Documentation

**Version**: 1.0.0  
**Base URL**: `https://infinityassistant.io/api`  
**Status**: ✅ Production Ready

---

## 🚀 Quick Start

### Get Your API Key

1. Sign up at [infinityassistant.io](https://infinityassistant.io)
2. Go to Dashboard → API Keys
3. Create a new API key
4. Copy and store securely (shown only once!)

### Using the SDK (Recommended)

The easiest way to get started is with our official TypeScript/JavaScript SDK:

```bash
npm install @infinityassistant/sdk
```

```typescript
import { InfinityAssistantClient } from '@infinityassistant/sdk';

const client = new InfinityAssistantClient({
  apiKey: 'ia_your_api_key_here',
});

// Send a chat message
const response = await client.chat({
  message: 'Hello, Infinity Assistant!',
});

console.log(response.response);
```

**Learn more**: 
- [TypeScript SDK Documentation](../sdk/typescript/README.md)
- [Python SDK Documentation](../sdk/python/README.md)

### Try It Out (No Code Required)

Use our interactive [API Playground](/developers/playground) to test endpoints without writing any code.

### Your First API Call (cURL)

```bash
curl -X POST https://infinityassistant.io/api/chat \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, Infinity Assistant!"
  }'
```

---

## 🔐 Authentication

### API Key Authentication (Recommended)

Include your API key in the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_KEY
```

### Email Authentication

For web applications, use email-based session cookies:

```javascript
// After user signs in via web interface
// Session cookie is automatically set
fetch('/api/chat', {
  credentials: 'include'
});
```

### Anonymous Users

Some endpoints support anonymous access with a session cookie:

```javascript
// Anonymous user ID is automatically generated
fetch('/api/chat', {
  credentials: 'include'
});
```

---

## 📡 API Endpoints

### Chat API

#### POST /api/chat

Send a message to the Infinity Assistant.

**Using the SDK**:
```typescript
import { InfinityAssistantClient } from '@infinityassistant/sdk';

const client = new InfinityAssistantClient({ apiKey: 'ia_your_key' });

const response = await client.chat({
  message: 'What is artificial intelligence?',
  conversationId: 'conv_123', // Optional: Continue existing conversation
  mode: 'assist', // Optional: 'search' | 'assist' | 'build'
});

console.log(response.response);
```

**Streaming with SDK**:
```typescript
for await (const chunk of client.chatStream({
  message: 'Tell me a story',
})) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'done') {
    break;
  }
}
```

**Request**:
```json
{
  "message": "What is artificial intelligence?",
  "conversation_id": "conv_123",  // Optional: Continue existing conversation
  "stream": false,                 // Optional: Enable streaming (default: false)
  "context": {                     // Optional: Additional context
    "user_id": "user_123",
    "preferences": {}
  }
}
```

**Response** (Non-streaming):
```json
{
  "success": true,
  "data": {
    "message_id": "msg_123",
    "conversation_id": "conv_123",
    "response": "Artificial intelligence (AI) is...",
    "timestamp": "2025-02-05T12:00:00Z",
    "tokens_used": 150,
    "model": "claude-3-5-sonnet"
  }
}
```

**Response** (Streaming):
```
data: {"type": "chunk", "content": "Artificial"}
data: {"type": "chunk", "content": " intelligence"}
data: {"type": "complete", "message_id": "msg_123"}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 60 seconds.",
    "retry_after": 60
  }
}
```

**Rate Limit**: 100 requests per minute per API key

---

### Search API

#### POST /api/search

Search the Infinity Assistant knowledge base.

**Request**:
```json
{
  "query": "autonomous learning",
  "limit": 10,              // Optional: Max results (default: 10)
  "types": ["wisdom", "pattern"],  // Optional: Filter by type
  "domain": "AI"            // Optional: Filter by domain
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "W.999",
        "type": "wisdom",
        "title": "Always audit existing code",
        "content": "Search for existing implementations first...",
        "domain": "AI",
        "relevance_score": 0.95,
        "tags": ["development", "best-practices"]
      }
    ],
    "total": 1,
    "query_time_ms": 45
  }
}
```

**Rate Limit**: 200 requests per minute per API key

---

#### GET /api/search

Get search suggestions (autocomplete).

**Request**:
```
GET /api/search?q=autonomous&limit=5
```

**Response**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "autonomous learning",
      "autonomous agents",
      "autonomous systems"
    ]
  }
}
```

---

### Onboarding API

#### GET /api/onboarding/check

Check if user needs onboarding.

**Request**:
```
GET /api/onboarding/check?userId=user_123
```

**Response**:
```json
{
  "needsOnboarding": true,
  "onboarding": null,
  "preferences": null,
  "hasConversations": false
}
```

---

#### POST /api/onboarding/complete

Mark onboarding as complete.

**Request**:
```json
{
  "user_id": "user_123",
  "preferences": {
    "product": "assistant",
    "experience_level": "intermediate"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "onboarding_id": "onboard_123",
    "completed_at": "2025-02-05T12:00:00Z"
  }
}
```

---

#### POST /api/onboarding/skip

Mark onboarding as skipped.

**Request**:
```json
{
  "user_id": "user_123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "onboarding_id": "onboard_123",
    "skipped_at": "2025-02-05T12:00:00Z"
  }
}
```

---

### User API

#### GET /api/user/preferences

Get user preferences.

**Request**:
```
GET /api/user/preferences
Authorization: Bearer YOUR_API_KEY
```

**Response**:
```json
{
  "success": true,
  "data": {
    "product": "assistant",
    "experience_level": "intermediate",
    "theme": "dark",
    "notifications": true
  }
}
```

---

#### GET /api/user/usage

Get user usage statistics.

**Request**:
```
GET /api/user/usage?period=month
Authorization: Bearer YOUR_API_KEY
```

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "month",
    "messages_sent": 150,
    "tokens_used": 45000,
    "api_calls": 200,
    "plan": "free",
    "limits": {
      "messages_per_month": 1000,
      "tokens_per_month": 100000
    }
  }
}
```

---

## 🔢 Rate Limits

### Default Limits (Free Tier)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/chat` | 100 requests | 1 minute |
| `/api/search` | 200 requests | 1 minute |
| `/api/onboarding/*` | 50 requests | 1 minute |
| `/api/user/*` | 100 requests | 1 minute |

### Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707134400
```

### Rate Limit Exceeded

When rate limit is exceeded:

**Status Code**: `429 Too Many Requests`

**Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "retry_after": 60
  }
}
```

**Header**:
```
Retry-After: 60
```

---

## ❌ Error Codes

### Authentication Errors

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_API_KEY` | 401 | Invalid or expired API key |
| `INVALID_TOKEN` | 401 | Invalid authentication token |

### Rate Limit Errors

| Code | Status | Description |
|------|--------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |

### Validation Errors

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `MISSING_REQUIRED_FIELD` | 400 | Required field missing |
| `INVALID_FIELD_VALUE` | 400 | Invalid field value |

### Server Errors

| Code | Status | Description |
|------|--------|-------------|
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},  // Optional: Additional error details
    "retry_after": 60  // Optional: For rate limit errors
  }
}
```

---

## 📚 Code Examples

### JavaScript/TypeScript

```typescript
// Install: npm install @infinityassistant/sdk (when available)
// Or use fetch directly:

async function sendMessage(message: string, apiKey: string) {
  const response = await fetch('https://infinityassistant.io/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const data = await response.json();
  return data.data.response;
}

// Usage
const response = await sendMessage('Hello!', 'YOUR_API_KEY');
console.log(response);
```

### Python

```python
import requests

def send_message(message: str, api_key: str):
    url = 'https://infinityassistant.io/api/chat'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    data = {
        'message': message,
        'stream': False,
    }
    
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    
    result = response.json()
    return result['data']['response']

# Usage
response = send_message('Hello!', 'YOUR_API_KEY')
print(response)
```

### cURL

```bash
# Send a message
curl -X POST https://infinityassistant.io/api/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, Infinity Assistant!",
    "stream": false
  }'

# Search knowledge base
curl -X POST https://infinityassistant.io/api/search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "autonomous learning",
    "limit": 10
  }'
```

### Streaming Example (JavaScript)

```typescript
async function streamMessage(message: string, apiKey: string) {
  const response = await fetch('https://infinityassistant.io/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      stream: true,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'chunk') {
          process.stdout.write(data.content);
        } else if (data.type === 'complete') {
          console.log('\nComplete!');
        }
      }
    }
  }
}
```

---

## 🔄 Webhooks (Coming Soon)

Webhook support for real-time notifications is planned for future releases.

---

## 📊 Response Times

### Typical Response Times

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `/api/chat` | 1.2s | 3.5s | 5.0s |
| `/api/search` | 0.3s | 0.8s | 1.2s |
| `/api/onboarding/*` | 0.1s | 0.3s | 0.5s |

---

## 🔒 Security Best Practices

1. **Store API Keys Securely**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys regularly

2. **Use HTTPS**
   - All API calls must use HTTPS
   - Never send API keys over HTTP

3. **Rate Limiting**
   - Implement client-side rate limiting
   - Handle rate limit errors gracefully
   - Use exponential backoff for retries

4. **Error Handling**
   - Always check response status
   - Handle errors gracefully
   - Log errors for debugging

---

## 📞 Support

### Documentation
- [Getting Started Guide](./GETTING_STARTED.md)
- [API Reference](./PUBLIC_API_DOCUMENTATION.md)

### Community
- GitHub: [infinityassistant-service](https://github.com/infinitus/infinityassistant-service)
- Discord: [Infinity Assistant Community](https://discord.gg/infinityassistant)

### Support
- Email: support@infinityassistant.io
- Status: [status.infinityassistant.io](https://status.infinityassistant.io)

---

## 📝 Changelog

### v1.0.0 (2025-02-05)
- Initial public API release
- Chat, Search, Onboarding, User endpoints
- Rate limiting and error handling
- Complete documentation

---

**Last Updated**: 2025-02-05  
**API Version**: 1.0.0

