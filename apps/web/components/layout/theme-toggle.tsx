'use client';

import { AnimatePresence, m } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Theme Toggle Component
 *
 * A beautiful animated toggle between light and dark themes.
 * Uses system preference by default and persists user choice.
 *
 * Features:
 * - Smooth icon transitions with rotation
 * - Automatic system theme detection
 * - LocalStorage persistence
 * - WCAG AAA accessible
 * - Keyboard navigable
 *
 * Accessibility:
 * - ARIA labels for screen readers
 * - Keyboard shortcuts (Alt+T)
 * - Focus indicators
 * - Live region announcements
 *
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  // Hydration fix - only render after mount
  useEffect(() => {
    setMounted(true);

    // Get stored theme or system preference
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

    const initialTheme = storedTheme || systemTheme;
    setTheme(initialTheme);

    // Sync cookie with localStorage for server-side persistence
    document.cookie = `theme=${initialTheme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;

    // Tailwind 4.x: Set data-theme attribute instead of class
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        // Tailwind 4.x: Set data-theme attribute instead of class
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Keyboard shortcut: Alt+T
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-register handler when theme changes so toggleTheme has current state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Set cookie for server-side theme persistence (prevents flash on reload)
    document.cookie = `theme=${newTheme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;

    // Tailwind 4.x: Set data-theme attribute instead of class
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Prevent flash during SSR
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        disabled
        aria-label="Loading theme toggle"
      >
        <div className="h-5 w-5 animate-pulse bg-muted rounded" />
      </Button>
    );
  }

  return (
    <>
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Current theme: {theme}. Press Alt+T to toggle theme.
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="relative overflow-hidden hover:bg-accent transition-all duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme (Alt+T)`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme (Alt+T)`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {theme === 'dark' ? (
            <m.div
              key="moon"
              initial={{ rotate: -90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: 90, scale: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Moon className="h-5 w-5 text-blue-300" aria-hidden="true" />
            </m.div>
          ) : (
            <m.div
              key="sun"
              initial={{ rotate: -90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: 90, scale: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Sun className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </m.div>
          )}
        </AnimatePresence>

        {/* Glow effect on hover */}
        <m.div
          className="absolute inset-0 rounded-md"
          initial={{ opacity: 0 }}
          whileHover={{
            opacity: 1,
            boxShadow:
              theme === 'dark'
                ? '0 0 20px rgba(96, 165, 250, 0.3)'
                : '0 0 20px rgba(251, 191, 36, 0.3)',
          }}
          transition={{ duration: 0.2 }}
        />
      </Button>
    </>
  );
}
