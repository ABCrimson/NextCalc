/**
 * Write the 103 static level-icon SVG files (runtime DB data — production
 * `User.image` rows reference `/icons/levels/level-NNN.svg`).
 *
 * Pure function so it can be tested; `scripts/generate-level-icons.ts` is the CLI.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEVEL_ICON_FILES, levelIconSvg } from './index';

/** Generate every level icon into `outDir`; returns the written filenames. */
export function generateLevelIcons(outDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  return LEVEL_ICON_FILES.map(({ file, level, variant101 }) => {
    const svg = levelIconSvg(level, variant101 ? { variant101 } : {});
    writeFileSync(join(outDir, file), svg, 'utf8');
    return file;
  });
}
