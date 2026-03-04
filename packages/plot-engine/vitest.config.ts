import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @nextcalc/plot-engine
 *
 * Uses happy-dom so that tests exercising DOM-dependent code paths
 * (canvas, Blob, URL.createObjectURL, document.createElement, window
 * event listeners) work without a real browser.
 */
export default defineConfig({
  test: {
    // Matches the environment used across the NextCalc monorepo
    environment: 'happy-dom',

    // Restore spies/mocks after every test automatically
    restoreMocks: true,
    clearMocks: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts'],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
});
