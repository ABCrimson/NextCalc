import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest 4.0 Configuration
 *
 * New features in Vitest 4.0:
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
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**',
      '**/*.e2e.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],

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
      // Vitest 4.0: Enhanced thresholds - enforce quality standards
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Vitest 4.0: Better test isolation
    isolate: true,

    // Restore mocks after each test for proper isolation
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,

    // Vitest 4.0: Improved watch mode
    watch: false,

    // Vitest 4.0: Enhanced reporters
    reporters: ['default'],

    // Increase timeout for async tests
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@/components': resolve(__dirname, './components'),
      '@/lib': resolve(__dirname, './lib'),
      '@/app': resolve(__dirname, './app'),
    },
  },
});
