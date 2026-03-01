/**
 * Framer Motion Animation Variants
 *
 * Centralized animation configurations for NextCalc Pro
 * with support for prefers-reduced-motion accessibility
 *
 * @module animations/calculator-animations
 */

import type { Transition, Variants } from 'framer-motion';

/**
 * Creates a reduced motion version of animation variants
 * Respects user's prefers-reduced-motion setting (WCAG 2.1 Level AA)
 */
export function withReducedMotion(variants: Variants, shouldReduceMotion: boolean): Variants {
  if (!shouldReduceMotion) return variants;

  // For reduced motion, only apply opacity changes, no transforms
  const reduced: Variants = {};
  for (const [key, value] of Object.entries(variants)) {
    if (typeof value === 'object' && value !== null) {
      reduced[key] = {
        opacity: 'opacity' in value ? value.opacity : 1,
        transition: { duration: 0.01 }, // Instant transitions for reduced motion
      };
    }
  }
  return reduced;
}

/**
 * Standard easing curves
 */
export const EASINGS = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  sharp: [0.4, 0, 0.6, 1],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
} as const;

/**
 * Standard durations (in seconds)
 */
export const DURATIONS = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
} as const;

/**
 * Fade in animation
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
};

/**
 * Fade in and slide up animation
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
};

/**
 * Fade in and slide down animation
 */
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
};

/**
 * Scale in animation
 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
};

/**
 * Slide in from left animation
 */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
};

/**
 * Slide in from right animation
 */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
};

/**
 * Stagger children animation
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/**
 * Button press animation
 */
export const buttonPress: Variants = {
  rest: { scale: 1 },
  pressed: { scale: 0.95 },
};

/**
 * Button hover animation
 */
export const buttonHover = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: { duration: DURATIONS.fast },
};

/**
 * Card hover animation
 */
export const cardHover: Variants = {
  rest: { scale: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  hover: {
    scale: 1.02,
    boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
    transition: { duration: DURATIONS.fast },
  },
};

/**
 * Result appear animation
 */
export const resultAppear: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
};

/**
 * History item animation
 */
export const historyItem: Variants = {
  hidden: { opacity: 0, x: -20, height: 0 },
  visible: {
    opacity: 1,
    x: 0,
    height: 'auto',
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
  exit: {
    opacity: 0,
    x: 20,
    height: 0,
    transition: { duration: DURATIONS.fast },
  },
};

/**
 * Modal backdrop animation
 */
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Modal content animation
 */
export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: { duration: DURATIONS.fast },
  },
};

/**
 * Tab switch animation
 */
export const tabSwitch: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.fast },
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: { duration: DURATIONS.fast },
  },
};

/**
 * Loading spinner animation
 */
export const spinner = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/**
 * Pulse animation for live updates
 */
export const pulse: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Success checkmark animation
 */
export const successCheck: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { type: 'spring', duration: 0.6, bounce: 0 },
      opacity: { duration: 0.01 },
    },
  },
};

/**
 * Error shake animation
 */
export const errorShake: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.4 },
  },
};

/**
 * Page transition animation
 */
export const pageTransition: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: DURATIONS.fast },
  },
};

/**
 * Number count-up animation configuration
 */
export function getCountUpTransition(from: number, to: number): Transition {
  const duration = Math.min(1, Math.abs(to - from) / 100);
  return {
    duration,
    ease: 'easeOut',
  };
}

/**
 * Plot reveal animation
 */
export const plotReveal: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: EASINGS.easeOut,
    },
  },
};

/**
 * Tooltip animation
 */
export const tooltip: Variants = {
  hidden: { opacity: 0, y: 5, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.15 },
  },
};

/**
 * Dropdown animation
 */
export const dropdown: Variants = {
  hidden: { opacity: 0, y: -10, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: DURATIONS.normal },
  },
  exit: {
    opacity: 0,
    y: -10,
    height: 0,
    transition: { duration: DURATIONS.fast },
  },
};
