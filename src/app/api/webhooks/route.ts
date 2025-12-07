/**
 * Webhooks Management
 * 
 * Register and manage webhooks for Infinity Assistant events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';
import crypto from 'crypto';

export type WebhookEvent = 
  | 'chat.message'
  | 'chat.response'
  | 'knowledge.created'
  | 'memory.stored'
  | 'user.preferences.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: WebhookEvent[];
  secret: string; // For signature verification
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

// In-memory storage (in production, use database)
const webhooksStore: Map<string, Webhook[]> = new Map();

/**
 * Generate webhook secret
 */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * POST /api/webhooks
 * 
 * Register a new webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, events } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook URL' },
        { status: 400 }
      );
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event type is required' },
        { status: 400 }
      );
    }

    // Validate event types
    const validEvents: WebhookEvent[] = [
      'chat.message',
      'chat.response',
      'knowledge.created',
      'memory.stored',
      'user.preferences.updated',
      'subscription.created',
      'subscription.updated',
      'subscription.cancelled'
    ];

    const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid event types: ${invalidEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;

    // Create webhook
    const webhook: Webhook = {
      id: crypto.randomUUID(),
      userId: actualUserId,
      url,
      events: events as WebhookEvent[],
      secret: generateWebhookSecret(),
      isActive: true,
      createdAt: new Date(),
      failureCount: 0
    };

    // Store
    const userWebhooks = webhooksStore.get(actualUserId) || [];
    userWebhooks.push(webhook);
    webhooksStore.set(actualUserId, userWebhooks);

    logger.info('[Webhooks] Registered new webhook:', {
      userId: actualUserId,
      webhookId: webhook.id,
      url: webhook.url,
      events: webhook.events
    });

    return NextResponse.json({
      success: true,
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Only shown once
        createdAt: webhook.createdAt.toISOString()
      },
      message: 'Webhook registered. Save the secret - it will not be shown again.'
    });
  } catch (error: unknown) {
    logger.error('[Webhooks] Error registering webhook:', error);
    return NextResponse.json(
      { error: 'Failed to register webhook' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks
 * 
 * List user's webhooks
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;
    const userWebhooks = webhooksStore.get(actualUserId) || [];

    return NextResponse.json({
      success: true,
      webhooks: userWebhooks.map(webhook => ({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt.toISOString(),
        lastTriggered: webhook.lastTriggered?.toISOString(),
        failureCount: webhook.failureCount
      }))
    });
  } catch (error: unknown) {
    logger.error('[Webhooks] Error listing webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to list webhooks' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks
 * 
 * Delete a webhook
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;
    const userWebhooks = webhooksStore.get(actualUserId) || [];
    
    const webhookIndex = userWebhooks.findIndex(w => w.id === webhookId);
    if (webhookIndex === -1) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Remove webhook
    userWebhooks.splice(webhookIndex, 1);
    webhooksStore.set(actualUserId, userWebhooks);

    logger.info('[Webhooks] Deleted webhook:', {
      userId: actualUserId,
      webhookId
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted'
    });
  } catch (error: unknown) {
    logger.error('[Webhooks] Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}

/**
 * Trigger webhook delivery
 * Internal function to deliver webhook events
 */
export async function triggerWebhook(
  userId: string,
  event: WebhookEvent,
  payload: any
): Promise<void> {
  const userWebhooks = webhooksStore.get(userId) || [];
  const activeWebhooks = userWebhooks.filter(w => w.isActive && w.events.includes(event));

  for (const webhook of activeWebhooks) {
    try {
      // Create signature
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Deliver webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Infinity-Signature': signature,
          'X-Infinity-Event': event,
          'X-Infinity-Webhook-Id': webhook.id
        },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data: payload
        })
      });

      if (response.ok) {
        webhook.lastTriggered = new Date();
        webhook.failureCount = 0;
        logger.info('[Webhooks] Webhook delivered:', {
          webhookId: webhook.id,
          event,
          status: response.status
        });
      } else {
        webhook.failureCount += 1;
        logger.warn('[Webhooks] Webhook delivery failed:', {
          webhookId: webhook.id,
          event,
          status: response.status,
          failureCount: webhook.failureCount
        });

        // Deactivate after 5 failures
        if (webhook.failureCount >= 5) {
          webhook.isActive = false;
          logger.error('[Webhooks] Webhook deactivated due to failures:', {
            webhookId: webhook.id,
            failureCount: webhook.failureCount
          });
        }
      }
    } catch (error) {
      webhook.failureCount += 1;
      logger.error('[Webhooks] Webhook delivery error:', {
        webhookId: webhook.id,
        event,
        error
      });

      if (webhook.failureCount >= 5) {
        webhook.isActive = false;
      }
    }
  }
}

