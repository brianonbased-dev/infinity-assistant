/**
 * Service Worker Hook
 *
 * Registers and manages the service worker for offline capabilities.
 */

import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdating: boolean;
  registration: ServiceWorkerRegistration | null;
  error: string | null;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  update: () => Promise<void>;
  skipWaiting: () => void;
  clearCache: () => void;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdating: false,
    registration: null,
    error: null,
  });

  // Check for service worker support
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator;
    setState((prev) => ({ ...prev, isSupported }));

    if (isSupported) {
      // Check if already registered
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          setState((prev) => ({
            ...prev,
            isRegistered: true,
            registration,
          }));
        }
      });
    }
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    if (!state.isSupported) return;

    const handleMessage = (event: MessageEvent) => {
      console.log('[useServiceWorker] Message from SW:', event.data);

      if (event.data.type === 'SYNC_MESSAGES') {
        // Trigger sync in the app
        window.dispatchEvent(new CustomEvent('sw-sync-messages'));
      }

      if (event.data.type === 'SYNC_MEMORIES') {
        window.dispatchEvent(new CustomEvent('sw-sync-memories'));
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [state.isSupported]);

  // Register service worker
  const register = useCallback(async () => {
    if (!state.isSupported) {
      console.warn('[useServiceWorker] Service workers not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[useServiceWorker] Registered:', registration.scope);

      setState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
        error: null,
      }));

      // Handle updates
      registration.addEventListener('updatefound', () => {
        console.log('[useServiceWorker] Update found');
        setState((prev) => ({ ...prev, isUpdating: true }));

        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[useServiceWorker] New version available');
              // Notify user about update
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        }
      });
    } catch (error) {
      console.error('[useServiceWorker] Registration failed:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Registration failed',
      }));
    }
  }, [state.isSupported]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    if (state.registration) {
      await state.registration.unregister();
      setState((prev) => ({
        ...prev,
        isRegistered: false,
        registration: null,
      }));
      console.log('[useServiceWorker] Unregistered');
    }
  }, [state.registration]);

  // Check for updates
  const update = useCallback(async () => {
    if (state.registration) {
      setState((prev) => ({ ...prev, isUpdating: true }));
      await state.registration.update();
      setState((prev) => ({ ...prev, isUpdating: false }));
      console.log('[useServiceWorker] Update check complete');
    }
  }, [state.registration]);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [state.registration]);

  // Clear all caches
  const clearCache = useCallback(() => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      console.log('[useServiceWorker] Cache clear requested');
    }
  }, []);

  return {
    ...state,
    register,
    unregister,
    update,
    skipWaiting,
    clearCache,
  };
}

/**
 * Auto-register service worker on app load
 */
export function useAutoRegisterServiceWorker() {
  const sw = useServiceWorker();

  useEffect(() => {
    if (sw.isSupported && !sw.isRegistered) {
      // Only register in production
      if (process.env.NODE_ENV === 'production') {
        sw.register();
      }
    }
  }, [sw.isSupported, sw.isRegistered, sw.register]);

  return sw;
}
