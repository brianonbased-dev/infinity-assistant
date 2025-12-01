'use client';

/**
 * Simple Email Authentication Component
 *
 * Database-based email signup/signin for Cyber Monday launch.
 * No external auth providers needed.
 *
 * @since 2025-12-01
 */

import { useState, useEffect } from 'react';
import { Mail, Loader2, LogOut, User } from 'lucide-react';

interface AuthUser {
  id: string;
  email: string;
  tier: string;
  createdAt: string;
}

interface EmailAuthProps {
  onAuthChange?: (user: AuthUser | null) => void;
  className?: string;
}

export function EmailAuth({ onAuthChange, className = '' }: EmailAuthProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/email');
        const data = await response.json();

        if (data.authenticated && data.user) {
          setUser(data.user);
          onAuthChange?.(data.user);
        }
      } catch (err) {
        console.error('[EmailAuth] Session check failed:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [onAuthChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'signup' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      // Refresh session to get user data
      const sessionResponse = await fetch('/api/auth/email');
      const sessionData = await sessionResponse.json();

      if (sessionData.authenticated && sessionData.user) {
        setUser(sessionData.user);
        onAuthChange?.(sessionData.user);
        setShowForm(false);
        setEmail('');
      }
    } catch (err) {
      console.error('[EmailAuth] Auth error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/email', { method: 'DELETE' });
      setUser(null);
      onAuthChange?.(null);
    } catch (err) {
      console.error('[EmailAuth] Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      </div>
    );
  }

  // User is signed in
  if (user) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-full">
          <User className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300 max-w-[120px] truncate">
            {user.email}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          title="Sign out"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  // Sign in/up form
  if (showForm) {
    return (
      <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${className}`}>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 w-48"
            required
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Continue'
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-gray-500 hover:text-gray-400 text-sm"
        >
          Cancel
        </button>
        {error && (
          <span className="text-red-400 text-xs">{error}</span>
        )}
      </form>
    );
  }

  // Sign in button
  return (
    <button
      onClick={() => setShowForm(true)}
      className={`px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm font-semibold text-white ${className}`}
    >
      Sign In
    </button>
  );
}

/**
 * Hook to get current user
 */
export function useEmailAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/email');
        const data = await response.json();

        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('[useEmailAuth] Session check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  return { user, loading };
}

export default EmailAuth;
