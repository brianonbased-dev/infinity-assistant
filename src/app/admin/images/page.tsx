'use client';

/**
 * Admin Image Management Page
 *
 * Master tier only access to manage site images.
 *
 * @since 2025-12-02
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft } from 'lucide-react';
import { ImageLibrary } from '@/components/admin/ImageLibrary';
import { useEmailAuth } from '@/components/EmailAuth';

export default function AdminImagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useEmailAuth();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check master tier access
  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const response = await fetch('/api/subscription/status');
        const data = await response.json();

        if (data.tier === 'master') {
          setAuthorized(true);
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Access check failed:', error);
        router.push('/dashboard');
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, [user, authLoading, router]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white text-xl mb-2">Access Denied</p>
          <p className="text-gray-400">Master tier access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Admin: Image Management
            </h1>
            <p className="text-sm text-gray-400">Upload, edit, and manage site images</p>
          </div>
        </div>
      </header>

      {/* Image Library */}
      <main className="flex-1">
        <ImageLibrary />
      </main>
    </div>
  );
}
