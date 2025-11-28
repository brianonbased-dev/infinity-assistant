/**
 * API Rate Limiting Middleware
 *
 * Optional rate limiting (doesn't block, just tracks)
 */

import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitContext {
  userId: string;
  endpoint: string;
  method: string;
}

/**
 * Optional rate limiting (doesn't block, just tracks)
 */
export function withOptionalRateLimit(
  handler: (request: NextRequest, context?: RateLimitContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // For now, just pass through
    // Rate limiting is handled in the route handlers
    return handler(request);
  };
}

