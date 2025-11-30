# Infinity Assistant Service - API v2 Documentation

## Overview

The v2 API provides standardized endpoints with consistent middleware patterns:
- Authentication via `withAuth` middleware
- Rate limiting via `withRateLimit`
- Request validation via schema definitions
- Consistent error responses

## Base URL

```
Production: https://infinityassistant.io/api/v2
Development: http://localhost:3000/api/v2
```

---

## EV (Electric Vehicle) APIs

### EV v2 Endpoints

Base: `/api/ev/v2`

#### GET /api/ev/v2/vehicles
List all connected vehicles for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "string",
        "manufacturer": "tesla" | "ford" | "bmw" | "gm" | "rivian" | "vw" | "audi" | "porsche" | "hyundai" | "kia",
        "name": "string",
        "model": "string",
        "vin": "string",
        "stateOfCharge": 85,
        "range": 250,
        "isCharging": false,
        "isOnline": true
      }
    ]
  },
  "meta": {
    "requestId": "req_xxx",
    "timestamp": "2025-11-30T00:00:00Z",
    "duration": 123
  }
}
```

#### GET /api/ev/v2/vehicles/:vehicleId/battery
Get battery and charging state for a vehicle.

**Response:**
```json
{
  "success": true,
  "data": {
    "stateOfCharge": 85,
    "range": 250,
    "targetSoC": 90,
    "chargingState": {
      "isCharging": true,
      "chargeRate": 11.5,
      "timeToFull": 45,
      "chargerType": "level2"
    },
    "batteryHealth": 98,
    "lastUpdated": "2025-11-30T00:00:00Z"
  }
}
```

#### POST /api/ev/v2/vehicles/:vehicleId/commands
Send a command to a vehicle.

**Request Body:**
```json
{
  "command": "start_charging" | "stop_charging" | "set_charge_limit" | "climate_on" | "climate_off" | "lock_doors" | "unlock_doors" | "wake_up",
  "params": {
    "limit": 80,           // for set_charge_limit
    "temperature": 21      // for climate_on
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commandId": "cmd_xxx",
    "status": "queued" | "executing" | "completed" | "failed",
    "result": {}
  }
}
```

#### GET /api/ev/v2/charging/stations
Find nearby charging stations.

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Search radius in km (default: 25)
- `vehicleId` (optional): Filter by compatible chargers

**Response:**
```json
{
  "success": true,
  "data": {
    "stations": [
      {
        "id": "string",
        "name": "string",
        "network": "tesla" | "electrify_america" | "chargepoint" | "evgo",
        "location": { "lat": 0, "lng": 0 },
        "address": "string",
        "connectors": [
          { "type": "ccs", "power": 150, "available": 3, "total": 4 }
        ],
        "pricing": { "perKwh": 0.35, "currency": "USD" },
        "distance": 2.5
      }
    ]
  }
}
```

#### POST /api/ev/v2/charging/optimize
Generate optimized charging schedule.

**Request Body:**
```json
{
  "vehicleId": "string",
  "targetSoC": 90,
  "readyBy": "2025-11-30T07:00:00Z",
  "minimizeCost": true,
  "useGridPricing": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": {
      "vehicleId": "string",
      "slots": [
        {
          "startTime": "2025-11-30T23:00:00Z",
          "endTime": "2025-11-30T06:00:00Z",
          "targetPower": 11,
          "pricePerKwh": 0.08,
          "isOffPeak": true
        }
      ],
      "targetSoC": 90,
      "estimatedCost": 5.50,
      "costSavings": 2.30,
      "isGridFriendly": true
    }
  }
}
```

---

## Content Management APIs

Base: `/api/v2/content`

#### GET /api/v2/content
List content items.

**Query Parameters:**
- `type` (optional): Filter by content type
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

#### POST /api/v2/content
Create new content.

**Request Body:**
```json
{
  "type": "article" | "note" | "document",
  "title": "string",
  "content": "string",
  "metadata": {}
}
```

---

## Memory Management APIs

Base: `/api/v2/memory`

#### GET /api/v2/memory
List memory entries.

**Query Parameters:**
- `type` (optional): Filter by memory type
- `workspace` (optional): Filter by workspace
- `limit` (optional): Max results

#### POST /api/v2/memory
Create memory entry.

**Request Body:**
```json
{
  "type": "wisdom" | "pattern" | "gotcha",
  "content": "string",
  "workspace": "string",
  "confidence": 0.85,
  "tags": ["string"]
}
```

#### DELETE /api/v2/memory/:id
Delete a memory entry.

---

## Subscription Management APIs

Base: `/api/v2/subscription`

#### GET /api/v2/subscription
Get current subscription status.

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": "free" | "pro" | "enterprise",
    "status": "active" | "cancelled" | "past_due",
    "features": ["feature1", "feature2"],
    "limits": {
      "vehicles": 5,
      "apiCalls": 10000
    },
    "currentUsage": {
      "vehicles": 2,
      "apiCalls": 1500
    },
    "renewsAt": "2025-12-30T00:00:00Z"
  }
}
```

