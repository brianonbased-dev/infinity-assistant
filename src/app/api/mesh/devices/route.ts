/**
 * Device Mesh API
 *
 * Manage user's IoT device network.
 *
 * GET  /api/mesh/devices - List user's devices
 * POST /api/mesh/devices - Register/control devices
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDeviceMeshService,
  type DeviceCategory,
  type DeviceCommand,
} from '@/services/DeviceMeshService';
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
 * GET /api/mesh/devices - List user's devices
 *
 * Query params:
 * - category: Filter by device category
 * - room: Filter by room
 * - status: Filter by status (online/offline)
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

    const category = request.nextUrl.searchParams.get('category') as DeviceCategory | null;
    const room = request.nextUrl.searchParams.get('room');
    const status = request.nextUrl.searchParams.get('status');

    let devices = deviceMesh.getUserDevices(user.id);

    // Apply filters
    if (category) {
      devices = devices.filter(d => d.category === category);
    }
    if (room) {
      devices = devices.filter(d => d.location?.room === room);
    }
    if (status) {
      devices = devices.filter(d => d.status === status);
    }

    // Get unique rooms for filter options
    const rooms = [...new Set(
      deviceMesh.getUserDevices(user.id)
        .map(d => d.location?.room)
        .filter((r): r is string => !!r)
    )];

    // Get category counts
    const categoryCounts: Record<string, number> = {};
    for (const device of deviceMesh.getUserDevices(user.id)) {
      categoryCounts[device.category] = (categoryCounts[device.category] || 0) + 1;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          devices,
          total: devices.length,
          online: devices.filter(d => d.status === 'online').length,
          filters: { category, room, status },
          options: {
            rooms,
            categories: Object.keys(categoryCounts),
            categoryCounts,
          },
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[DeviceMeshAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Failed to get devices' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mesh/devices - Device operations
 *
 * Actions:
 * - register: Register a new device
 * - unregister: Remove a device
 * - command: Send command to device
 * - batch-command: Send multiple commands
 * - update-state: Update device state
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
      case 'register': {
        const { device } = body;

        if (!device || !device.name || !device.category || !device.protocol) {
          return NextResponse.json(
            {
              error: 'Missing required fields',
              required: ['name', 'category', 'protocol'],
            },
            { status: 400, headers: corsHeaders }
          );
        }

        const registered = await deviceMesh.registerDevice({
          id: device.id || `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          name: device.name,
          category: device.category,
          protocol: device.protocol,
          manufacturer: device.manufacturer,
          model: device.model,
          firmwareVersion: device.firmwareVersion,
          capabilities: device.capabilities || [],
          state: device.state || {},
          location: device.location,
          metadata: device.metadata,
        });

        return NextResponse.json(
          {
            success: true,
            data: { device: registered },
          },
          { status: 201, headers: corsHeaders }
        );
      }

      case 'unregister': {
        const { deviceId } = body;

        if (!deviceId) {
          return NextResponse.json(
            { error: 'deviceId is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify ownership
        const device = deviceMesh.getDevice(deviceId);
        if (!device || device.userId !== user.id) {
          return NextResponse.json(
            { error: 'Device not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        await deviceMesh.unregisterDevice(deviceId);

        return NextResponse.json(
          {
            success: true,
            message: 'Device unregistered',
          },
          { headers: corsHeaders }
        );
      }

      case 'command': {
        const { deviceId, capability, value } = body;

        if (!deviceId || !capability || value === undefined) {
          return NextResponse.json(
            {
              error: 'Missing required fields',
              required: ['deviceId', 'capability', 'value'],
            },
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify ownership
        const device = deviceMesh.getDevice(deviceId);
        if (!device || device.userId !== user.id) {
          return NextResponse.json(
            { error: 'Device not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        const result = await deviceMesh.sendCommand({ deviceId, capability, value });

        return NextResponse.json(
          {
            success: result.success,
            error: result.error,
            data: result.success ? {
              deviceId,
              capability,
              value,
              newState: deviceMesh.getDeviceState(deviceId),
            } : undefined,
          },
          { status: result.success ? 200 : 400, headers: corsHeaders }
        );
      }

      case 'batch-command': {
        const { commands } = body;

        if (!Array.isArray(commands) || commands.length === 0) {
          return NextResponse.json(
            { error: 'commands array is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify ownership of all devices
        for (const cmd of commands) {
          const device = deviceMesh.getDevice(cmd.deviceId);
          if (!device || device.userId !== user.id) {
            return NextResponse.json(
              { error: `Device not found: ${cmd.deviceId}` },
              { status: 404, headers: corsHeaders }
            );
          }
        }

        const results = await deviceMesh.sendCommands(commands as DeviceCommand[]);

        return NextResponse.json(
          {
            success: results.every(r => r.success),
            data: {
              results,
              succeeded: results.filter(r => r.success).length,
              failed: results.filter(r => !r.success).length,
            },
          },
          { headers: corsHeaders }
        );
      }

      case 'update-state': {
        const { deviceId, state } = body;

        if (!deviceId || !state) {
          return NextResponse.json(
            { error: 'deviceId and state are required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify ownership
        const device = deviceMesh.getDevice(deviceId);
        if (!device || device.userId !== user.id) {
          return NextResponse.json(
            { error: 'Device not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        deviceMesh.updateDeviceState(deviceId, state);

        return NextResponse.json(
          {
            success: true,
            data: {
              deviceId,
              newState: deviceMesh.getDeviceState(deviceId),
            },
          },
          { headers: corsHeaders }
        );
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: ['register', 'unregister', 'command', 'batch-command', 'update-state'],
          },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    logger.error('[DeviceMeshAPI] POST error', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500, headers: corsHeaders }
    );
  }
}
