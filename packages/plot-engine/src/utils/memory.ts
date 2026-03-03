/**
 * Typed helper for Chrome's non-standard `performance.memory` API.
 *
 * `performance.memory` is a Chrome-only extension that is not part of the
 * Web Performance specification. Accessing it through the standard
 * `Performance` interface therefore requires a local extension type rather
 * than a blanket `unknown` cast.
 *
 * @module utils/memory
 */

interface ChromePerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

/**
 * Returns the current JS heap size in bytes as reported by Chrome's
 * `performance.memory.usedJSHeapSize`, or `0` on browsers that do not
 * expose this non-standard property.
 */
export function getJSHeapUsage(): number {
  return (performance as ChromePerformance).memory?.usedJSHeapSize ?? 0;
}
