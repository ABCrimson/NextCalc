/**
 * PNG export functionality
 * @module export/png
 */

import type { ExportPNGOptions } from '../types/index';
import { colorToString } from '../utils/color';

/**
 * Exports a canvas to PNG data URL
 * @param canvas Canvas element to export
 * @param options Export options
 * @returns PNG data URL
 */
export async function exportToPNG(
  canvas: HTMLCanvasElement,
  options: ExportPNGOptions,
): Promise<string> {
  const { width, height, scale = 1, backgroundColor, transparent = false } = options;

  // Create offscreen canvas for export
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width * scale;
  exportCanvas.height = height * scale;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for export');
  }

  // Fill background if not transparent
  if (!transparent && backgroundColor) {
    ctx.fillStyle = colorToString(backgroundColor);
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  // Scale and draw original canvas
  ctx.scale(scale, scale);
  ctx.drawImage(canvas, 0, 0, width, height);

  // Convert to data URL
  return exportCanvas.toDataURL('image/png');
}

/**
 * Downloads a canvas as PNG file
 * @param canvas Canvas element to download
 * @param filename Output filename
 * @param options Export options
 */
export async function downloadAsPNG(
  canvas: HTMLCanvasElement,
  filename: string,
  options: ExportPNGOptions,
): Promise<void> {
  const dataUrl = await exportToPNG(canvas, options);

  // Create download link
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
