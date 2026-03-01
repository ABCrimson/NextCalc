'use client';

/**
 * InstallPWA Component
 *
 * A fully accessible, type-safe component that prompts users to install
 * the NextCalc Pro Progressive Web App. Follows WCAG 2.2 AAA standards.
 *
 * Features:
 * - Detects beforeinstallprompt event
 * - Provides accessible install button with proper ARIA labels
 * - Keyboard navigation support (Tab, Enter, Escape)
 * - Respects prefers-reduced-motion
 * - Dark mode support
 * - Screen reader friendly
 *
 * @example
 * ```tsx
 * import { InstallPWA } from '@/components/install-pwa';
 *
 * export default function Page() {
 *   return (
 *     <div>
 *       <InstallPWA />
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */

import { Download, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Type-safe interface for BeforeInstallPromptEvent
 * This is not in TypeScript's standard lib, so we define it
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Branded type for installation state
 * Ensures type safety when working with install states
 */
type InstallState =
  | { status: 'hidden'; __brand: 'InstallState' }
  | { status: 'prompted'; __brand: 'InstallState' }
  | { status: 'accepted'; __brand: 'InstallState' }
  | { status: 'dismissed'; __brand: 'InstallState' };

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  /**
   * Handle beforeinstallprompt event
   * This fires when the browser detects the app can be installed
   */
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstall(false);
    }

    // Check for reduced motion preference
    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  /**
   * Handle install button click
   * Triggers the browser's install prompt
   */
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] No install prompt available');
      return;
    }

    setIsInstalling(true);

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowInstall(false);
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('[PWA] Install error:', error);
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  /**
   * Handle dismiss button click
   * Hides the install prompt
   */
  const handleDismiss = useCallback(() => {
    setShowInstall(false);
  }, []);

  /**
   * Handle keyboard events for accessibility
   * Escape key dismisses the prompt
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showInstall) {
        handleDismiss();
      }
    };

    if (showInstall) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInstall, handleDismiss]);

  // Don't render if install prompt is not available
  if (!showInstall) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm"
      role="dialog"
      aria-labelledby="install-pwa-title"
      aria-describedby="install-pwa-description"
    >
      <div
        className="flex flex-col gap-3 p-4 bg-gradient-to-r from-primary to-calculator-operator text-white rounded-2xl shadow-2xl shadow-primary/30 border border-white/10 backdrop-blur-sm transition-all motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:fade-in duration-300"
        style={{
          // Respect prefers-reduced-motion
          animationDuration: prefersReducedMotion ? '0.01ms' : '300ms',
        }}
      >
        {/* Header with dismiss button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 id="install-pwa-title" className="text-lg font-semibold mb-1">
              Install NextCalc Pro
            </h2>
            <p id="install-pwa-description" className="text-sm text-white/90">
              Get quick access and work offline
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 text-white hover:bg-white/20 rounded-full flex-shrink-0"
            aria-label="Dismiss install prompt"
            title="Dismiss (Escape)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Install button */}
        <Button
          onClick={handleInstall}
          disabled={isInstalling}
          size="lg"
          className="w-full bg-white text-primary hover:bg-white/90 shadow-md font-semibold"
          aria-label="Install NextCalc Pro Progressive Web App"
          aria-describedby="install-pwa-description"
        >
          <Download className="mr-2 h-5 w-5" aria-hidden="true" />
          {isInstalling ? 'Installing...' : 'Install App'}
        </Button>

        {/* Benefits list */}
        <ul className="text-xs text-white/80 space-y-1 mt-1">
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-white/60 rounded-full" aria-hidden="true" />
            <span>Works offline</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-white/60 rounded-full" aria-hidden="true" />
            <span>Fast & lightweight</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-white/60 rounded-full" aria-hidden="true" />
            <span>Home screen access</span>
          </li>
        </ul>
      </div>

      {/* Screen reader announcement for installation status */}
      <div role="status" aria-live="polite" className="sr-only">
        {isInstalling && 'Installing NextCalc Pro...'}
      </div>
    </div>
  );
}

/**
 * Export type definitions for use in other components
 */
export type { BeforeInstallPromptEvent, InstallState };
