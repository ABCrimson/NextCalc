import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @nextcalc/math-engine
 *
 * Pure computation package - no DOM environment needed.
 */
export default defineConfig({
  test: {
    // Node environment is sufficient for math computations
    environment: 'node',

    // Restore spies/mocks after every test automatically
    restoreMocks: true,
    clearMocks: true,

    // Include test files co-located with source
    include: ['src/**/*.test.ts'],

    // typecheck disabled — causes indefinite hang in Vitest.
    // Use `pnpm typecheck` (tsc --noEmit) separately instead.

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts'],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
