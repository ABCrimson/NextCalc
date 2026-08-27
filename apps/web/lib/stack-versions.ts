/**
 * Homepage tech-badge versions, derived from this package's manifest.
 *
 * WHY THIS EXISTS: the hero badges used to be hardcoded JSX literals
 * ("TypeScript 6.0", "Tailwind 4.3.2"). Nothing in the gate can catch a stale
 * string — typecheck, lint and the full test suite all pass regardless of what
 * a <span> says — so they silently drifted a full major version behind the
 * lockfile and shipped that to production. The raw pins are now injected at
 * build time from package.json by next.config.ts and formatted here, so the
 * marketing copy cannot diverge from what actually ships.
 *
 * NEVER hardcode a dependency version in a component. `stack-versions.test.ts`
 * fails the build if a version literal reappears in the homepage source.
 */

/** Raw pins injected by next.config.ts; inlined as string literals at build time. */
const RAW = {
  typescript: process.env['NEXT_PUBLIC_STACK_TYPESCRIPT'],
  tailwind: process.env['NEXT_PUBLIC_STACK_TAILWIND'],
  react: process.env['NEXT_PUBLIC_STACK_REACT'],
  next: process.env['NEXT_PUBLIC_STACK_NEXT'],
} as const;

/**
 * Render an exact npm pin as display copy.
 *
 * Stable releases keep their full `major.minor.patch`; prerelease pins collapse
 * to `major.minor-<channel>` so a badge stays readable without ever pretending
 * a canary is a stable release.
 *
 * @example formatVersion('4.3.3')                         // '4.3.3'
 * @example formatVersion('7.1.0-dev.20260826.1')          // '7.1-dev'
 * @example formatVersion('19.3.0-canary-a112-20260826')   // '19.3-canary'
 */
export function formatVersion(raw: string | undefined): string {
  if (!raw) return '';
  const match = /^(\d+)\.(\d+)(?:\.\d+)?(?:[-+](.*))?$/.exec(raw.trim());
  if (!match) return raw.trim();

  const [, major, minor, prerelease] = match;
  if (!prerelease) {
    // Stable: show the pin verbatim (patch included).
    return raw.trim();
  }
  // Prerelease: first alphabetic token is the channel (dev, canary, rc, beta…).
  const channel = /[a-z]+/i.exec(prerelease)?.[0]?.toLowerCase();
  return channel ? `${major}.${minor}-${channel}` : `${major}.${minor}`;
}

/** Display-ready versions for the homepage hero badges. */
export const STACK_VERSIONS = {
  typescript: formatVersion(RAW.typescript),
  tailwind: formatVersion(RAW.tailwind),
  react: formatVersion(RAW.react),
  next: formatVersion(RAW.next),
} as const;

/** The manifest keys each badge is sourced from — asserted by the test. */
export const STACK_MANIFEST_KEYS = {
  typescript: 'typescript',
  tailwind: 'tailwindcss',
  react: 'react',
  next: 'next',
} as const;
