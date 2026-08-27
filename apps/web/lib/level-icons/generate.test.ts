import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateLevelIcons } from './generate';
import { LEVEL_ICON_FILES, levelIconSvg } from './index';

describe('generateLevelIcons', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'level-icons-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes the 103 runtime avatar files and returns their names', () => {
    const written = generateLevelIcons(dir);
    expect(written).toHaveLength(103);
    expect(
      readdirSync(dir)
        .filter((f) => f.endsWith('.svg'))
        .sort(),
    ).toEqual(LEVEL_ICON_FILES.map((f) => f.file).sort());
  });

  it('writes exactly what levelIconSvg() renders (files and live component share one source)', () => {
    generateLevelIcons(dir);
    expect(readFileSync(join(dir, 'level-042.svg'), 'utf8')).toBe(levelIconSvg(42));
    expect(readFileSync(join(dir, 'level-101-cosmic-nexus.svg'), 'utf8')).toBe(
      levelIconSvg(101, { variant101: 'cosmic-nexus' }),
    );
  });

  it('creates the output directory when missing', () => {
    const nested = join(dir, 'a', 'b');
    generateLevelIcons(nested);
    expect(readdirSync(nested)).toHaveLength(103);
  });
});
