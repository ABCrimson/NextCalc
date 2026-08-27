import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatVersion, STACK_MANIFEST_KEYS } from '../lib/stack-versions';

/**
 * Guards the homepage hero badges against version drift.
 *
 * History: the badges were hardcoded JSX literals and shipped "TypeScript 6.0"
 * / "Tailwind 4.3.2" to production while the manifest had moved on. No existing
 * gate could catch it — a stale string typechecks, lints and passes every test.
 * These tests close that hole.
 */

const WEB_ROOT = resolve(import.meta.dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(WEB_ROOT, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const pin = (name: string): string | undefined =>
  pkg.dependencies[name] ?? pkg.devDependencies[name];

describe('formatVersion', () => {
  it('keeps a stable pin verbatim, patch included', () => {
    expect(formatVersion('4.3.3')).toBe('4.3.3');
    expect(formatVersion('19.2.0')).toBe('19.2.0');
  });

  it('collapses a prerelease pin to major.minor-channel', () => {
    expect(formatVersion('7.1.0-dev.20260826.1')).toBe('7.1-dev');
    expect(formatVersion('19.3.0-canary-a1124489-20260826')).toBe('19.3-canary');
    expect(formatVersion('16.4.0-canary.9')).toBe('16.4-canary');
    expect(formatVersion('5.0.0-rc.2')).toBe('5.0-rc');
    expect(formatVersion('8.0.0-beta.3')).toBe('8.0-beta');
  });

  it('never claims a prerelease is stable', () => {
    for (const raw of ['7.1.0-dev.20260826.1', '16.4.0-canary.9', '5.0.0-rc.2']) {
      expect(formatVersion(raw)).toMatch(/-(dev|canary|rc|beta|alpha)$/);
    }
  });

  it('degrades safely on missing or unparseable input', () => {
    expect(formatVersion(undefined)).toBe('');
    expect(formatVersion('')).toBe('');
    expect(formatVersion('workspace:*')).toBe('workspace:*');
  });
});

describe('badge wiring', () => {
  const nextConfig = readFileSync(resolve(WEB_ROOT, 'next.config.ts'), 'utf8');
  const stackModule = readFileSync(resolve(WEB_ROOT, 'lib/stack-versions.ts'), 'utf8');

  it('sources every badge from a dependency that actually exists', () => {
    for (const [badge, manifestKey] of Object.entries(STACK_MANIFEST_KEYS)) {
      expect(
        pin(manifestKey),
        `${badge} -> ${manifestKey} missing from package.json`,
      ).toBeDefined();
    }
  });

  it('injects the same env names the client module reads', () => {
    const declared = [...nextConfig.matchAll(/NEXT_PUBLIC_STACK_[A-Z]+/g)].map((m) => m[0]);
    const consumed = [...stackModule.matchAll(/NEXT_PUBLIC_STACK_[A-Z]+/g)].map((m) => m[0]);

    expect(new Set(declared)).toEqual(new Set(consumed));
    expect(declared.length).toBe(Object.keys(STACK_MANIFEST_KEYS).length);
  });

  it('injects each badge from its documented manifest key', () => {
    expect(nextConfig).toMatch(/NEXT_PUBLIC_STACK_TYPESCRIPT:\s*pin\('typescript'\)/);
    expect(nextConfig).toMatch(/NEXT_PUBLIC_STACK_TAILWIND:\s*pin\('tailwindcss'\)/);
    expect(nextConfig).toMatch(/NEXT_PUBLIC_STACK_REACT:\s*pin\('react'\)/);
    expect(nextConfig).toMatch(/NEXT_PUBLIC_STACK_NEXT:\s*pin\('next'\)/);
  });
});

describe('no hardcoded versions in user-facing copy', () => {
  const HOMEPAGE = resolve(WEB_ROOT, 'app/[locale]/page.tsx');

  it('the homepage never hardcodes a stack version literal', () => {
    const source = readFileSync(HOMEPAGE, 'utf8');
    const offenders = [
      ...source.matchAll(/(TypeScript|Tailwind|React|Next\.js|Turbopack)\s+v?\d+\.\d+/g),
    ].map((m) => m[0]);

    expect(
      offenders,
      `Hardcoded version literal(s) in app/[locale]/page.tsx: ${offenders.join(', ')}. ` +
        'Render STACK_VERSIONS from lib/stack-versions.ts instead — hardcoded strings ' +
        'silently shipped a stale major version to production once already.',
    ).toEqual([]);
  });

  it('the homepage renders the derived constants', () => {
    const source = readFileSync(HOMEPAGE, 'utf8');
    for (const key of Object.keys(STACK_MANIFEST_KEYS)) {
      expect(source).toContain(`STACK_VERSIONS.${key}`);
    }
  });
});
