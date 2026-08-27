import { readdirSync, readFileSync } from 'node:fs';
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
  const LAYOUT = resolve(WEB_ROOT, 'app/layout.tsx');
  const VERSION_LITERAL = /(TypeScript|Tailwind|React|Next\.js|Turbopack)\s+v?\d+\.\d+/g;

  it('the SEO metadata never hardcodes a stack version literal', () => {
    // layout.tsx feeds search results and social cards — it shipped "Next.js 16.2.0"
    // while 16.4 canary was live, invisible to every gate.
    const offenders = [...readFileSync(LAYOUT, 'utf8').matchAll(VERSION_LITERAL)].map((m) => m[0]);
    expect(
      offenders,
      `Hardcoded version literal(s) in app/layout.tsx: ${offenders.join(', ')}. ` +
        'Build the string from STACK_VERSIONS instead.',
    ).toEqual([]);
  });

  it('no locale message hardcodes a stack version literal', () => {
    const dir = resolve(WEB_ROOT, 'messages');
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      for (const m of readFileSync(resolve(dir, file), 'utf8').matchAll(VERSION_LITERAL)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      `Hardcoded version literal(s) in messages/: ${offenders.join(', ')}. ` +
        'Translation copy must not carry version numbers — they go stale in every language at once.',
    ).toEqual([]);
  });

  it('the hero subtitle uses rich-text TAGS, not simple arguments', () => {
    // next-intl only accepts a function for a <tag>. When the message used {react}
    // and the code passed a function, the value rendered as NOTHING and the live
    // sentence read "powered by  + " with two blank gaps.
    const dir = resolve(WEB_ROOT, 'messages');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const messages = JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as {
        home?: { hero?: { subtitle?: string } };
      };
      const subtitle = messages.home?.hero?.subtitle ?? '';
      expect(subtitle, `${file} hero.subtitle must not use {react}`).not.toMatch(/\{react\}/);
      expect(subtitle, `${file} hero.subtitle must not use {nextjs}`).not.toMatch(/\{nextjs\}/);
      expect(subtitle, `${file} hero.subtitle must use <react> tag`).toMatch(/<react>/);
      expect(subtitle, `${file} hero.subtitle must use <nextjs> tag`).toMatch(/<nextjs>/);
    }
  });

  it('the homepage never hardcodes a stack version literal', () => {
    const source = readFileSync(HOMEPAGE, 'utf8');
    const offenders = [...source.matchAll(VERSION_LITERAL)].map((m) => m[0]);

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
