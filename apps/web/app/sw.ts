import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { addEventListeners, createSerwist, RuntimeCache } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// serwist 10 idiom: createSerwist() + addEventListeners() replaces the
// deprecated `new Serwist(...)` class. Runtime caching + the offline fallback
// move into a RuntimeCache extension; precache entries live under `precache`.
const serwist = createSerwist({
  precache: {
    entries: self.__SW_MANIFEST ?? [],
    // Evict stale precache buckets from prior SW versions; parallelize fetches.
    cleanupOutdatedCaches: true,
    concurrency: 10,
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  extensions: [
    new RuntimeCache(defaultCache, {
      fallbacks: {
        entries: [
          {
            url: '/~offline',
            matcher({ request }) {
              return request.destination === 'document';
            },
          },
        ],
      },
    }),
  ],
});

addEventListeners(serwist);
