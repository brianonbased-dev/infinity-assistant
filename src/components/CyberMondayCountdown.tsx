'use client';

import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Cyber Monday sale ends Dec 8, 2025 at midnight
const CYBER_MONDAY_END = new Date('2025-12-08T23:59:59');

export function CyberMondayCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const calculateTimeLeft = (): TimeLeft | null => {
      const now = new Date();
      const difference = CYBER_MONDAY_END.getTime() - now.getTime();

      if (difference <= 0) {
        return null; // Sale ended
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted || !timeLeft) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
          <p className="text-white font-bold text-sm md:text-base">
            🔥 CYBER MONDAY: 50% OFF all Pro plans!
          </p>
          
          {/* Countdown */}
          <div className="flex items-center gap-1 sm:gap-2">
            <CountdownUnit value={timeLeft.days} label="D" />
            <span className="text-white/80 font-bold">:</span>
            <CountdownUnit value={timeLeft.hours} label="H" />
            <span className="text-white/80 font-bold">:</span>
            <CountdownUnit value={timeLeft.minutes} label="M" />
            <span className="text-white/80 font-bold">:</span>
            <CountdownUnit value={timeLeft.seconds} label="S" />
          </div>
          
          <span className="bg-white/20 px-2 py-1 rounded text-white font-bold text-sm">
            CYBER50
          </span>
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-0.5 bg-black/30 rounded px-1.5 py-0.5">
      <span className="text-white font-mono font-bold text-sm sm:text-base min-w-[1.5rem] text-center">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-white/70 text-xs">{label}</span>
    </div>
  );
}

export default CyberMondayCountdown;
