/**
 * useChatStream Hook
 *
 * React hook for consuming the streaming chat API
 * Provides real-time response updates via Server-Sent Events
 *
 * Usage:
 * ```tsx
 * const { sendMessage, response, isStreaming, error } = useChatStream({
 *   conversationId: 'conv-123',
 *   onComplete: (response) => console.log('Done:', response),
 * });
 *
 * // Send a message
 * sendMessage('Hello, how are you?');
 * ```
 */

import { useState, useCallback, useRef } from 'react';

export interface StreamEvent {
  type: 'start' | 'chunk' | 'phase' | 'memory' | 'language' | 'speaker' | 'essence' | 'driving' | 'done' | 'error';
  data: any;
}

export interface ChatStreamOptions {
  conversationId?: string;
  userId?: string;
  userTier?: string;
  mode?: 'search' | 'assist' | 'build';
  userContext?: string;
  preferences?: any;
  essence?: any;
  sessionId?: string;
  drivingMode?: any;
  onStart?: () => void;
  onChunk?: (text: string) => void;
  onPhase?: (data: { from: string; to: string; confidence: number }) => void;
  onMemory?: (data: { stored: boolean; content: string }) => void;
  onLanguage?: (data: { detected: string; confidence: number }) => void;
  onSpeaker?: (data: { speakerId: string; speakerName?: string; ageGroup?: string; greeting?: string }) => void;
  onEssence?: (data: { applied: boolean; voiceTone?: string }) => void;
  onDriving?: (data: { enabled: boolean; isEV?: boolean }) => void;
  onComplete?: (response: string, metadata: any) => void;
  onError?: (error: string) => void;
}

export interface UseChatStreamReturn {
  sendMessage: (message: string, options?: Partial<ChatStreamOptions>) => Promise<void>;
  response: string;
  isStreaming: boolean;
  error: string | null;
  metadata: any;
  abort: () => void;
}

/**
 * Hook for streaming chat responses
 */
export function useChatStream(options: ChatStreamOptions = {}): UseChatStreamReturn {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const sendMessage = useCallback(async (
    message: string,
    messageOptions: Partial<ChatStreamOptions> = {}
  ) => {
    // Abort any existing stream
    abort();

    // Reset state
    setResponse('');
    setError(null);
    setMetadata(null);
    setIsStreaming(true);

    // Merge options
    const mergedOptions = { ...options, ...messageOptions };

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Call onStart callback
      if (mergedOptions.onStart) {
        mergedOptions.onStart();
      }

      // Make streaming request
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId: mergedOptions.conversationId,
          userId: mergedOptions.userId,
          userTier: mergedOptions.userTier,
          mode: mergedOptions.mode,
          userContext: mergedOptions.userContext,
          preferences: mergedOptions.preferences,
          essence: mergedOptions.essence,
          sessionId: mergedOptions.sessionId,
          drivingMode: mergedOptions.drivingMode,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Request failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentResponse = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim();
            continue;
          }

          if (line.startsWith('data:')) {
            const dataStr = line.substring(5).trim();

            try {
              const data = JSON.parse(dataStr);
              const eventType = line.split('\n')[0]?.substring(6)?.trim() || 'unknown';

              // Handle different event types
              switch (eventType) {
                case 'start':
                  // Stream started
                  break;

                case 'chunk':
                  // Text chunk received
                  if (data.text) {
                    currentResponse += data.text;
                    setResponse(currentResponse);
                    if (mergedOptions.onChunk) {
                      mergedOptions.onChunk(data.text);
                    }
                  }
                  break;

                case 'phase':
                  // Phase transition detected
                  if (mergedOptions.onPhase) {
                    mergedOptions.onPhase(data);
                  }
                  break;

                case 'memory':
                  // Memory stored
                  if (mergedOptions.onMemory) {
                    mergedOptions.onMemory(data);
                  }
                  break;

                case 'language':
                  // Language detected
                  if (mergedOptions.onLanguage) {
                    mergedOptions.onLanguage(data);
                  }
                  break;

                case 'speaker':
                  // Speaker recognized
                  if (mergedOptions.onSpeaker) {
                    mergedOptions.onSpeaker(data);
                  }
                  break;

                case 'essence':
                  // Essence applied
                  if (mergedOptions.onEssence) {
                    mergedOptions.onEssence(data);
                  }
                  break;

                case 'driving':
                  // Driving mode enabled
                  if (mergedOptions.onDriving) {
                    mergedOptions.onDriving(data);
                  }
                  break;

                case 'done':
                  // Stream complete
                  setMetadata(data.metadata);
                  if (mergedOptions.onComplete) {
                    mergedOptions.onComplete(currentResponse, data.metadata);
                  }
                  break;

                case 'error':
                  // Error occurred
                  throw new Error(data.message || data.error || 'Stream error');

                default:
                  console.warn('[useChatStream] Unknown event type:', eventType, data);
              }
            } catch (parseError) {
              console.warn('[useChatStream] Failed to parse SSE data:', dataStr, parseError);
            }
          }
        }
      }

      setIsStreaming(false);
      abortControllerRef.current = null;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // Request was aborted, don't set error
          console.log('[useChatStream] Request aborted');
        } else {
          setError(err.message);
          if (mergedOptions.onError) {
            mergedOptions.onError(err.message);
          }
        }
      } else {
        const errorMessage = 'An unknown error occurred';
        setError(errorMessage);
        if (mergedOptions.onError) {
          mergedOptions.onError(errorMessage);
        }
      }
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [options, abort]);

  return {
    sendMessage,
    response,
    isStreaming,
    error,
    metadata,
    abort,
  };
}
