# Deprecated Services

The following services have been consolidated into the new `src/lib/` module architecture.

## EV Services (11 → 2)

### Deprecated Files

| Old Service | Status | Replacement |
|------------|--------|-------------|
| `TeslaIntegrationService.ts` | DEPRECATED | `@/lib/EV` with Tesla adapter |
| `manufacturers/BMWIntegrationService.ts` | DEPRECATED | `@/lib/EV` with BMW adapter |
| `manufacturers/FordIntegrationService.ts` | DEPRECATED | `@/lib/EV` with Ford adapter |
| `manufacturers/GMIntegrationService.ts` | DEPRECATED | `@/lib/EV` with GM adapter |
| `manufacturers/RivianIntegrationService.ts` | DEPRECATED | `@/lib/EV` with Rivian adapter |
| `manufacturers/VWGroupIntegrationService.ts` | DEPRECATED | `@/lib/EV` with VW adapter |
| `manufacturers/HyundaiKiaIntegrationService.ts` | DEPRECATED | `@/lib/EV` with Hyundai/Kia adapter |
| `manufacturers/UnifiedEVService.ts` | DEPRECATED | `@/lib/EV/EVService.ts` |
| `EVOptimizationService.ts` | DEPRECATED | `EVOptimizationServiceV2.ts` |
| `EVUpdateScheduler.ts` | DEPRECATED | Use EventBus + EVService |

### Migration Steps

1. Replace imports:
```typescript
// OLD
import { TeslaIntegrationService } from '@/services/TeslaIntegrationService';
import { EVOptimizationService } from '@/services/EVOptimizationService';

// NEW
import { evService } from '@/lib/EV';
import { evOptimizationService } from '@/services/EVOptimizationServiceV2';
```

2. Replace singleton patterns:
```typescript
// OLD
const tesla = TeslaIntegrationService.getInstance();
const vehicles = await tesla.getVehicles(token);

// NEW
const vehicles = await evService.getUserVehicles(userId);
```

3. Replace cache usage:
```typescript
// OLD (in each service)
private vehicleCache = new Map<string, CacheEntry<Vehicle>>();
private getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null { ... }

// NEW
import { getCache } from '@/lib/CacheService';
const vehicleCache = getCache<Vehicle>('vehicles', { ttl: 30000 });
const cached = vehicleCache.get(key);
```

4. Replace events:
```typescript
// OLD
this.emit('vehicleUpdated', data);

// NEW
import { eventBus, createPayload } from '@/lib/EventBus';
eventBus.emit('vehicle.status_updated', createPayload('MyService', data));
```

---

## Shared Utilities

### New Library Structure

```
src/lib/
├── index.ts              # Central exports
├── CacheService.ts       # Replaces 16 duplicate cache implementations
├── EventBus.ts           # Unified event system
├── ServiceError.ts       # Standardized error handling
├── createSingleton.ts    # Replaces 25 singleton patterns
├── apiMiddleware.ts      # Standardized API routes
└── EV/
    ├── index.ts
    ├── types.ts          # Single source of truth for EV types
    ├── EVManufacturerAdapter.ts  # Adapter pattern
    └── EVService.ts      # Unified EV service
```

### Import from Central Location

```typescript
// All utilities from one import
import {
  getCache,
  eventBus,
  ServiceError,
  createSingleton,
  withAuth,
  evService
} from '@/lib';
```

---

## API Routes Migration

### New v2 Routes

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `/api/ev` | `/api/ev/v2` | Uses unified EVService |
| `/api/ev/tesla` | `/api/ev/v2` with `manufacturer: 'tesla'` | Manufacturer-agnostic |
| `/api/ev/ford/callback` | `/api/ev/v2/ford/callback` | Dynamic manufacturer routes |

### Example v2 API Usage

```typescript
// OLD - Tesla specific
POST /api/ev/tesla
{
  "action": "list_vehicles",
  "accessToken": "..."
}

// NEW - Unified API
POST /api/ev/v2
{
  "action": "list_vehicles"
}
// Auth handled via session, supports all manufacturers
```

### Connecting a Vehicle

```typescript
// Step 1: Get auth URL
POST /api/ev/v2
{
  "action": "connect_vehicle",
  "manufacturer": "tesla" // or ford, bmw, gm, etc.
}
// Returns: { authUrl: "https://auth.tesla.com/oauth2/..." }

// Step 2: User completes OAuth flow
// Callback: /api/ev/v2/[manufacturer]/callback

// Step 3: List vehicles
POST /api/ev/v2
{
  "action": "list_vehicles"
}
```

---

## Timeline

- **Phase 1 (Current)**: New lib created, V2 services available
- **Phase 2 (Current)**: Update API routes to use new services
- **Phase 3**: Remove deprecated services
- **Phase 4**: Update documentation

---

## Adapter Registration

Real adapters are registered in `src/lib/EV/adapters/`:

| Adapter | File | Status |
|---------|------|--------|
| Tesla | `TeslaAdapter.ts` | Complete |
| Ford | `FordAdapter.ts` | Complete |
| BMW | `BMWAdapter.ts` | Complete |
| GM | `GMAdapter.ts` | Complete |
| Rivian | (pending) | Use MockEVAdapter |
| VW Group | (pending) | Use MockEVAdapter |
| Hyundai/Kia | (pending) | Use MockEVAdapter |

To add a new adapter:
1. Create `src/lib/EV/adapters/[Name]Adapter.ts`
2. Extend `BaseEVAdapter`
3. Call `registerAdapter('manufacturer', () => new YourAdapter())`
4. Export from `src/lib/EV/adapters/index.ts`

## Questions?

See the migration examples in `src/lib/EV/EVService.ts` for patterns.
