'use client';

/**
 * Forum Background
 *
 * Shared animated background with floating orbs, noise texture,
 * and dot grid used across all forum pages.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

function FloatingOrb({
  className,
  gradient,
  delay = 0,
}: {
  className: string;
  gradient: string;
  delay?: number;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      className={cn('absolute rounded-full blur-3xl pointer-events-none', className)}
      style={{ background: gradient }}
      {...(prefersReduced
        ? {}
        : {
            animate: {
              x: [0, 30, -20, 0],
              y: [0, -25, 15, 0],
              scale: [1, 1.05, 0.95, 1],
            },
            transition: {
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            },
          })}
      aria-hidden="true"
    />
  );
}

export function ForumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <FloatingOrb
        className="-top-40 -right-40 w-[700px] h-[700px]"
        gradient="radial-gradient(circle, oklch(0.55 0.27 264 / 0.10) 0%, oklch(0.55 0.27 264 / 0.04) 50%, transparent 100%)"
      />
      <FloatingOrb
        className="-bottom-60 -left-40 w-[800px] h-[800px]"
        gradient="radial-gradient(circle, oklch(0.63 0.20 300 / 0.08) 0%, oklch(0.63 0.20 300 / 0.03) 50%, transparent 100%)"
        delay={5}
      />
      <FloatingOrb
        className="top-1/3 right-1/4 w-[500px] h-[500px]"
        gradient="radial-gradient(circle, oklch(0.72 0.18 60 / 0.06) 0%, transparent 70%)"
        delay={10}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, oklch(0.80 0.02 264) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
}
