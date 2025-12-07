'use client';

import { MatrixBackground } from '@/components/MatrixBackground';
import { TerminalInterface } from '@/components/TerminalInterface';
import { Code, Play } from 'lucide-react';
import Link from 'next/link';
import logger from '@/utils/logger';

export default function DevelopersPage() {
  const handleSignup = async (email: string) => {
    // In a real implementation, this would call an API route
    logger.info(`[DeveloperPage] New context management interest: ${email}`);
    
    // Simulate API call
    try {
      // await fetch('/api/waitlist', ...); // Commented out for now
      
      // Simulate success and redirect
      setTimeout(() => {
        window.location.href = '/developers/console';
      }, 1500);

    } catch (error) {
      console.error('Failed to submit waitlist', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      {/* Matrix Background - z-index 0 */}
      <MatrixBackground />
      
      {/* Content - z-index 10 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {/* Quick Links */}
        <div className="mb-8 flex gap-4">
          <Link
            href="/developers/playground"
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
          >
            <Play className="w-5 h-5" />
            <span>API Playground</span>
          </Link>
          <Link
            href="/developers/console"
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Code className="w-5 h-5" />
            <span>Developer Console</span>
          </Link>
        </div>
        
        <TerminalInterface onSignup={handleSignup} />
      </div>
    </div>
  );
}
