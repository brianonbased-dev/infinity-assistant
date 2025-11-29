/**
 * useFreemium Hook
 *
 * Manages freemium trial state and API calls for free users.
 * Tracks usage, checks offers, and executes freemium features.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  FreemiumOffer,
  FreemiumOfferType,
} from '@/services/FreemiumOfferService';

interface FreemiumUsageStatus {
  assist: {
    used: number;
    remaining: number;
    max: number;
    period: string;
  };
  build: {
    used: number;
    remaining: number;
    max: number;
    period: string;
  };
  deep_research: {
    used: number;
    remaining: number;
    max: number;
    period: string;
  };
}

interface UseFreemiumReturn {
  // Current offer (if any)
  currentOffer: FreemiumOffer | null;

  // Usage status
  usage: FreemiumUsageStatus | null;

  // Loading states
  isCheckingOffer: boolean;
  isExecuting: boolean;

  // Response from executed freemium
  freemiumResponse: {
    type: FreemiumOfferType;
    response: string;
  } | null;

  // Error state
  error: string | null;

  // Actions
  checkForOffer: (query: string) => Promise<FreemiumOffer | null>;
  executeFreemium: (query: string, type: FreemiumOfferType) => Promise<string | null>;
  dismissOffer: () => void;
  clearResponse: () => void;
}

export function useFreemium(userId: string = 'anonymous'): UseFreemiumReturn {
  const [currentOffer, setCurrentOffer] = useState<FreemiumOffer | null>(null);
  const [usage, setUsage] = useState<FreemiumUsageStatus | null>(null);
  const [isCheckingOffer, setIsCheckingOffer] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [freemiumResponse, setFreemiumResponse] = useState<{
    type: FreemiumOfferType;
    response: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if a query qualifies for a freemium offer
   */
  const checkForOffer = useCallback(
    async (query: string): Promise<FreemiumOffer | null> => {
      if (!query || query.trim().length < 5) {
        setCurrentOffer(null);
        return null;
      }

      setIsCheckingOffer(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/freemium?query=${encodeURIComponent(query)}&userId=${encodeURIComponent(userId)}`
        );

        if (!response.ok) {
          throw new Error('Failed to check freemium offer');
        }

        const data = await response.json();

        if (data.success) {
          setUsage(data.usage);

          if (data.hasOffer && data.offer) {
            setCurrentOffer(data.offer);
            return data.offer;
          }
        }

        setCurrentOffer(null);
        return null;
      } catch (err) {
        console.error('Error checking freemium offer:', err);
        setError(err instanceof Error ? err.message : 'Failed to check offer');
        setCurrentOffer(null);
        return null;
      } finally {
        setIsCheckingOffer(false);
      }
    },
    [userId]
  );

  /**
   * Execute a freemium feature
   */
  const executeFreemium = useCallback(
    async (query: string, type: FreemiumOfferType): Promise<string | null> => {
      setIsExecuting(true);
      setError(null);

      try {
        const response = await fetch('/api/freemium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            type,
            userId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            // Usage limit reached
            setError(data.message || 'Freemium limit reached');
            return null;
          }
          throw new Error(data.error || 'Failed to execute freemium');
        }

        if (data.success) {
          // Update usage
          if (data.usage) {
            setUsage((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                [type === 'deep_research' ? 'deep_research' : type]: {
                  ...prev[type === 'deep_research' ? 'deep_research' : type],
                  remaining: data.usage.remaining,
                  used:
                    prev[type === 'deep_research' ? 'deep_research' : type].max -
                    data.usage.remaining,
                },
              };
            });
          }

          // Store response
          setFreemiumResponse({
            type,
            response: data.response,
          });

          // Clear offer since it was used
          setCurrentOffer(null);

          return data.response;
        }

        throw new Error('Unexpected response');
      } catch (err) {
        console.error('Error executing freemium:', err);
        setError(err instanceof Error ? err.message : 'Failed to execute');
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [userId]
  );

  /**
   * Dismiss the current offer
   */
  const dismissOffer = useCallback(() => {
    setCurrentOffer(null);
  }, []);

  /**
   * Clear the freemium response
   */
  const clearResponse = useCallback(() => {
    setFreemiumResponse(null);
  }, []);

  return {
    currentOffer,
    usage,
    isCheckingOffer,
    isExecuting,
    freemiumResponse,
    error,
    checkForOffer,
    executeFreemium,
    dismissOffer,
    clearResponse,
  };
}

/**
 * Debounced version for checking offers while typing
 */
export function useFreemiumDebounced(
  userId: string = 'anonymous',
  debounceMs: number = 500
): UseFreemiumReturn & { debouncedCheckForOffer: (query: string) => void } {
  const freemium = useFreemium(userId);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const debouncedCheckForOffer = useCallback(
    (query: string) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        freemium.checkForOffer(query);
      }, debounceMs);

      setDebounceTimer(timer);
    },
    [freemium, debounceMs, debounceTimer]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return {
    ...freemium,
    debouncedCheckForOffer,
  };
}
