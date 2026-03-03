'use client';

/**
 * LazyMotion Provider
 *
 * Wraps the application in framer-motion's LazyMotion provider so that
 * components can use the lightweight `m` component instead of `motion`.
 *
 * The `motion` component bundles all animation features (~34 kB gzipped).
 * The `m` component loads only what's needed at render time and defers
 * the rest to the LazyMotion provider, enabling code-splitting of the
 * animation runtime.
 *
 * - `domAnimation` includes: animate, exit, variants, transition, whileHover,
 *   whileTap, whileFocus, whileInView, layout (basic).
 * - `domMax` adds: drag, pan, layout animations (advanced), and more.
 *
 * We use `domAnimation` since the app primarily uses animate/exit/variants.
 * Components that need drag or advanced layout can import `motion` directly.
 *
 * @see https://www.framer.com/motion/lazy-motion/
 */

import { domAnimation, LazyMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict={false}>
      {children}
    </LazyMotion>
  );
}
