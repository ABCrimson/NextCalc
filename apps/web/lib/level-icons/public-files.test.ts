import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAVICON_CONCEPTS, faviconFileName, faviconSvg } from '../brand/favicons';
import { LEVEL_ICON_FILES, levelIconSvg } from './index';

/**
 * The committed public files are runtime DB data (avatar URLs) — this pins them
 * to the generator so art changes can never ship without `pnpm icons:levels` /
 * `pnpm icons:favicons` being re-run.
 */
const PUBLIC = join(__dirname, '..', '..', 'public');

describe('committed public icon files are fresh', () => {
  it('every public/icons/levels/*.svg equals its generator output', () => {
    const stale: string[] = [];
    for (const { file, level, variant101 } of LEVEL_ICON_FILES) {
      const path = join(PUBLIC, 'icons', 'levels', file);
      expect(existsSync(path), `${file} missing — run pnpm icons:levels`).toBe(true);
      const expected = levelIconSvg(level, variant101 ? { variant101 } : {});
      if (readFileSync(path, 'utf8') !== expected) stale.push(file);
    }
    expect(stale, 'stale files — run pnpm icons:levels').toEqual([]);
  });

  it('every public/favicons/*.svg equals its generator output', () => {
    const stale: string[] = [];
    for (const concept of FAVICON_CONCEPTS) {
      const file = faviconFileName(concept.id);
      const path = join(PUBLIC, 'favicons', file);
      expect(existsSync(path), `${file} missing — run pnpm icons:favicons`).toBe(true);
      if (readFileSync(path, 'utf8') !== faviconSvg(concept.id)) stale.push(file);
    }
    expect(stale, 'stale files — run pnpm icons:favicons').toEqual([]);
  });
});
