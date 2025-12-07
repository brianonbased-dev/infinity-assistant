'use client';

import { useState, useEffect } from 'react';
import { 
  Play, 
  Code, 
  Copy, 
  Check, 
  Loader2, 
  Settings, 
  Key,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { ApiPlayground } from '@/components/ApiPlayground';

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">API Playground</h1>
          <p className="text-gray-400">
            Test Infinity Assistant APIs interactively. No code required.
          </p>
        </div>
        <ApiPlayground />
      </div>
    </div>
  );
}

