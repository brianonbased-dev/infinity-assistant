'use client';

import { useState } from 'react';
import { Terminal, Shield, Cpu, ChevronRight } from 'lucide-react';

interface TerminalInterfaceProps {
  onSignup: (email: string) => void;
}

export function TerminalInterface({ onSignup }: TerminalInterfaceProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onSignup(email);
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto font-mono text-green-400 relative z-10">
      {/* Terminal Window */}
      <div className="bg-black/90 border border-green-500/30 rounded-lg backdrop-blur-md shadow-[0_0_20px_rgba(0,255,0,0.1)] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-900/90 px-4 py-2 border-b border-green-500/20 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/70"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/70"></div>
          </div>
          <div className="flex-1 text-center text-xs opacity-60">
            root@uAA2++:~/context-management
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold animate-pulse text-green-300">
              Initializing Context Protocol...
            </h1>
            <p className="text-green-400/80 leading-relaxed">
              &gt; Seamlessly integrate Infinity Assistant knowledge into your IDE.
              <br />
              &gt; Maintain cognitive continuity across sessions.
              <br />
              &gt; Access the uAA2++ Pattern Library directly.
            </p>
          </div>


          <div className="border-t border-green-500/20 pt-6">
            <h3 className="text-sm font-bold text-green-300 mb-4">&gt; SELECT_PROTOCOL_TIER</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dev Core Tier - Cheaper/Streamlined */}
              <div className="border border-green-500/40 bg-green-900/10 p-4 rounded hover:bg-green-900/20 transition-all cursor-pointer group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 bg-green-500/20 rounded-bl text-[10px] font-bold">EARLY_ACCESS</div>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-lg">DEV_CORE</div>
                  <div className="font-mono text-green-300">$19/mo</div>
                </div>
                <ul className="text-xs space-y-1 opacity-80 font-mono mb-4">
                  <li>[+] Raw Context Access</li>
                  <li>[+] Headless API</li>
                  <li>[+] State Persistence</li>
                  <li>[+] No GUI Overhead</li>
                </ul>
                <div className="text-xs text-green-500 group-hover:text-green-400 font-bold">
                  &gt; INIT_CORE_ACCESS()
                </div>
              </div>

              {/* Enterprise/Custom Tier */}
              <div className="border border-green-500/20 bg-black/40 p-4 rounded hover:border-green-500/40 transition-all cursor-pointer group">
                 <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-lg">ENTERPRISE</div>
                  <div className="font-mono">CUSTOM</div>
                </div>
                 <ul className="text-xs space-y-1 opacity-60 font-mono mb-4">
                  <li>[+] Self-Hosted Options</li>
                  <li>[+] Custom fine-tuning</li>
                  <li>[+] SLA Guarantee</li>
                  <li>[+] Dedicated Support</li>
                </ul>
                 <div className="text-xs text-green-500/60 group-hover:text-green-400 font-bold">
                  &gt; CONTACT_SALES()
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
            <div className="border border-green-500/20 p-4 rounded bg-green-500/5 hover:border-green-500/50 transition-colors">
              <Cpu className="w-6 h-6 mb-2 text-green-400" />
              <h3 className="font-bold text-sm mb-1">State Persistence</h3>
              <p className="text-xs text-green-400/60">Never lose your train of thought.</p>
            </div>
            <div className="border border-green-500/20 p-4 rounded bg-green-500/5 hover:border-green-500/50 transition-colors">
              <Shield className="w-6 h-6 mb-2 text-green-400" />
              <h3 className="font-bold text-sm mb-1">Secure Context</h3>
              <p className="text-xs text-green-400/60">Local-first, encrypted memory.</p>
            </div>
          </div>

          {submitted ? (
            <div className="border border-green-500 p-4 rounded bg-green-500/10 text-center">
              <p className="text-lg font-bold">Access Granted.</p>
              <p className="text-sm opacity-80 mt-1">We will contact you via encrypted channel.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <label className="block text-xs uppercase tracking-wider mb-1 opacity-70">
                  Enter Secure Identifier (Email)
                </label>
                <div className="flex items-center gap-2 bg-gray-900 border border-green-500/50 rounded p-3 focus-within:ring-1 focus-within:ring-green-400">
                  <ChevronRight className="w-4 h-4 animate-pulse" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-transparent border-none outline-none flex-1 text-green-300 placeholder-green-800"
                    placeholder="dev@example.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500 text-green-400 font-bold rounded transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                REQUEST ACCESS
              </button>
            </form>
          )}

          <div className="text-center text-xs opacity-40 pt-4">
            <p>uAA2++ Protocol v2.0 • Status: ONLINE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
