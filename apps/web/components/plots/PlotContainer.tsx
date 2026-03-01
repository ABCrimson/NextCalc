'use client';

/**
 * Modernized container component for plots with enhanced loading, error states, and error boundaries
 * Features: Backdrop-filter blur effects, skeleton screens, responsive layouts, glass-morphism design
 * Accessibility: WCAG 2.2 AAA compliant with proper ARIA roles and live regions
 * @module components/plots/PlotContainer
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import type { ErrorInfo, ReactNode } from 'react';
import { Component, Suspense } from 'react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export interface PlotContainerProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
}

// Animation variants for smooth transitions
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
    },
  },
};

const errorVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

const skeletonVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const skeletonItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
    },
  },
};

/**
 * Beautiful skeleton loading screen for plots
 * Provides visual feedback while plot is rendering
 */
function PlotSkeleton() {
  return (
    <motion.div
      variants={skeletonVariants}
      initial="hidden"
      animate="visible"
      className="
        relative rounded-xl p-6
        bg-gradient-to-br from-background/60 via-card/50 to-background/60
        backdrop-blur-md border border-border
        shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
        overflow-hidden
      "
      role="status"
      aria-live="polite"
      aria-label="Loading plot visualization"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-blue-500/5 animate-pulse" />

      <div className="relative space-y-4">
        {/* Header skeleton */}
        <motion.div variants={skeletonItemVariants} className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 bg-muted/50" />
          <Skeleton className="h-8 w-32 bg-muted/50" />
        </motion.div>

        {/* Plot area skeleton */}
        <motion.div variants={skeletonItemVariants} className="relative">
          <Skeleton className="h-[400px] w-full bg-muted/50 rounded-lg" />
          {/* Animated loader overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground/80">Rendering visualization...</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Preparing GPU-accelerated plot
              </p>
            </div>
          </div>
        </motion.div>

        {/* Controls skeleton */}
        <motion.div variants={skeletonItemVariants} className="flex gap-2">
          <Skeleton className="h-10 w-24 bg-muted/50" />
          <Skeleton className="h-10 w-24 bg-muted/50" />
          <Skeleton className="h-10 w-32 bg-muted/50 ml-auto" />
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * Beautiful error UI with retry functionality
 * Provides clear feedback and recovery options
 */
function PlotError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <motion.div
      variants={errorVariants}
      initial="hidden"
      animate="visible"
      className="
        relative rounded-xl p-8
        bg-gradient-to-br from-red-950/40 via-red-900/30 to-red-950/40
        backdrop-blur-md border border-red-800/50
        shadow-[0_8px_32px_0_rgba(220,38,38,0.2)]
        overflow-hidden
      "
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-500/5 animate-pulse" />

      <div className="relative text-center max-w-md mx-auto">
        {/* Error icon with animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-red-900/50 border-2 border-red-500/50"
        >
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </motion.div>

        {/* Error message */}
        <h3 className="text-xl font-semibold text-red-200 mb-2">Visualization Error</h3>
        <p className="text-sm text-red-300/90 mb-6 leading-relaxed">{error}</p>

        {/* Retry button */}
        {onRetry && (
          <Button
            onClick={onRetry}
            className="
              bg-gradient-to-br from-red-800/60 to-red-900/60
              hover:from-red-700/70 hover:to-red-800/70
              border border-red-600/50 hover:border-red-500/70
              text-red-100 hover:text-red-50
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500
              transition-all duration-200
            "
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}

        {/* Help text */}
        <p className="text-xs text-red-400/70 mt-4">
          If this persists, try refreshing the page or checking your input values
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Error Boundary class component for catching React errors
 * Provides graceful error handling with beautiful UI
 */
class PlotErrorBoundary extends Component<
  { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: {
    children: ReactNode;
    fallback?: (error: Error, reset: () => void) => ReactNode;
  }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Plot rendering error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }
      return (
        <PlotError
          error={
            this.state.error.message || 'An unexpected error occurred while rendering the plot'
          }
          onRetry={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Modernized Plot Container Component
 * Implements glass-morphism design with responsive layouts and accessibility features
 */
export function PlotContainer({
  children,
  title,
  description,
  className = '',
  isLoading = false,
  error = null,
}: PlotContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`flex flex-col gap-4 ${className}`}
    >
      {/* Header section with glass-morphism */}
      <AnimatePresence mode="wait">
        {(title || description) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="
              relative p-4 rounded-xl
              bg-gradient-to-br from-background/40 via-card/30 to-background/40
              backdrop-blur-sm border border-border
              shadow-[0_4px_16px_0_rgba(0,0,0,0.2)]
            "
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/3 to-purple-500/3 pointer-events-none" />

            <div className="relative">
              {title && (
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-cyan-400" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
                </div>
              )}
              {description && (
                <p className="text-sm text-muted-foreground leading-relaxed ml-7">{description}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area with responsive container */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <PlotError error={error} />
            </motion.div>
          ) : isLoading ? (
            <motion.div
              key="loading"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <PlotSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <PlotErrorBoundary>
                <Suspense fallback={<PlotSkeleton />}>
                  <div
                    className="
                      relative rounded-xl
                      bg-gradient-to-br from-background/60 via-card/50 to-background/60
                      backdrop-blur-md border border-border
                      shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
                      overflow-hidden
                    "
                  >
                    {/* Subtle gradient overlay for depth */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                    {/* Content */}
                    <div className="relative">{children}</div>
                  </div>
                </Suspense>
              </PlotErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Export error boundary for external use
export { PlotErrorBoundary };
