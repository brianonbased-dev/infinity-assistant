/**
 * Device Scenes API
 *
 * Manage automation scenes for IoT devices.
 *
 * GET  /api/mesh/devices/scenes - List user's scenes
 * POST /api/mesh/devices/scenes - Create/execute scenes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeviceMeshService } from '@/services/DeviceMeshService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mesh/devices/scenes - List user's scenes
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const deviceMesh = getDeviceMeshService();
    const scenes = deviceMesh.getUserScenes(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          scenes,
          total: scenes.length,
          enabled: scenes.filter(s => s.enabled).length,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[ScenesAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Failed to get scenes' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mesh/devices/scenes - Scene operations
 *
 * Actions:
 * - create: Create a new scene
 * - execute: Execute a scene
 * - update: Update a scene
 * - delete: Delete a scene
 * - toggle: Enable/disable a scene
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { action } = body;

    const deviceMesh = getDeviceMeshService();

    switch (action) {
      case 'create': {
        const { scene } = body;

        if (!scene || !scene.name || !scene.actions || !Array.isArray(scene.actions)) {
          return NextResponse.json(
            {
              error: 'Missing required fields',
              required: ['name', 'actions'],
            },
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify user owns all devices in the scene
        for (const sceneAction of scene.actions) {
          const device = deviceMesh.getDevice(sceneAction.deviceId);
          if (!device || device.userId !== user.id) {
            return NextResponse.json(
              { error: `Device not found: ${sceneAction.deviceId}` },
              { status: 404, headers: corsHeaders }
            );
          }
        }

        const created = deviceMesh.createScene({
          id: scene.id || `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          name: scene.name,
          description: scene.description,
          icon: scene.icon,
          actions: scene.actions,
          triggers: scene.triggers,
          enabled: scene.enabled ?? true,
        });

        return NextResponse.json(
          {
            success: true,
            data: { scene: created },
          },
          { status: 201, headers: corsHeaders }
        );
      }

      case 'execute': {
        const { sceneId } = body;

        if (!sceneId) {
          return NextResponse.json(
            { error: 'sceneId is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify scene belongs to user
        const scenes = deviceMesh.getUserScenes(user.id);
        const scene = scenes.find(s => s.id === sceneId);

        if (!scene) {
          return NextResponse.json(
            { error: 'Scene not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        const result = await deviceMesh.executeScene(sceneId);

        return NextResponse.json(
          {
            success: result.success,
            data: {
              sceneId,
              sceneName: scene.name,
              results: result.results,
              actionsExecuted: result.results.length,
              actionsSucceeded: result.results.filter(r => r.success).length,
            },
          },
          { headers: corsHeaders }
        );
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: ['create', 'execute', 'update', 'delete', 'toggle'],
          },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    logger.error('[ScenesAPI] POST error', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500, headers: corsHeaders }
    );
  }
}
