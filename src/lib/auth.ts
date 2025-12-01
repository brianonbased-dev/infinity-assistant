/**
 * Authentication Utilities
 *
 * Provides user authentication helpers for API routes.
 */

import { NextRequest } from 'next/server';
import { getSupabaseClient } from './supabase';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  role?: 'user' | 'admin' | 'owner';
}

/**
 * Get the current authenticated user from request
 */
export async function getCurrentUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // Check if it's a mesh API key
      if (token.startsWith('ia_mesh_')) {
        // Validate against mesh node API keys
        const { getUserMeshService } = await import('@/services/UserMeshService');
        const meshService = getUserMeshService();
        const userNode = await meshService.validateApiKey(token);

        if (userNode) {
          return {
            id: userNode.userId,
            plan: userNode.tier,
            role: 'user',
          };
        }
      }

      // Try Supabase auth
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (user && !error) {
        return {
          id: user.id,
          email: user.email,
          plan: 'free', // Default, would fetch from user profile
          role: 'user',
        };
      }

      // Simple token format fallback (for development)
      if (token.startsWith('user_')) {
        return { id: token, plan: 'free', role: 'user' };
      }
    }

    // Check X-API-Key header
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    if (apiKey) {
      // Validate against mesh API keys
      if (apiKey.startsWith('ia_mesh_')) {
        const { getUserMeshService } = await import('@/services/UserMeshService');
        const meshService = getUserMeshService();
        const userNode = await meshService.validateApiKey(apiKey);

        if (userNode) {
          return {
            id: userNode.userId,
            plan: userNode.tier,
            role: 'user',
          };
        }
      }
    }

    // Check X-Mesh-Key header
    const meshKey = req.headers.get('X-Mesh-Key') || req.headers.get('x-mesh-key');
    if (meshKey) {
      const { getUserMeshService } = await import('@/services/UserMeshService');
      const meshService = getUserMeshService();
      const userNode = await meshService.validateApiKey(meshKey);

      if (userNode) {
        return {
          id: userNode.userId,
          plan: userNode.tier,
          role: 'user',
        };
      }
    }

    // Check session cookie
    const sessionCookie = req.cookies.get('session');
    if (sessionCookie?.value) {
      // Validate session token
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser(sessionCookie.value);

      if (user && !error) {
        return {
          id: user.id,
          email: user.email,
          plan: 'free',
          role: 'user',
        };
      }

      // Fallback for development
      return { id: sessionCookie.value, plan: 'free', role: 'user' };
    }

    // Check Supabase auth cookie (for SSR)
    const supabaseAuthCookie = req.cookies.get('sb-access-token');
    if (supabaseAuthCookie?.value) {
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser(supabaseAuthCookie.value);

      if (user && !error) {
        return {
          id: user.id,
          email: user.email,
          plan: 'free',
          role: 'user',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user has required plan
 */
export function hasRequiredPlan(
  user: AuthenticatedUser,
  requiredPlans: Array<'free' | 'pro' | 'enterprise'>
): boolean {
  if (!user.plan) return requiredPlans.includes('free');
  return requiredPlans.includes(user.plan);
}

/**
 * Check if user has required role
 */
export function hasRequiredRole(
  user: AuthenticatedUser,
  requiredRoles: Array<'user' | 'admin' | 'owner'>
): boolean {
  if (!user.role) return requiredRoles.includes('user');
  return requiredRoles.includes(user.role);
}

export default {
  getCurrentUser,
  hasRequiredPlan,
  hasRequiredRole,
};
