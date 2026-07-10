import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// UPSTREAM BLOCKER (2026-07-09): @cloudflare/vitest-pool-workers was
// evaluated for this worker's DO storage read-modify-write path (the
// strongest candidate of the 3 workers, per repo convention). Latest
// published version is 0.18.4 (npm dist-tag "latest"; no newer prerelease
// exists) and its peerDependencies pin `vitest: "^4.1.0"` — this repo runs
// vitest 5.0.0-beta.6, which falls outside that range. Adopting
// defineWorkersConfig now would require downgrading vitest for this worker
// alone (against this repo's evergreen-bleeding-edge policy) or forcing an
// incompatible peer install. Deferred until @cloudflare/vitest-pool-workers
// publishes a release with `vitest: "^5"` in peerDependencies — re-check
// https://www.npmjs.com/package/@cloudflare/vitest-pool-workers then.
// Staying on the plain Node `environment: 'node'` + cloudflare:workers stub
// setup below in the meantime.
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
