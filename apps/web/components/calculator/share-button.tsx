'use client';

/**
 * ShareButton — Calculator share control
 *
 * Renders a Share button in the calculator display area. On click it opens a
 * small popover that persists the calculation to the database via the
 * `shareCalculation` GraphQL mutation. The resulting permalink is shown and
 * can be copied to the clipboard or shared via the native Web Share API.
 *
 * Falls back to a query-param-based share URL when the mutation fails
 * (e.g. the API is unreachable).
 *
 * Accessibility:
 *   - All interactive elements are keyboard-reachable (Tab / Enter / Space).
 *   - Focus returns to the trigger button when the popover closes (Radix Popover).
 *   - Screen reader announcements use an `aria-live="polite"` region.
 *   - Respects `prefers-reduced-motion` for animations.
 *
 * @module components/calculator/share-button
 */

import { useMutation } from '@apollo/client/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, ExternalLink, Loader2, Share2 } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SHARE_CALCULATION_MUTATION } from '@/lib/graphql/operations';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import {
  copyPermalinkUrl,
  copyShareUrl,
  createPermalinkUrl,
  createShareUrl,
  type SharePayload,
} from '@/lib/share';
import { cn } from '@/lib/utils';

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
type ShareState = 'idle' | 'creating' | 'ready' | 'fallback';

/** Mutation response shape for shareCalculation. */
interface ShareCalculationData {
  shareCalculation: {
    id: string;
    shortCode: string;
    latex: string;
    expression: string;
    title: string | null;
    description: string | null;
    result: string | null;
    createdAt: string;
  } | null;
}

// ---------------------------------------------------------------------------
// LaTeX conversion (mirrors display.tsx)
// ---------------------------------------------------------------------------

function convertToLatex(expr: string): string {
  return expr
    .replace(/\*/g, '\\cdot ')
    .replace(/\^/g, '^')
    .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
    .replace(/pi/g, '\\pi')
    .replace(/sin\((.*?)\)/g, '\\sin($1)')
    .replace(/cos\((.*?)\)/g, '\\cos($1)')
    .replace(/tan\((.*?)\)/g, '\\tan($1)');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline status line shown below the URL preview. */
function StatusLine({ status, shareState }: { status: CopyStatus; shareState: ShareState }) {
  if (shareState === 'creating') {
    return (
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-xs mt-1 font-medium text-muted-foreground"
      >
        Creating share link...
      </p>
    );
  }

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
function UrlPreview({ url, isLoading }: { url: string; isLoading: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 border border-border px-3 py-2">
      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-mono text-muted-foreground">Generating permalink...</p>
        </div>
      ) : (
        <p
          className="text-xs font-mono text-muted-foreground truncate select-all"
          title={url}
          aria-label="Shareable URL"
        >
          {url}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShareButton({ expression, result, mode, angle, className }: ShareButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [hasWebShare, setHasWebShare] = useState(false);
  const [shortCode, setShortCode] = useState<string | null>(null);

  // Detect Web Share API availability (browser-side only)
  useEffect(() => {
    setHasWebShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Unique ID for the aria-describedby relationship
  const descId = useId();

  // Apollo mutation for persisting the share
  const [shareCalculation] = useMutation<ShareCalculationData>(SHARE_CALCULATION_MUTATION);

  // Build the payload from current props
  const buildPayload = useCallback(
    (): SharePayload => ({
      expression,
      ...(result !== undefined ? { result } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(angle !== undefined ? { angle } : {}),
    }),
    [expression, result, mode, angle],
  );

  // Derived URL shown in the preview
  const [previewUrl, setPreviewUrl] = useState('');

  // When the popover opens, call the mutation to persist and get a short code
  const handleOpenChange = useCallback(
    async (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setCopyStatus('idle');
        setShareState('creating');
        setShortCode(null);

        // Show fallback URL while mutation is in-flight
        const fallbackUrl = createShareUrl(buildPayload());
        setPreviewUrl(fallbackUrl);

        try {
          const latex = convertToLatex(expression);
          const { data } = await shareCalculation({
            variables: {
              latex,
              expression,
              ...(result !== undefined ? { result } : {}),
            },
          });

          if (data?.shareCalculation?.shortCode) {
            const code = data.shareCalculation.shortCode;
            const permalink = createPermalinkUrl(code);
            setShortCode(code);
            setPreviewUrl(permalink);
            setShareState('ready');
          } else {
            // Mutation returned but no data — use fallback
            setShareState('fallback');
          }
        } catch {
          // API unreachable — use URL-param fallback
          setShareState('fallback');
        }
      } else {
        setShareState('idle');
        setShortCode(null);
      }
    },
    [buildPayload, expression, result, shareCalculation],
  );

  // Reset timer ref — cleared on unmount and before each new reset
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    setCopyStatus('copying');

    let success: boolean;
    if (shortCode) {
      // Copy the permalink
      success = await copyPermalinkUrl(shortCode);
    } else {
      // Fallback: copy the URL-param link
      success = await copyShareUrl(buildPayload());
    }

    setCopyStatus(success ? 'copied' : 'error');

    if (success) {
      // Clear any pending reset timer before scheduling a new one
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setCopyStatus('idle');
        resetTimerRef.current = null;
      }, 2500);
    }
  }, [buildPayload, shortCode]);

  // Clear the reset timer when the component unmounts
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Web Share API
  const handleWebShare = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;

    const url = shortCode ? createPermalinkUrl(shortCode) : createShareUrl(buildPayload());
    const shareText = expression
      ? `${expression}${result ? ` = ${result}` : ''}`
      : 'Check out this calculation on NextCalc Pro!';

    try {
      await navigator.share({
        title: 'NextCalc Pro Calculation',
        text: shareText,
        url,
      });
    } catch (err) {
      // AbortError means the user dismissed — not a true failure
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        // silently ignore other errors
      }
    }
    // Close popover after sharing regardless of result
    setOpen(false);
  }, [buildPayload, expression, result, shortCode]);

  const isDisabled = expression.trim() === '';
  const isCreating = shareState === 'creating';

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
                    {shareState === 'ready'
                      ? 'Anyone with this link can view your calculation.'
                      : shareState === 'creating'
                        ? 'Creating a permanent share link...'
                        : 'Anyone with this link can view your calculation.'}
                  </p>
                </div>

                {/* URL Preview */}
                <UrlPreview url={previewUrl} isLoading={isCreating} />

                {/* Status announcement */}
                <StatusLine status={copyStatus} shareState={shareState} />

                {/* Actions */}
                <div className="mt-3 flex flex-col gap-2">
                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={copyStatus === 'copying' || isCreating}
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
                          initial={
                            prefersReducedMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }
                          }
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                          className="flex items-center gap-2"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Copied!
                        </motion.span>
                      ) : isCreating ? (
                        <motion.span
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.12 }}
                          className="flex items-center gap-2"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Creating...
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
                      disabled={isCreating}
                      className={cn(
                        'flex items-center justify-center gap-2 w-full rounded-xl px-3 py-2.5',
                        'text-sm font-medium transition-all duration-200',
                        'border border-border bg-background text-foreground',
                        'hover:bg-accent hover:border-accent-foreground/20 hover:shadow-md',
                        'active:scale-[0.98]',
                        'disabled:pointer-events-none disabled:opacity-60',
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
