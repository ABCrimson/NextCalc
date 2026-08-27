#!/usr/bin/env tsx
/**
 * Generate Level Icons — the 103 static SVG avatar files.
 *
 * Outputs public/icons/levels/level-001.svg … level-100.svg plus the three
 * level-101 Architect variants. The art lives in `lib/level-icons` (shared with
 * the live `LevelIcon` React component); this script only writes files.
 *
 * Usage (from apps/web):  pnpm icons:levels   (= tsx scripts/generate-level-icons.ts)
 */

import { join } from 'node:path';
import { generateLevelIcons } from '../lib/level-icons/generate';

const outDir = join(__dirname, '..', 'public', 'icons', 'levels');
const files = generateLevelIcons(outDir);
console.log(`Generated ${files.length} level icons in ${outDir}`);
