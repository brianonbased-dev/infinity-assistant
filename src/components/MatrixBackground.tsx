'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Enhanced Matrix Background with φ-Based Movement Patterns
 * Isomorphic port for InfinityAssistant.io
 */

const PHI = 1.618033988749895;
const PHI_INVERSE = 0.618033988749895;
const GOLDEN_ANGLE = 237.508; // Adjusted for visual harmony

interface Drop {
  x: number;
  y: number;
  originalX: number;
  velocity: number;
  wavePhase: number;
  opacity: number;
  char: string;
}

export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handleChange = () => setIsReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const characters =
      '∞═│←→↑↓○●◎◉⟡⬡⬢⬣✓✗⚡⚙⚠⚫⚪✦✧✨✩✪✫✬✭✮✯ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);

    const getGoldenAngleX = (index: number): number => {
      const angle = (index * GOLDEN_ANGLE) % 360;
      return (angle / 360) * canvas.width;
    };

    const assignFibonacciVelocity = (columnIndex: number): number => {
      const fibVelocities = [1, 2, 3, 5, 8, 13];
      const ratio = columnIndex / columns;
      if (ratio < 0.15) return fibVelocities[0];
      if (ratio < 0.3) return fibVelocities[1];
      if (ratio < 0.5) return fibVelocities[2];
      if (ratio < 0.7) return fibVelocities[3];
      if (ratio < 0.85) return fibVelocities[4];
      return fibVelocities[5];
    };

    const drops: Drop[] = Array.from({ length: columns }, (_, i) => {
      const phaseOffset = (i * PHI_INVERSE) % 1;
      const x = getGoldenAngleX(i);
      return {
        x,
        y: -canvas.height * phaseOffset,
        originalX: x,
        velocity: assignFibonacciVelocity(i),
        wavePhase: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.5 + 0.5,
        char: characters[Math.floor(Math.random() * characters.length)],
      };
    });

    let animationFrameId: number;
    let lastTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;
    let time = 0;

    function draw(currentTime: number) {
      if (!ctx || !canvas) return;
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= frameInterval) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${fontSize}px monospace`;

        const waveAmplitude = fontSize * PHI;
        const waveFrequency = PHI_INVERSE / 100;

        for (let i = 0; i < drops.length; i++) {
          const drop = drops[i];
          drop.x =
            drop.originalX + waveAmplitude * Math.sin(drop.y * waveFrequency + drop.wavePhase);

          const opacity = drop.opacity * (0.5 + 0.5 * Math.sin(time * 0.001 + drop.wavePhase));
          ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;

          ctx.fillText(drop.char, drop.x, drop.y);
          drop.y += drop.velocity;

          if (Math.random() > 0.9) {
            drop.char = characters[Math.floor(Math.random() * characters.length)];
          }

          if (drop.y > canvas.height + fontSize) {
            drop.y = -fontSize;
            drop.char = characters[Math.floor(Math.random() * characters.length)];
            drop.opacity = Math.random() * 0.5 + 0.5;
            drop.x = getGoldenAngleX(i);
            drop.originalX = drop.x;
          }
        }
        time += deltaTime;
        lastTime = currentTime - (deltaTime % frameInterval);
      }
      animationFrameId = requestAnimationFrame(draw);
    }

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [isReducedMotion]);

  if (isReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-60"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
