/**
 * Keyboard Shortcuts Hook
 *
 * Provides centralized keyboard shortcut management for NextCalc Pro
 *
 * @module hooks/use-keyboard-shortcuts
 */

'use client';

import { useEffect, useCallback } from 'react';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'Ctrl+K', 'Alt+C', 'Escape') */
  key: string;
  /** Callback function */
  handler: (event: KeyboardEvent) => void;
  /** Description for help menu */
  description: string;
  /** Category for organization */
  category?: 'calculator' | 'navigation' | 'editing' | 'view';
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
}

/**
 * Predefined shortcuts for NextCalc Pro
 */
export const KEYBOARD_SHORTCUTS: Record<string, Omit<KeyboardShortcut, 'handler'>> = {
  // Calculator shortcuts
  CLEAR: {
    key: 'Escape',
    description: 'Clear input',
    category: 'calculator',
    preventDefault: true,
  },
  EVALUATE: {
    key: 'Enter',
    description: 'Evaluate expression',
    category: 'calculator',
  },
  CTRL_ENTER: {
    key: 'Ctrl+Enter',
    description: 'Evaluate and copy result',
    category: 'calculator',
    preventDefault: true,
  },

  // Navigation shortcuts
  GOTO_CALCULATOR: {
    key: 'Alt+1',
    description: 'Go to Calculator',
    category: 'navigation',
    preventDefault: true,
  },
  GOTO_PLOT_2D: {
    key: 'Alt+2',
    description: 'Go to 2D Plot',
    category: 'navigation',
    preventDefault: true,
  },
  GOTO_PLOT_3D: {
    key: 'Alt+3',
    description: 'Go to 3D Plot',
    category: 'navigation',
    preventDefault: true,
  },
  GOTO_SYMBOLIC: {
    key: 'Alt+4',
    description: 'Go to Symbolic',
    category: 'navigation',
    preventDefault: true,
  },
  GOTO_MATRIX: {
    key: 'Alt+5',
    description: 'Go to Matrix',
    category: 'navigation',
    preventDefault: true,
  },
  GOTO_STATS: {
    key: 'Alt+6',
    description: 'Go to Stats',
    category: 'navigation',
    preventDefault: true,
  },

  // Editing shortcuts
  UNDO: {
    key: 'Ctrl+Z',
    description: 'Undo',
    category: 'editing',
    preventDefault: true,
  },
  REDO: {
    key: 'Ctrl+Y',
    description: 'Redo',
    category: 'editing',
    preventDefault: true,
  },
  SELECT_ALL: {
    key: 'Ctrl+A',
    description: 'Select all',
    category: 'editing',
  },
  COPY: {
    key: 'Ctrl+C',
    description: 'Copy',
    category: 'editing',
  },

  // View shortcuts
  TOGGLE_THEME: {
    key: 'Ctrl+Shift+T',
    description: 'Toggle dark/light theme',
    category: 'view',
    preventDefault: true,
  },
  TOGGLE_HISTORY: {
    key: 'Ctrl+H',
    description: 'Toggle calculation history',
    category: 'view',
    preventDefault: true,
  },
  ZOOM_IN: {
    key: 'Ctrl+=',
    description: 'Zoom in',
    category: 'view',
    preventDefault: true,
  },
  ZOOM_OUT: {
    key: 'Ctrl+-',
    description: 'Zoom out',
    category: 'view',
    preventDefault: true,
  },
  HELP: {
    key: '?',
    description: 'Show keyboard shortcuts',
    category: 'view',
    preventDefault: true,
  },
};

/**
 * Parse key combination string into matcher
 */
function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1]!;

  const hasCtrl = parts.includes('ctrl') || parts.includes('control');
  const hasAlt = parts.includes('alt');
  const hasShift = parts.includes('shift');
  const hasMeta = parts.includes('meta') || parts.includes('cmd');

  return (
    event.key.toLowerCase() === key &&
    event.ctrlKey === hasCtrl &&
    event.altKey === hasAlt &&
    event.shiftKey === hasShift &&
    event.metaKey === hasMeta
  );
}

/**
 * Hook to register keyboard shortcuts
 *
 * @param shortcuts - Array of shortcut definitions
 * @param enabled - Whether shortcuts are enabled
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 'Ctrl+K',
 *     handler: () => openCommandPalette(),
 *     description: 'Open command palette',
 *   },
 *   {
 *     key: 'Escape',
 *     handler: () => closeModal(),
 *     description: 'Close modal',
 *   },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true
): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut.key)) {
          // Allow some shortcuts even in input fields
          const allowInInput = ['Escape', 'Enter', 'Ctrl+A', 'Ctrl+C', 'Ctrl+V'];
          if (isInput && !allowInInput.some(k => matchesShortcut(event, k))) {
            continue;
          }

          if (shortcut.preventDefault) {
            event.preventDefault();
          }

          shortcut.handler(event);
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for calculator-specific shortcuts
 */
