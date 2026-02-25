'use client';

/**
 * ShareButton — Calculator share control
 *
 * Renders a Share button in the calculator display area. On click it opens a
 * small popover with two actions:
 *   1. "Copy Link" — copies the shareable URL to the clipboard and shows a
 *      brief inline toast confirmation.
 *   2. "Share" — opens the native Web Share sheet when the API is available.
 *      Rendered only when `navigator.share` is detected.
 *
 * Accessibility:
 *   - All interactive elements are keyboard-reachable (Tab / Enter / Space).
 *   - Focus returns to the trigger button when the popover closes (Radix Popover).
 *   - Screen reader announcements use an `aria-live="polite"` region.
 *   - Respects `prefers-reduced-motion` for animations.
 *
 * @module components/calculator/share-button
 */

import { useState, useCallback, useId, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  createShareUrl,
  copyShareUrl,
  shareViaWebAPI,
  type SharePayload,
} from '@/lib/share';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props accepted by ShareButton. */
export interface ShareButtonProps {
  /** The expression currently shown in the display. An empty string disables the button. */
  readonly expression: string;
  /** The evaluated result (stringified). Optional — omitted if no result yet. */
  readonly result?: string;
  /** Current calculator mode. */
  readonly mode?: 'exact' | 'approximate';
  /** Current angle mode. */
  readonly angle?: 'deg' | 'rad';
  /** Additional CSS class names for the trigger button wrapper. */
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Copy status state — discriminated union for clearer intent
// ---------------------------------------------------------------------------

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline status line shown below the URL preview. */
function StatusLine({ status }: { status: CopyStatus }) {
  const messages: Record<CopyStatus, string | null> = {
    idle: null,
    copying: 'Copying...',
    copied: 'Link copied to clipboard!',
    error: 'Failed to copy. Please copy the URL manually.',
  };

  const msg = messages[status];
  if (!msg) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'text-xs mt-1 font-medium transition-colors',
        status === 'copied' && 'text-calculator-equals',
        status === 'error' && 'text-destructive',
        status === 'copying' && 'text-muted-foreground',
      )}
    >
      {msg}
    </p>
  );
}

/** Small URL preview badge inside the popover. */
function UrlPreview({ url }: { url: string }) {
  return (
    <div className="rounded-lg bg-muted/60 border border-border px-3 py-2">
      <p
        className="text-xs font-mono text-muted-foreground truncate select-all"
        title={url}
        aria-label="Shareable URL"
      >
        {url}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShareButton({
  expression,
  result,
  mode,
  angle,
  className,
}: ShareButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [hasWebShare, setHasWebShare] = useState(false);

  // Detect Web Share API availability (browser-side only)
  useEffect(() => {
    setHasWebShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Unique ID for the aria-describedby relationship
  const descId = useId();

  // Build the payload from current props
  const buildPayload = useCallback((): SharePayload => ({
    expression,
    ...(result !== undefined ? { result } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(angle !== undefined ? { angle } : {}),
  }), [expression, result, mode, angle]);

  // Derived URL shown in the preview (recomputed when popover opens)
  const [previewUrl, setPreviewUrl] = useState('');

  // Update the preview URL when the popover opens
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setPreviewUrl(createShareUrl(buildPayload()));
      setCopyStatus('idle');
    }
  }, [buildPayload]);

  // Reset timer ref — cleared on unmount and before each new reset
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    setCopyStatus('copying');
    const success = await copyShareUrl(buildPayload());
    setCopyStatus(success ? 'copied' : 'error');

    if (success) {
      // Clear any pending reset timer before scheduling a new one
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setCopyStatus('idle');
        resetTimerRef.current = null;
      }, 2500);
    }
  }, [buildPayload]);

  // Clear the reset timer when the component unmounts
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Web Share API
  const handleWebShare = useCallback(async () => {
    await shareViaWebAPI(buildPayload(), 'NextCalc Pro Calculation');
    // Close popover after sharing regardless of result
    setOpen(false);
  }, [buildPayload]);

  const isDisabled = expression.trim() === '';

  // Animation variants respecting prefers-reduced-motion
  const popoverVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.96, y: -6 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: -6 },
      };

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDisabled}
          aria-label="Share this calculation"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={isDisabled ? undefined : descId}
          className={cn(
            'gap-1.5 text-muted-foreground hover:text-foreground transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            className,
          )}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          <span>Share</span>
        </Button>
      </PopoverPrimitive.Trigger>

      {/* Hidden description for screen readers */}
      <span id={descId} className="sr-only">
        Opens a panel to copy a shareable link or open the native share sheet.
      </span>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          role="dialog"
          aria-label="Share calculation"
          className="z-50 w-72 outline-none"
          onOpenAutoFocus={(e) => {
            // Prevent Radix from stealing focus away from the first focusable
            // child — we manage focus ourselves below.
            e.preventDefault();
          }}
        >
          <AnimatePresence mode="wait">
            {open && (
              <motion.div
                key="share-popover"
                variants={popoverVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className={cn(
                  'rounded-2xl border border-border bg-popover p-4 shadow-xl shadow-primary/10',
                  'ring-1 ring-white/5',
                  // glass-heavy from globals.css
                  'backdrop-blur-xl',
                )}
              >
                {/* Header */}
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground leading-none">
                    Share Calculation
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Anyone with this link can view your calculation.
                  </p>
                </div>

                {/* URL Preview */}
                <UrlPreview url={previewUrl} />

                {/* Status announcement */}
                <StatusLine status={copyStatus} />

                {/* Actions */}
                <div className="mt-3 flex flex-col gap-2">
                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={copyStatus === 'copying'}
                    autoFocus
                    className={cn(
                      'flex items-center justify-center gap-2 w-full rounded-xl px-3 py-2.5',
                      'text-sm font-semibold transition-all duration-200',
                      'bg-primary text-primary-foreground',
                      'hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5',
                      'active:scale-[0.98]',
                      'disabled:pointer-events-none disabled:opacity-60',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    )}
                    aria-label={
                      copyStatus === 'copied'
                        ? 'Link copied to clipboard'
                        : 'Copy link to clipboard'
                    }
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copyStatus === 'copied' ? (
                        <motion.span
                          key="check"
                          initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                          className="flex items-center gap-2"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Copied!
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.12 }}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          Copy Link
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>

                  {/* Web Share API — only rendered when available */}
                  {hasWebShare && (
                    <button
                      type="button"
                      onClick={handleWebShare}
                      className={cn(
                        'flex items-center justify-center gap-2 w-full rounded-xl px-3 py-2.5',
                        'text-sm font-medium transition-all duration-200',
                        'border border-border bg-background text-foreground',
                        'hover:bg-accent hover:border-accent-foreground/20 hover:shadow-md',
                        'active:scale-[0.98]',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      )}
                      aria-label="Share via system share sheet"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Share via...
                    </button>
                  )}
                </div>

                {/* Expression summary */}
                {expression && (
                  <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground font-mono truncate">
                    <span className="text-foreground/50 mr-1">expr:</span>
                    {expression}
                    {result !== undefined && (
                      <>
                        <span className="text-foreground/40 mx-1">=</span>
                        <span className="text-calculator-equals">{result}</span>
                      </>
                    )}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
