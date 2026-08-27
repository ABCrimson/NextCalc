#!/usr/bin/env tsx
/**
 * Favicon concepts + the live icon suite.
 *
 *   pnpm icons:favicons                  write the 5 concept SVGs to public/favicons/
 *   pnpm icons:favicons --apply <id>     …and make <id> the live favicon:
 *       public/icon.svg                  the SVG favicon (adaptive, OKLCH)
 *       public/favicon.ico               16 + 32 + 48 (PNG-compressed entries)
 *       public/favicon-16.png, favicon-32.png
 *       public/apple-touch-icon.png      180, full-bleed (iOS applies its own mask)
 *       public/icon-192.png, icon-512.png            squircle, transparent corners
 *       public/icon-192-maskable.png, icon-512-maskable.png   full-bleed (safe zone ≥ 80%)
 *       public/manifest.json + app/layout.tsx        theme/background colors (sRGB hex,
 *                                                     converted from OKLCH by Chromium)
 *
 * Rasterization uses headless Chromium (Playwright): it is the only renderer we
 * have that understands oklch() — sharp/librsvg paints it black.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import {
  FAVICON_CONCEPTS,
  type FaviconId,
  faviconFileName,
  faviconSvg,
  isFaviconId,
} from '../lib/brand/favicons';
import { packIco, pngSize } from '../lib/brand/ico';

const webRoot = join(__dirname, '..');
const publicDir = join(webRoot, 'public');
const conceptsDir = join(publicDir, 'favicons');

async function main(): Promise<void> {
  // 1. Always (re)write the five concept SVGs.
  mkdirSync(conceptsDir, { recursive: true });
  for (const concept of FAVICON_CONCEPTS) {
    writeFileSync(join(conceptsDir, faviconFileName(concept.id)), faviconSvg(concept.id), 'utf8');
  }
  console.log(`Wrote ${FAVICON_CONCEPTS.length} favicon concepts to ${conceptsDir}`);

  // 2. Optionally apply one concept as the live icon suite.
  const applyIndex = process.argv.indexOf('--apply');
  if (applyIndex === -1) return;
  const id = process.argv[applyIndex + 1] ?? '';
  if (!isFaviconId(id)) {
    console.error(`--apply needs one of: ${FAVICON_CONCEPTS.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
  await applyConcept(id);
}

async function applyConcept(id: FaviconId): Promise<void> {
  const masked = faviconSvg(id);
  const bleed = faviconSvg(id, { fullBleed: true });
  writeFileSync(join(publicDir, 'icon.svg'), masked, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 600, height: 600 },
  });

  // One shared page → rasters MUST run sequentially (concurrent setContent calls race).
  const raster = async (svg: string, size: number): Promise<Uint8Array> => {
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}</style><img id="i" src="${uri}" width="${size}" height="${size}">`,
    );
    await page.locator('#i').waitFor();
    const png = new Uint8Array(
      await page.locator('#i').screenshot({ omitBackground: true, type: 'png' }),
    );
    const actual = pngSize(png);
    if (actual.width !== size || actual.height !== size) {
      throw new Error(`raster(${size}) produced ${actual.width}×${actual.height} PNG`);
    }
    return png;
  };

  const write = (name: string, bytes: Uint8Array) => {
    writeFileSync(join(publicDir, name), bytes);
    console.log(`  ${name.padEnd(26)} ${bytes.byteLength.toString().padStart(7)} B`);
  };

  console.log(`Applying "${id}" as the live favicon suite:`);
  const p16 = await raster(masked, 16);
  const p32 = await raster(masked, 32);
  const p48 = await raster(masked, 48);
  write(
    'favicon.ico',
    packIco([
      { size: 16, png: p16 },
      { size: 32, png: p32 },
      { size: 48, png: p48 },
    ]),
  );
  write('favicon-16.png', p16);
  write('favicon-32.png', p32);
  write('apple-touch-icon.png', await raster(bleed, 180));
  write('icon-192.png', await raster(masked, 192));
  write('icon-512.png', await raster(masked, 512));
  write('icon-192-maskable.png', await raster(bleed, 192));
  write('icon-512-maskable.png', await raster(bleed, 512));

  // Theme colors: let Chromium do the OKLCH → sRGB conversion (canvas is sRGB).
  const concept = FAVICON_CONCEPTS.find((c) => c.id === id);
  const themeOklch = `oklch(0.55 0.22 ${concept?.themeHue ?? 264})`;
  const bgOklch = 'oklch(0.17 0.028 268)';
  const toHex = (color: string) =>
    page.evaluate((c) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    }, color);
  const themeHex = await toHex(themeOklch);
  const bgHex = await toHex(bgOklch);
  await browser.close();

  const icoSizes = '16x16 32x32 48x48';
  const manifestPath = join(publicDir, 'manifest.json');
  const manifest = readFileSync(manifestPath, 'utf8')
    .replace(/"theme_color":\s*"[^"]*"/, `"theme_color": "${themeHex}"`)
    .replace(/"background_color":\s*"[^"]*"/, `"background_color": "${bgHex}"`)
    .replace(/("src":\s*"\/favicon\.ico",\s*"sizes":\s*")[^"]*(")/, `$1${icoSizes}$2`);
  writeFileSync(manifestPath, manifest, 'utf8');

  const layoutPath = join(webRoot, 'app', 'layout.tsx');
  const layout = readFileSync(layoutPath, 'utf8');
  const darkThemeRe = /(\{ media: '\(prefers-color-scheme: dark\)', color: ')#[0-9A-Fa-f]{6}(' \})/;
  const icoSizesRe = /(url: '\/favicon\.ico', sizes: ')[^']*(')/;
  if (!darkThemeRe.test(layout)) throw new Error('layout.tsx: dark themeColor entry not found');
  if (!icoSizesRe.test(layout)) throw new Error('layout.tsx: favicon.ico sizes entry not found');
  writeFileSync(
    layoutPath,
    layout.replace(darkThemeRe, `$1${bgHex}$2`).replace(icoSizesRe, `$1${icoSizes}$2`),
    'utf8',
  );

  console.log(`  theme_color ${themeHex} (${themeOklch}), background ${bgHex} (${bgOklch})`);
  console.log(`  manifest.json + app/layout.tsx updated (favicon.ico sizes → ${icoSizes})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
