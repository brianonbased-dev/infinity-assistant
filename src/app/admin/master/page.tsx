/**
 * Master Control Center - Admin Portal Page
 *
 * Full-featured admin panel for master users with:
 * - Settings management and repair
 * - Knowledge base CRUD operations
 * - RPC console for direct mesh commands
 * - Mesh network monitoring
 * - MCP server configuration
 *
 * Access: Master tier only
 *
 * @since 2025-12-02
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { MasterAssistant } from '@/components/admin/MasterAssistant';

export default function MasterControlPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/email');
        const data = await response.json();

        if (!data.authenticated) {
          setError('Authentication required');
          setLoading(false);
          return;
        }

        // Check for master tier
        if (data.user?.tier !== 'master') {
          setError('Master access required');
          setLoading(false);
          return;
        }

        setUserId(data.user.id);
        setAuthorized(true);
      } catch (err) {
        console.error('[MasterControl] Auth check failed:', err);
        setError('Failed to verify authorization');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-gray-400">Verifying master access...</p>
        </div>
      </div>
    );
  }

  if (error || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="max-w-md p-8 bg-gray-900 rounded-xl border border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">{error || 'You do not have permission to access this area.'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Page Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-950">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-purple-400" />
            <span className="text-lg font-semibold text-white">Admin Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">User: {userId}</span>
            <button
              onClick={() => router.push('/admin')}
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              Back to Admin
            </button>
          </div>
        </div>
      </div>

      {/* Master Assistant - Full Height */}
      <div className="h-[calc(100vh-65px)]">
        <MasterAssistant userId={userId!} />
      </div>
    </div>
  );
}
