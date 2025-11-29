'use client';

/**
 * Chat Message Component
 *
 * Golden Ratio styling:
 * - User messages: Right-aligned, purple (61.8% width max)
 * - Agent messages: Left-aligned, dark gray (61.8% width max)
 * - System messages: Centered, yellow (38.2% width max)
 */

import { User, Sparkles, AlertCircle, Bot, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '../ui/button';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentType?: string;
  isStreaming?: boolean;
  reactions?: {
    thumbsUp?: boolean;
    thumbsDown?: boolean;
  };
}

interface ChatMessageProps {
  message: Message;
  onCopy?: (content: string) => void;
  onReact?: (messageId: string, reaction: 'thumbsUp' | 'thumbsDown') => void;
}

const MAX_WIDTH_USER = '75%';
const MAX_WIDTH_SYSTEM = '50%';

export function ChatMessage({ message, onCopy, onReact }: ChatMessageProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // User messages - right aligned
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="bg-purple-600/20 text-gray-100 border border-purple-500/30 rounded-lg px-4 py-3"
          style={{ maxWidth: MAX_WIDTH_USER }}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          <p className="text-xs text-purple-300/60 mt-1">{formatTime(message.timestamp)}</p>
        </div>
        <div className="ml-2 mt-1 flex-shrink-0">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // System messages - centered
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div
          className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-lg px-4 py-2 flex items-center gap-2"
          style={{ maxWidth: MAX_WIDTH_SYSTEM }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant/Agent messages - left aligned
  return (
    <div className="flex justify-start">
      <div className="mr-2 mt-1 flex-shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
      </div>
      <div
        className="bg-gray-800/50 text-gray-100 border border-gray-700/50 rounded-lg px-4 py-3"
        style={{ maxWidth: MAX_WIDTH_USER }}
      >
        {message.agentType && (
          <div className="text-xs text-purple-400/80 mb-1 font-medium">
            {message.agentType}
          </div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block ml-1 animate-pulse text-purple-400">|</span>
          )}
        </div>

        {/* Footer with timestamp and actions */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>

          {!message.isStreaming && (onCopy || onReact) && (
            <div className="flex items-center gap-1">
              {onCopy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(message.content)}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-300"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
              {onReact && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReact(message.id, 'thumbsUp')}
                    className={`h-6 w-6 p-0 ${
                      message.reactions?.thumbsUp
                        ? 'text-green-400'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReact(message.id, 'thumbsDown')}
                    className={`h-6 w-6 p-0 ${
                      message.reactions?.thumbsDown
                        ? 'text-red-400'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
