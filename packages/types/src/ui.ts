/**
 * UI component types
 */

import type React from 'react';

// Theme
export type Theme = 'light' | 'dark' | 'high-contrast';

// Keyboard shortcuts
export interface KeyboardShortcut {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly action: string;
}

// Component props
export interface ButtonProps {
  readonly variant?: 'default' | 'operator' | 'equals' | 'clear';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children: React.ReactNode;
}
