'use client';

/**
 * Email + Password Authentication Component
 *
 * Database-based email signup/signin with secure password support.
 * Proper user authentication for regular users.
 *
 * @since 2025-12-01
 * @updated 2025-12-02 - Added password support
 */

import { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, LogOut, User, Eye, EyeOff } from 'lucide-react';

interface AuthUser {
  id: string;
  email: string;
  tier: string;
  createdAt: string;
}

interface EmailAuthProps {
  onAuthChange?: (user: AuthUser | null) => void;
  className?: string;
  compact?: boolean; // For header bar usage
}

type AuthMode = 'signin' | 'signup' | 'forgot';

export function EmailAuth({ onAuthChange, className = '', compact = false }: EmailAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    setSuccess('');

    // Handle forgot password flow
    if (authMode === 'forgot') {
      if (!email) {
        setError('Email is required');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to send reset email');
          return;
        }

        setSuccess('If an account exists, a reset link has been sent to your email.');
        setEmail('');
      } catch (err) {
        console.error('[EmailAuth] Reset error:', err);
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Client-side validation for signin/signup
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (authMode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          action: authMode,
        }),
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
        setPassword('');
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
    // Compact form for header bar
    if (compact) {
      return (
        <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${className}`}>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 w-40"
              required
              autoFocus
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 w-36"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setError(''); }}
            className="text-gray-500 hover:text-gray-400 text-sm"
          >
            Cancel
          </button>
          {error && <span className="text-red-400 text-xs max-w-[100px] truncate" title={error}>{error}</span>}
        </form>
      );
    }

    // Full form (modal/page style)
    return (
      <div className={`w-full max-w-sm ${className}`}>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-1">
            {authMode === 'signin' ? 'Welcome back' : authMode === 'signup' ? 'Create account' : 'Reset password'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {authMode === 'signin' ? 'Sign in to your account' : authMode === 'signup' ? 'Sign up for a free account' : 'Enter your email to reset your password'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  required
                  autoFocus
                />
              </div>
            </div>

            {authMode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-300">Password</label>
                  {authMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setError(''); setSuccess(''); }}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === 'signup' ? 'Min 8 characters' : 'Enter password'}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="text-green-400 text-sm bg-green-500/10 px-3 py-2 rounded-lg">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || (authMode !== 'forgot' && !password)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{authMode === 'signin' ? 'Signing in...' : authMode === 'signup' ? 'Creating account...' : 'Sending...'}</span>
                </>
              ) : (
                <span>{authMode === 'signin' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'}</span>
              )}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {authMode === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setError(''); setSuccess(''); }}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                Back to sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                {authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setShowForm(false); setError(''); setSuccess(''); setPassword(''); }}
            className="mt-4 w-full text-gray-500 hover:text-gray-400 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Sign in button
  return (
    <button
      type="button"
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
