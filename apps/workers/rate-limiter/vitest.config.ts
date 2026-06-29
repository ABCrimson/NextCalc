import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The `cloudflare:workers` virtual module is only available inside the
      // Cloudflare runtime. Map it to a minimal stub so Node-based Vitest
      // tests can import modules that extend DurableObject without crashing.
      'cloudflare:workers': resolve(import.meta.dirname, 'src/__mocks__/cloudflare-workers.ts'),
    },
  },
  test: {
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
