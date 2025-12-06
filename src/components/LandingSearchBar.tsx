'use client';

/**
 * Landing Page Search Bar
 * 
 * Prominent search bar for the landing page that says "ask me anything"
 * Connects users directly to the assistant with web and knowledge base access.
 * This is where experimental knowledge will be accumulated.
 */

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import logger from '@/utils/logger';

interface LandingSearchBarProps {
  onSearch?: (query: string) => void;
  className?: string;
}

export function LandingSearchBar({ onSearch, className = '' }: LandingSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    setIsLoading(true);
    logger.info('[LandingSearchBar] User query submitted:', { query: query.substring(0, 50) });

    try {
      // If custom handler provided, use it
      if (onSearch) {
        onSearch(query);
        return;
      }

      // Otherwise, navigate to chat with query
      // This will open the chat interface with the query pre-filled
      router.push(`/?view=chat&q=${encodeURIComponent(query)}`);
    } catch (error) {
      logger.error('[LandingSearchBar] Error handling search:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative w-full max-w-3xl mx-auto ${className}`}
    >
      <div
        className={`
          relative flex items-center gap-3
          bg-black/60 backdrop-blur-sm
          border-2 rounded-2xl
          transition-all duration-300
          ${focused 
            ? 'border-purple-500/80 shadow-lg shadow-purple-500/20 scale-[1.02]' 
            : 'border-purple-500/30 hover:border-purple-500/50'
          }
          px-4 py-4 md:px-6 md:py-5
        `}
      >
        {/* Search Icon */}
        <div className="flex-shrink-0">
          <Search className={`w-5 h-5 md:w-6 md:h-6 transition-colors ${
            focused ? 'text-purple-400' : 'text-gray-400'
          }`} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Ask me anything..."
          className="
            flex-1 bg-transparent border-none outline-none
            text-white text-lg md:text-xl
            placeholder:text-gray-500
            focus:placeholder:text-gray-600
          "
          disabled={isLoading}
        />

        {/* AI Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-purple-300 font-medium">AI Powered</span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="
            flex-shrink-0
            w-10 h-10 md:w-12 md:h-12
            flex items-center justify-center
            bg-gradient-to-r from-purple-600 to-blue-600
            hover:from-purple-500 hover:to-blue-500
            disabled:from-gray-600 disabled:to-gray-600
            disabled:cursor-not-allowed
            rounded-xl
            transition-all
            shadow-lg shadow-purple-500/30
            hover:shadow-purple-500/50
            hover:scale-110
            active:scale-95
          "
          aria-label="Search"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <ArrowRight className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Helper Text */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-400">
          Access to <span className="text-purple-400">web search</span> and{' '}
          <span className="text-blue-400">knowledge base</span> • Experimental knowledge collection
        </p>
      </div>
    </form>
  );
}

