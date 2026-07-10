import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest 5 Configuration
 *
 * Notable features:
 * - Improved browser mode
 * - Better TypeScript integration
 * - Enhanced coverage reporting
 * - Workspace support improvements
 *
 * @see https://vitest.dev/config/
 */
export default defineConfig({
  plugins: [],
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    // Test environment
    environment: 'happy-dom',
    globals: true,

    // Setup files
    setupFiles: ['./vitest.setup.ts'],

    // IMPORTANT: Exclude e2e tests (Playwright) from Vitest
    // Playwright tests use different APIs and should be run separately
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', '**/*.e2e.{ts,tsx}'],

    // Include patterns for unit and integration tests
    include: ['**/*.test.{ts,tsx}'],

    // Coverage configuration with v8 provider
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/types/**',
        '**/*.d.ts',
        'e2e/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Full mock isolation between tests. Vitest 5 defaults clearMocks to true;
    // restoreMocks/mockReset are deliberate overrides of the (false) defaults.
    restoreMocks: true,
    mockReset: true,

    watch: false,

    reporters: ['default'],

    // Increase timeout for async tests
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './'),
      '@/components': resolve(import.meta.dirname, './components'),
      '@/lib': resolve(import.meta.dirname, './lib'),
      '@/app': resolve(import.meta.dirname, './app'),
    },
  },
});