---

## MCP Integration APIs

Base: `/api/mcp`

#### GET /api/mcp/ev
Get available EV tools for MCP.

**Response:**
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "ev_list_vehicles",
        "description": "List all connected electric vehicles",
        "inputSchema": {...}
      }
    ],
    "serverId": "infinityassistant-ev",
    "serverName": "Infinity Assistant EV Service"
  }
}
```

#### POST /api/mcp/ev
Execute an EV tool from MCP.

**Request Body:**
```json
{
  "toolName": "ev_start_charging",
  "arguments": {
    "userId": "user_xxx",
    "vehicleId": "vehicle_xxx"
  },
  "correlationId": "optional_correlation_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": {...},
    "executionTimeMs": 1234
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_REQUIRED | 401 | Authentication required |
| AUTH_INVALID_TOKEN | 401 | Invalid token |
| AUTH_INSUFFICIENT_PERMISSIONS | 403 | Missing permissions |
| VALIDATION_FAILED | 400 | Request validation failed |
| RESOURCE_NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| VEHICLE_NOT_FOUND | 404 | Vehicle not found |
| VEHICLE_OFFLINE | 503 | Vehicle is offline |
| VEHICLE_COMMAND_FAILED | 500 | Command execution failed |
| MANUFACTURER_API_ERROR | 502 | Manufacturer API error |
| INTERNAL_ERROR | 500 | Internal server error |

---

## Rate Limits

| Plan | Requests/minute | Vehicles | Daily API Calls |
|------|-----------------|----------|-----------------|
| Free | 30 | 1 | 1,000 |
| Pro | 120 | 5 | 50,000 |
| Enterprise | 600 | Unlimited | Unlimited |

---

## Authentication

All authenticated endpoints require a Bearer token:

```
Authorization: Bearer <token>
```

Or a session cookie for web applications.

---

## Supported EV Manufacturers

| Manufacturer | Models | OAuth | Features |
|--------------|--------|-------|----------|
| Tesla | Model S/3/X/Y, Cybertruck | ✅ | Full control |
| Ford | Mustang Mach-E, F-150 Lightning | ✅ | Full control |
| BMW | iX, i4, i7 | ✅ | Full control |
| GM | Bolt, Blazer, Lyriq, Hummer | ✅ | Full control |
| Rivian | R1T, R1S | ✅ | Full control |
| VW | ID.4, ID.Buzz | ✅ | Full control |
| Audi | e-tron, Q4 e-tron | ✅ | Full control |
| Porsche | Taycan | ✅ | Full control |
| Hyundai | Ioniq 5/6 | ✅ | Full control |
| Kia | EV6, EV9, Niro EV | ✅ | Full control |
