/**
 * Vitest Setup File
 * @testing-library/react 16.3.2
 * @testing-library/jest-dom 6.9.1
 * jest-axe 10.0.0
 * happy-dom 20.6.3
 */

import { expect, afterEach, beforeEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { toHaveNoViolations } from 'jest-axe';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Extend Vitest's expect with jest-axe matchers (jest-axe 10.x compatible)
expect.extend(toHaveNoViolations);

// Ensure happy-dom is fully initialized before tests run
// This prevents race conditions with the first test in each file
beforeAll(() => {
  // Force DOM initialization by accessing properties
  if (typeof document !== 'undefined') {
    // Trigger document initialization
    document.createElement('div');
    // Ensure event listeners are available
    if (typeof document.addEventListener === 'function') {
      // DOM is ready
    }
  }
  if (typeof window !== 'undefined') {
    // Trigger window initialization
    window.dispatchEvent(new Event('load'));
  }
});

// Reset Zustand stores before each test for proper isolation
beforeEach(() => {
  // Clear localStorage to reset persisted Zustand state
  localStorage.clear();
  sessionStorage.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia for reduced motion tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })),
});

// Mock clipboard API using Object.defineProperty (navigator.clipboard is getter-only)
const clipboardMock = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve('')),
  write: vi.fn(() => Promise.resolve()),
  read: vi.fn(() => Promise.resolve([])),
};

Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
  configurable: true,
});

// Reset clipboard mock before each test
beforeEach(() => {
  clipboardMock.writeText.mockClear();
  clipboardMock.readText.mockClear();
  clipboardMock.write.mockClear();
  clipboardMock.read.mockClear();
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: readonly number[] = [];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit
  ) {}

  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

// Mock scrollIntoView (not implemented in happy-dom)
Element.prototype.scrollIntoView = vi.fn();

// Mock pointer capture methods (not implemented in happy-dom, needed by Radix UI)
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// Mock crypto.randomUUID if not available
if (!crypto.randomUUID) {
  crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
}

// Mock window.innerWidth/innerHeight for responsive tests
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

// Track event listeners for cleanup (document might not be fully ready yet)
const eventListeners = new Map<string, Set<EventListener>>();
let documentMocksInitialized = false;

// Initialize document mocks safely in beforeEach
beforeEach(() => {
  if (!documentMocksInitialized && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    // Only initialize once and only if document is available
    documentMocksInitialized = true;
  }
  // Clear listeners map for each test
  eventListeners.clear();
});

// Clean up event listeners after each test
afterEach(() => {
  eventListeners.clear();
});

// Mock @tanstack/react-virtual for testing (virtualized lists don't render in tests)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, getScrollElement: _getScrollElement }: { count: number; getScrollElement: () => HTMLElement | null }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 110,
        size: 110,
        end: (index + 1) * 110,
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * 110,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
    measure: vi.fn(),
    measureElement: vi.fn(),
  }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => {
  const React = require('react');

  // Filter out framer-motion specific props that React doesn't recognize
  const filterMotionProps = (props: Record<string, any>) => {
    const motionProps = [
      'initial', 'animate', 'exit', 'transition', 'variants',
      'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
      'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
      'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
      'custom', 'inherit', 'style'
    ];
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
      if (!motionProps.includes(key)) {
        filtered[key] = value;
      }
    }
    // Restore style if it's valid CSS
    if (props['style'] && typeof props['style'] === 'object') {
      filtered['style'] = props['style'];
    }
    return filtered;
  };

  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.createElement('div', { ...filterMotionProps(props), ref }, children)
      ),
      button: React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.createElement('button', { ...filterMotionProps(props), ref }, children)
      ),
      span: React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.createElement('span', { ...filterMotionProps(props), ref }, children)
      ),
    },
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({
      start: vi.fn(),
      set: vi.fn(),
    }),
    useMotionValue: (initial: any) => ({
      get: () => initial,
      set: vi.fn(),
      onChange: vi.fn(),
    }),
    useTransform: (value: any, _transformer: any) => value,
    useSpring: (value: any) => value,
  };
});
