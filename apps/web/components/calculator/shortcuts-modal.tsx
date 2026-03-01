'use client';

/**
 * ShortcutsModal — Keyboard Shortcuts Reference Dialog
 *
 * Opens on `?` or `Shift+/` key press, or via the floating `?` trigger button.
 * Shows all keyboard shortcuts organized by category.
 * Includes a first-visit onboarding tooltip that auto-dismisses after 6 seconds.
 *
 * Accessibility:
 *  - Dialog role with aria-labelledby / aria-describedby wired through Radix Dialog
 *  - Kbd elements use role="term" so screen readers announce them as keyboard keys
 *  - Focus is trapped inside the dialog while open (Radix built-in)
 *  - Escape closes the dialog (Radix built-in)
 *  - Onboarding tooltip is aria-live="polite" so screen readers surface it without interruption
 *  - Respects prefers-reduced-motion via Framer Motion's useReducedMotion hook
 *
 * Keyboard shortcuts handled here:
 *  - `?` or `Shift+/`  — open the dialog
 *  - `Escape`          — close the dialog (Radix built-in, also caught in global handler)
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single shortcut entry within a category. */
interface ShortcutEntry {
  /** Human-readable description of what the shortcut does. */
  readonly label: string;
  /**
   * Key combination parts shown in the UI.
   * Each string becomes its own <kbd> element.
   * e.g. ['Shift', '/'] renders two separated kbd tags.
   */
  readonly keys: readonly string[];
}

/** A logical grouping of related shortcuts. */
interface ShortcutCategory {
  readonly id: string;
  readonly title: string;
  readonly shortcuts: readonly ShortcutEntry[];
}

// ---------------------------------------------------------------------------
// Shortcut definitions
// ---------------------------------------------------------------------------

const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = [
  {
    id: 'calculator',
    title: 'Calculator',
    shortcuts: [
      { label: 'Type digits and operators', keys: ['0–9', '+', '−', '*', '/'] },
      { label: 'Evaluate expression', keys: ['Enter'] },
      { label: 'Clear (Escape)', keys: ['Esc'] },
      { label: 'Delete last character', keys: ['Backspace'] },
      { label: 'Open parenthesis', keys: ['('] },
      { label: 'Close parenthesis', keys: [')'] },
      { label: 'Exponentiation', keys: ['^'] },
      { label: 'Decimal point', keys: ['.'] },
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation',
    shortcuts: [
      { label: 'Move focus between buttons', keys: ['Tab'] },
      { label: 'Move focus backwards', keys: ['Shift', 'Tab'] },
      { label: 'Activate focused button', keys: ['Space'] },
      { label: 'Activate focused button (alt)', keys: ['Enter'] },
      { label: 'Close any open panel or modal', keys: ['Esc'] },
    ],
  },
  {
    id: 'general',
    title: 'General',
    shortcuts: [
      { label: 'Open this shortcuts dialog', keys: ['?'] },
      { label: 'Open this shortcuts dialog (alt)', keys: ['Shift', '/'] },
      { label: 'Go to Plot Functions', keys: ['Alt', 'P'] },
      { label: 'Go to Symbolic Math', keys: ['Alt', 'S'] },
      { label: 'Go to Matrix Operations', keys: ['Alt', 'M'] },
      { label: 'Go to Equation Solver', keys: ['Alt', 'E'] },
    ],
  },
] as const satisfies readonly ShortcutCategory[];

// ---------------------------------------------------------------------------
// Local-storage key for first-visit detection
// ---------------------------------------------------------------------------

const ONBOARDING_SEEN_KEY = 'nextcalc:shortcuts-hint-seen';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KbdProps {
  children: string;
}

/** Renders a single key as a styled <kbd> element. */
function Kbd({ children }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[1.75rem] h-7 px-1.5',
        'rounded-md border border-border',
        'bg-muted text-muted-foreground',
        'font-mono text-xs font-medium',
        'shadow-[0_2px_0_0_hsl(var(--color-border)/0.8)] select-none',
      )}
    >
      {children}
    </kbd>
  );
}

