'use client';

/**
 * Chat Input Component
 *
 * Golden Ratio sizing:
 * - Input height: phi * 24px ~ 39px optimal
 * - Button width: phi * 24px ~ 39px (square with golden proportion)
 * - Padding: phi-based spacing
 */

import { useState, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

const PHI = 1.618;
const INPUT_HEIGHT = Math.floor(24 * PHI); // ~39px

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Type a message...',
  isLoading,
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled && !isLoading) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={1}
        className="flex-1 resize-none border border-gray-700 bg-gray-800 text-gray-100 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
        style={{
          minHeight: `${INPUT_HEIGHT}px`,
          maxHeight: `${INPUT_HEIGHT * 3}px`, // Max 3 lines
        }}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim() || isLoading}
        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
        style={{
          width: `${INPUT_HEIGHT}px`,
          height: `${INPUT_HEIGHT}px`,
        }}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
