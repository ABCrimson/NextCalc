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
  },
});
