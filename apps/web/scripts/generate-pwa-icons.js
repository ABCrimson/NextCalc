#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 *
 * This script generates PNG icons from the SVG source for PWA usage.
 *
 * Requirements:
 * - sharp: npm install -D sharp
 *
 * Usage:
 * - node scripts/generate-pwa-icons.js
 *
 * Or manually:
 * 1. Open public/icon.svg in a browser
 * 2. Take screenshots at 192x192 and 512x512
 * 3. Save as icon-192.png and icon-512.png in public/
 */

const path = require('path');

async function generateIcons() {
  try {
    // Try to import sharp
    const sharp = require('sharp');

    const svgPath = path.join(__dirname, '../public/icon.svg');
    const outputDir = path.join(__dirname, '../public');

    console.log('Generating PWA icons...');

    // Generate 192x192 icon
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(outputDir, 'icon-192.png'));
    console.log('✓ Generated icon-192.png');

    // Generate 512x512 icon
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(outputDir, 'icon-512.png'));
    console.log('✓ Generated icon-512.png');

    // Generate maskable icons (with safe zone padding)
    await sharp(svgPath)
      .resize(192, 192)
      .extend({
        top: 20,
        bottom: 20,
        left: 20,
        right: 20,
        background: { r: 37, g: 99, b: 235, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-192-maskable.png'));
    console.log('✓ Generated icon-192-maskable.png');

    await sharp(svgPath)
      .resize(512, 512)
      .extend({
        top: 53,
        bottom: 53,
        left: 53,
        right: 53,
        background: { r: 37, g: 99, b: 235, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-512-maskable.png'));
    console.log('✓ Generated icon-512-maskable.png');

    console.log('\n✨ All icons generated successfully!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('⚠️  Sharp is not installed. Installing now...');
      console.log('\nRun: npm install -D sharp\n');
      console.log('Then run this script again: node scripts/generate-pwa-icons.js\n');
      console.log('Alternatively, you can:');
      console.log('1. Open apps/web/public/icon.svg in a browser');
      console.log('2. Take screenshots at 192x192 and 512x512 resolution');
      console.log('3. Save as icon-192.png and icon-512.png in apps/web/public/');
    } else {
      console.error('Error generating icons:', error);
    }
  }
}

generateIcons();