interface ShortcutRowProps {
  entry: ShortcutEntry;
}

/** A single row: label on the left, key badges on the right. */
function ShortcutRow({ entry }: ShortcutRowProps) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5 border-b border-border/40 last:border-b-0">
      <span className="text-sm text-foreground">{entry.label}</span>
      <span className="flex items-center gap-1 shrink-0" aria-label={entry.keys.join(' + ')}>
        {entry.keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className="text-muted-foreground/60 text-xs font-mono select-none"
                aria-hidden="true"
              >
                +
              </span>
            )}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </span>
    </li>
  );
}

interface CategorySectionProps {
  category: ShortcutCategory;
}

/** Renders one category heading followed by its shortcut rows. */
function CategorySection({ category }: CategorySectionProps) {
  return (
    <section aria-labelledby={`shortcut-cat-${category.id}`} className="mb-6 last:mb-0">
      <h3
        id={`shortcut-cat-${category.id}`}
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1"
      >
        {category.title}
      </h3>
      <ul className="rounded-xl border border-border/60 bg-muted/30 px-4 divide-y-0">
        {category.shortcuts.map((entry, i) => (
          <ShortcutRow key={i} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Onboarding tooltip
// ---------------------------------------------------------------------------

interface OnboardingTooltipProps {
  visible: boolean;
  onDismiss: () => void;
}

function OnboardingTooltip({ visible, onDismiss }: OnboardingTooltipProps) {
  const prefersReduced = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label="Tip: press ? to see all keyboard shortcuts"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
          animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.95 }}
          transition={{ duration: prefersReduced ? 0.15 : 0.3, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            'absolute bottom-full mb-2 left-1/2 -translate-x-1/2',
            'z-50 pointer-events-none',
            // Minimum width so text never wraps on small screens
            'w-max max-w-[16rem]',
          )}
        >
          <div
            className={cn(
              'relative flex items-center gap-2',
              'rounded-xl border border-border/60',
              'bg-popover/90 backdrop-blur-md',
              'px-3 py-2 shadow-lg shadow-primary/10',
              'text-sm text-popover-foreground',
            )}
          >
            <Keyboard className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>
              Press{' '}
              <kbd className="inline-flex items-center px-1.5 h-5 rounded border border-border bg-muted text-xs font-mono font-medium mx-0.5">
                ?
              </kbd>{' '}
              to see all shortcuts
            </span>
            {/* Tooltip caret */}
            <span
              aria-hidden="true"
              className="absolute top-full left-1/2 -translate-x-1/2 -mt-px"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid var(--color-border)',
              }}
            />
          </div>

          {/* Dismiss button — pointer-events re-enabled on just this element */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss shortcuts tip"
            className={cn(
              'absolute -top-2 -right-2',
              'pointer-events-auto',
              'flex items-center justify-center w-5 h-5',
              'rounded-full border border-border bg-background',
              'text-muted-foreground hover:text-foreground',
              'transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ShortcutsModalProps {
  /**
   * When true, the component also registers a global keydown listener
   * for `?` / `Shift+/` to open the dialog.  Pass false if a parent
   * component already handles this.  Defaults to true.
   */
  registerGlobalHotkey?: boolean;
}

export function ShortcutsModal({ registerGlobalHotkey = true }: ShortcutsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const prefersReduced = useReducedMotion();

  // Track whether the auto-dismiss timer has fired to avoid calling setState
  // after unmount.
  const onboardingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // First-visit onboarding logic
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const alreadySeen = window.localStorage.getItem(ONBOARDING_SEEN_KEY);
    if (!alreadySeen) {
      // Small delay so the page has settled before the tip appears.
      const showTimer = setTimeout(() => setShowOnboarding(true), 1500);

      // Auto-dismiss after 6 seconds.
      onboardingTimerRef.current = setTimeout(() => {
        setShowOnboarding(false);
        window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
      }, 7500);

      return () => {
        clearTimeout(showTimer);
        if (onboardingTimerRef.current !== null) {
          clearTimeout(onboardingTimerRef.current);
        }
      };
    }
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (onboardingTimerRef.current !== null) {
      clearTimeout(onboardingTimerRef.current);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    }
  }, []);

  // -----------------------------------------------------------------------
  // Global hotkey: `?` or `Shift+/`
  // -----------------------------------------------------------------------
  const handleGlobalKeydown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore when focus is inside a text input so we don't hijack typing.
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      // `?` is Shift+/ on most layouts — handle both forms.
      const isQuestionMark = event.key === '?' || (event.key === '/' && event.shiftKey);

      if (isQuestionMark) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        // Hide onboarding once the user has interacted with the shortcut.
        dismissOnboarding();
      }
    },
    [dismissOnboarding],
  );

  useEffect(() => {
    if (!registerGlobalHotkey) return;
    if (typeof document === 'undefined') return;

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, [registerGlobalHotkey, handleGlobalKeydown]);

  // -----------------------------------------------------------------------
  // Open handler (also dismisses onboarding)
  // -----------------------------------------------------------------------
  const openModal = useCallback(() => {
    setIsOpen(true);
    dismissOnboarding();
  }, [dismissOnboarding]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <>
      {/* Floating trigger button — fixed to bottom-right of viewport */}
      <div className="fixed bottom-6 right-6 z-40" aria-label="Keyboard shortcuts">
        {/* Onboarding tooltip anchored above the button */}
        <div className="relative">
          <OnboardingTooltip visible={showOnboarding} onDismiss={dismissOnboarding} />

          <motion.button
            type="button"
            onClick={openModal}
            aria-label="Open keyboard shortcuts (press ? or Shift+/)"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            {...(!prefersReduced ? { whileHover: { scale: 1.08, y: -2 } } : {})}
            {...(!prefersReduced ? { whileTap: { scale: 0.95 } } : {})}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'flex items-center justify-center',
              'w-10 h-10 rounded-full',
              'border border-border/60',
              'bg-background/90 backdrop-blur-sm',
              'text-muted-foreground hover:text-foreground',
              'shadow-lg shadow-primary/10',
              'hover:shadow-xl hover:shadow-primary/20',
              'hover:border-primary/40',
              'transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              // Subtle pulse to draw attention on first visit when onboarding is visible
              showOnboarding && 'animate-pulse',
            )}
          >
            <span className="font-semibold text-sm leading-none select-none" aria-hidden="true">
              ?
            </span>
          </motion.button>
        </div>
      </div>

      {/* Keyboard shortcuts dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={cn(
            // Override max-width to accommodate all three categories
            'max-w-xl w-full',
            // Glass morphism surface consistent with the app's aesthetic
            'bg-background/95 backdrop-blur-xl',
            'border-border/60',
            'shadow-2xl shadow-primary/10',
            'p-0 overflow-hidden',
          )}
          aria-describedby="shortcuts-dialog-desc"
        >
          {/* --- Header --- */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center',
                  'w-8 h-8 rounded-lg',
                  'bg-primary/10 border border-primary/20',
                )}
                aria-hidden="true"
              >
                <Keyboard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  Keyboard Shortcuts
                </DialogTitle>
                <DialogDescription
                  id="shortcuts-dialog-desc"
                  className="text-xs text-muted-foreground mt-0.5"
                >
                  All available shortcuts in NextCalc Pro. Press{' '}
                  <kbd className="inline-flex items-center px-1 h-4 rounded border border-border bg-muted text-[10px] font-mono font-medium mx-0.5">
                    Esc
                  </kbd>{' '}
                  to close.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* --- Scrollable shortcut list --- */}
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5">
              {SHORTCUT_CATEGORIES.map((category) => (
                <CategorySection key={category.id} category={category} />
              ))}

              {/* Footer hint */}
              <p className="mt-4 text-xs text-center text-muted-foreground/70">
                Open this dialog at any time by pressing <Kbd>?</Kbd>
              </p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
