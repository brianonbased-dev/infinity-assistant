# InfinityAssistant.io Service - Agent Context

## Project Overview

Public-facing AI assistant service providing the web interface and API for InfinityAssistant.io. All agent operations are orchestrated through the uaa2-service Master Portal.

**Naming Clarification:**
- **This Service**: InfinityAssistant.io Service (public web service)
- **Master Portal**: Desktop Tauri app for orchestration (separate)
- **uaa2-service**: Protocol service that orchestrates agents (separate repo)

## Architecture

- **Framework**: Next.js application
- **Deployment**: Vercel (configured)
- **Database**: Supabase (migrations in `supabase/migrations/`)
- **Testing**: Playwright for E2E tests
- **Styling**: Tailwind CSS
- **Type**: Public-facing web service

## Key Concepts

- **Public API**: Provides public-facing API endpoints
- **Orchestration**: Routes to uaa2-service Master Portal for agent operations
- **Horizontal Scaling**: Designed for 100+ instances
- **Service Pools**: Routes requests to service pools
- **E2E Testing**: Comprehensive Playwright test suite

## Important Files

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components
- `src/api/` - API route handlers
- `src/services/` - Business logic services
- `supabase/migrations/` - Database migrations
- `e2e/` - Playwright E2E tests
- `playwright.config.ts` - Playwright configuration
- `vercel.json` - Vercel deployment configuration

## Coding Standards

- **TypeScript**: Strict mode, proper typing
- **Next.js App Router**: Use App Router patterns (Server Components by default)
- **Server Components**: Default, async, no client-side JS
- **Client Components**: Use `'use client'` directive when needed
- **API Routes**: RESTful endpoints in `app/api/`
- **Testing**: Playwright for E2E, comprehensive coverage

## Common Tasks

- **Dev Server**: `npm run dev` (Next.js dev server)
- **Build**: `npm run build` (production build)
- **Test**: `npm run test` (E2E tests with Playwright)
- **Type Check**: `npm run type-check`
- **Lint**: `npm run lint`
- **Deploy**: Push to main branch (auto-deploys to Vercel)

## Agent Preferences

- **Use Server Components by default** - Only use Client Components when needed
- **Follow Next.js App Router patterns** - Use App Router conventions
- **Test with Playwright** - Write E2E tests for critical flows
- **Validate API inputs** - Use Zod schemas for validation
- **Handle errors gracefully** - Proper error responses
- **Follow naming conventions** - Master Portal vs Infinity Assistant

## GEMINI Configuration

- **Not directly configured** - This service routes to uaa2-service for agent operations
- **Indirect usage** - uaa2-service handles GEMINI configuration
- **API Integration**: Uses uaa2-service API for agent operations

## Integration Points

- **uaa2-service**: Routes all agent operations to Master Portal
- **Supabase**: Database for user data and application state
- **Vercel**: Deployment platform
- **Playwright**: E2E testing framework

## Security Considerations

- **API Rate Limiting**: Implemented in middleware
- **Input Validation**: Zod schemas for all inputs
- **CORS**: Properly configured for production
- **Error Handling**: Never expose sensitive information in errors

## Testing Strategy

- **E2E Tests**: Comprehensive Playwright test suite
- **Test Coverage**: Accessibility, API, auth, builder, chat, navigation, performance, pricing, visual
- **Test Reports**: Generated in `playwright-report/`

## Related Projects

- **uaa2-service**: Protocol service that orchestrates agents
- **infinitus-monorepo**: Main production monorepo
- **Master Portal**: Desktop Tauri app (separate)

---

*This file enables Antigravity IDE and other AI agents to understand the service architecture and provide better assistance.*

