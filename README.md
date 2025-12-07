
# InfinityAssistant.io Service

---
## 📝 Naming Clarification

- **Master Portal (Tauri app):**  
  The desktop orchestration interface for agent and protocol management.  
  **Always refer to this as “Master Portal” or “MCP Portal.”**

- **Infinity Assistant:**  
  The public-facing web assistant and API service.  
  **Always refer to this as “Infinity Assistant” or “InfinityAssistant.io Service.”**

- **Best Practice:**  
  Do not use “Infinity Assistant” to describe the Master Portal desktop app.  
  Do not use “Master Portal” to describe the Infinity Assistant web service.

---

**Standalone public-facing AI assistant service**

This service provides the public API for InfinityAssistant.io, with all agent operations orchestrated through the uaa2-service Master Portal.

---

## 🎯 Architecture

```
InfinityAssistant Service (Public)
    │
    │ API Calls
    │
    ▼
uaa2-service Master Portal (Orchestrator)
    │
    │ Routes to
    │
    ▼
Service Pools (Horizontal Scaling)
```

---

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local`:

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
UAA2_SUPABASE_SERVICE_KEY=your_service_role_key

# Master Portal (uaa2-service)
UAA2_SERVICE_URL=http://localhost:3000
UAA2_SERVICE_API_KEY=your_internal_api_key

# Server
PORT=3002
NODE_ENV=development
LOG_LEVEL=info
```

### Development

```bash
npm run dev
```

Service runs on `http://localhost:3002`

### Docker Deployment

**Production:**
```bash
docker build -t infinity-assistant:latest .
docker run -d -p 3002:3002 --env-file .env infinity-assistant:latest
```

**Development:**
```bash
docker-compose -f docker-compose.dev.yml up
```

**Full Documentation:** See [Docker Deployment Guide](./docs/DOCKER_DEPLOYMENT.md)

---

## 📚 Documentation

### For Users
- [Getting Started Guide](./docs/GETTING_STARTED.md) - 5-minute quick start
- [Pricing](https://infinityassistant.io/pricing) - Pricing plans
- [Dashboard Comparison](./docs/DASHBOARD_COMPARISON.md) - Understanding different dashboards

### For Developers
- [TypeScript/JavaScript SDK](./sdk/typescript/README.md) - Official SDK with full TypeScript support
- [Python SDK](./sdk/python/README.md) - Official Python SDK with async support
- [API Playground](/developers/playground) - Interactive API explorer (no code required)
- [Public API Documentation](./docs/PUBLIC_API_DOCUMENTATION.md) - Complete API reference
- [API Quick Start](./docs/PUBLIC_API_DOCUMENTATION.md#-quick-start) - Your first API call
- [Error Handling Guide](./docs/ERROR_HANDLING_ENHANCEMENT_COMPLETE.md) - Error codes and recovery
- [Postman Collection](./postman/Infinity_Assistant_API.postman_collection.json) - Pre-configured API requests
- [OpenAPI Specification](./openapi.yaml) - Complete API specification

### Internal
- [MVP Readiness Assessment](./docs/SUFFICIENCY_ASSESSMENT.md) - Launch readiness analysis
- [Launch Status](./docs/DEVELOPER_MVP_LAUNCH_READY.md) - Current launch status

---

## 📋 API Endpoints

### Public API Documentation

**For developers**: See [Public API Documentation](./docs/PUBLIC_API_DOCUMENTATION.md)

**Quick Start**: See [Getting Started Guide](./docs/GETTING_STARTED.md)

### Main Endpoints

#### Chat
- `POST /api/chat` - Send message to assistant
- `GET /api/chat` - Get conversation history

#### Search
- `POST /api/search` - Advanced knowledge base search
- `GET /api/search` - Search suggestions (autocomplete)

#### Onboarding
- `GET /api/onboarding/check` - Check if user needs onboarding
- `POST /api/onboarding/complete` - Mark onboarding as complete
- `POST /api/onboarding/skip` - Mark onboarding as skipped

#### User
- `GET /api/user/preferences` - Get user preferences
- `GET /api/user/usage` - Get usage statistics

---

## 🔗 Master Portal Integration

All agent operations go through the Master Portal API:

```typescript
import { getMasterPortalClient } from '@/services/MasterPortalClient';

const client = getMasterPortalClient();

// Process customer query
const result = await client.processCustomerQuery(message, {
  conversationId,
  userId,
  mode: 'limited',
});

// Search knowledge base
const results = await client.searchKnowledge(query, {
  type: 'all',
  limit: 20,
});
```

---

## 🏗️ Project Structure

```
infinityassistant-service/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── chat/          # Chat API
│   │       ├── search/        # Search API
│   │       └── onboarding/    # Onboarding API
│   ├── services/
│   │   ├── MasterPortalClient.ts  # Master Portal API client
│   │   └── UserService.ts         # User management
│   ├── lib/
│   │   └── capability-limiter.ts  # Capability restrictions
│   ├── types/
│   │   └── agent-capabilities.ts  # Type definitions
│   └── utils/
│       ├── logger.ts              # Logging
│       └── error-handling.ts      # Error handling
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔐 Security

- **Public API** - Isolated from internal services
- **Rate Limiting** - Tier-based limits (free/paid/master)
- **Capability Restrictions** - Limited mode only
- **Authentication** - Optional (anonymous users supported)

---

## 📊 Features

- ✅ Public-facing chat API
- ✅ Knowledge base search
- ✅ User onboarding
- ✅ Rate limiting
- ✅ Usage tracking
- ✅ Master Portal orchestration
- ✅ Horizontal scaling support

---

## 🔄 Migration from uaa2-service

This service was extracted from `uaa2-service/src/app/api/assistant/*` to:
- Enable independent scaling
- Improve security isolation
- Simplify deployment
- Enable Master Portal orchestration

---

**Status**: 🚀 **Ready for Development**  
**Version**: 1.0.0

