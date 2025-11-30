/**
 * EV OAuth Callback Handler
 *
 * Handles OAuth callbacks from all EV manufacturers.
 * Routes: /api/ev/v2/[manufacturer]/callback
 *
 * Supported manufacturers: tesla, ford, bmw, gm, rivian, vw, hyundai, kia
 */

import { NextRequest, NextResponse } from 'next/server';
import { evService } from '@/lib/EV';
import { getAdapter, hasAdapter } from '@/lib/EV/adapters';
import { eventBus, createPayload } from '@/lib/EventBus';
import type { Manufacturer } from '@/lib/EV/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { manufacturer: string } }
) {
  const manufacturer = params.manufacturer.toLowerCase() as Manufacturer;
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error(`[EV Callback] OAuth error for ${manufacturer}:`, error, errorDescription);
    return NextResponse.redirect(
      new URL(`/settings/vehicles?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings/vehicles?error=Missing+authorization+parameters', request.url)
    );
  }

  // Validate manufacturer
  if (!hasAdapter(manufacturer)) {
    return NextResponse.redirect(
      new URL(`/settings/vehicles?error=Unsupported+manufacturer:+${manufacturer}`, request.url)
    );
  }

  try {
    // Extract userId from state (format: userId_timestamp_random)
    const [userId] = state.split('_');
    if (!userId) {
      throw new Error('Invalid state parameter');
    }

    // Get adapter and exchange code
    const adapter = getAdapter(manufacturer);
    const authResult = await adapter.exchangeCodeForToken(code);

    if (!authResult.success || !authResult.token) {
      throw new Error(authResult.error || 'Failed to exchange authorization code');
    }

    // Store the connection
    await evService.addVehicleConnection(userId, {
      manufacturer,
      token: authResult.token,
      connectedAt: new Date(),
    });

    // Fetch vehicles for this connection
    const vehicles = await adapter.getVehicles(authResult.token);

    // Emit event
    eventBus.emit('vehicle.connected', createPayload('EV OAuth Callback', {
      userId,
      manufacturer,
      vehicleCount: vehicles.length,
    }));

    // Redirect to success page
    const successUrl = new URL('/settings/vehicles', request.url);
    successUrl.searchParams.set('connected', manufacturer);
    successUrl.searchParams.set('vehicles', vehicles.length.toString());

    return NextResponse.redirect(successUrl);
  } catch (err) {
    console.error(`[EV Callback] Error processing ${manufacturer} callback:`, err);

    const errorMessage = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.redirect(
      new URL(`/settings/vehicles?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