export function useCalculatorShortcuts(handlers: {
  onClear?: () => void;
  onEvaluate?: () => void;
  onEvaluateAndCopy?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}): void {
  const shortcuts: KeyboardShortcut[] = [
    handlers.onClear && {
      ...KEYBOARD_SHORTCUTS['CLEAR'],
      handler: handlers.onClear,
    },
    handlers.onEvaluate && {
      ...KEYBOARD_SHORTCUTS['EVALUATE'],
      handler: handlers.onEvaluate,
    },
    handlers.onEvaluateAndCopy && {
      ...KEYBOARD_SHORTCUTS['CTRL_ENTER'],
      handler: handlers.onEvaluateAndCopy,
    },
    handlers.onUndo && {
      ...KEYBOARD_SHORTCUTS['UNDO'],
      handler: handlers.onUndo,
    },
    handlers.onRedo && {
      ...KEYBOARD_SHORTCUTS['REDO'],
      handler: handlers.onRedo,
    },
  ].filter(Boolean) as KeyboardShortcut[];

  useKeyboardShortcuts(shortcuts);
}

/**
 * Hook for navigation shortcuts
 */
export function useNavigationShortcuts(router: {
  push: (path: string) => void;
}): void {
  const gotoCalc = KEYBOARD_SHORTCUTS['GOTO_CALCULATOR'];
  const gotoPlot2D = KEYBOARD_SHORTCUTS['GOTO_PLOT_2D'];
  const gotoPlot3D = KEYBOARD_SHORTCUTS['GOTO_PLOT_3D'];
  const gotoSymbolic = KEYBOARD_SHORTCUTS['GOTO_SYMBOLIC'];
  const gotoMatrix = KEYBOARD_SHORTCUTS['GOTO_MATRIX'];
  const gotoStats = KEYBOARD_SHORTCUTS['GOTO_STATS'];

  const shortcuts: KeyboardShortcut[] = [
    {
      key: gotoCalc?.key ?? '',
      handler: () => router.push('/'),
      description: gotoCalc?.description ?? '',
      ...(gotoCalc?.category !== undefined && { category: gotoCalc.category }),
      ...(gotoCalc?.preventDefault !== undefined && { preventDefault: gotoCalc.preventDefault }),
    },
    {
      key: gotoPlot2D?.key ?? '',
      handler: () => router.push('/plot'),
      description: gotoPlot2D?.description ?? '',
      ...(gotoPlot2D?.category !== undefined && { category: gotoPlot2D.category }),
      ...(gotoPlot2D?.preventDefault !== undefined && { preventDefault: gotoPlot2D.preventDefault }),
    },
    {
      key: gotoPlot3D?.key ?? '',
      handler: () => router.push('/plot3d'),
      description: gotoPlot3D?.description ?? '',
      ...(gotoPlot3D?.category !== undefined && { category: gotoPlot3D.category }),
      ...(gotoPlot3D?.preventDefault !== undefined && { preventDefault: gotoPlot3D.preventDefault }),
    },
    {
      key: gotoSymbolic?.key ?? '',
      handler: () => router.push('/symbolic'),
      description: gotoSymbolic?.description ?? '',
      ...(gotoSymbolic?.category !== undefined && { category: gotoSymbolic.category }),
      ...(gotoSymbolic?.preventDefault !== undefined && { preventDefault: gotoSymbolic.preventDefault }),
    },
    {
      key: gotoMatrix?.key ?? '',
      handler: () => router.push('/matrix'),
      description: gotoMatrix?.description ?? '',
      ...(gotoMatrix?.category !== undefined && { category: gotoMatrix.category }),
      ...(gotoMatrix?.preventDefault !== undefined && { preventDefault: gotoMatrix.preventDefault }),
    },
    {
      key: gotoStats?.key ?? '',
      handler: () => router.push('/stats'),
      description: gotoStats?.description ?? '',
      ...(gotoStats?.category !== undefined && { category: gotoStats.category }),
      ...(gotoStats?.preventDefault !== undefined && { preventDefault: gotoStats.preventDefault }),
    },
  ];

  useKeyboardShortcuts(shortcuts);
}

/**
 * Get all shortcut descriptions for help menu
 */
export function getShortcutDescriptions(): Record<string, Array<{
  key: string;
  description: string;
}>> {
  const categories: Record<string, Array<{key: string; description: string}>> = {
    calculator: [],
    navigation: [],
    editing: [],
    view: [],
  };

  for (const [, shortcut] of Object.entries(KEYBOARD_SHORTCUTS)) {
    if (!shortcut) continue;
    const category = shortcut.category ?? 'view';
    const categoryArray = categories[category];
    if (categoryArray) {
      categoryArray.push({
        key: shortcut.key,
        description: shortcut.description,
      });
    }
  }

  return categories;
}
