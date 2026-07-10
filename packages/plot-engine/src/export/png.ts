/**
 * PNG export functionality
 * @module export/png
 */

import type { ExportPNGOptions } from '../types/index';
import { colorToString } from '../utils/color';

/**
 * Exports a canvas to a PNG object URL.
 *
 * Uses `canvas.toBlob()` (async, off the main thread's synchronous encode
 * path) instead of `canvas.toDataURL()`, which synchronously base64-encodes
 * the entire image on the calling thread and produces a ~33% larger string.
 * The returned `blob:` URL must eventually be released with
 * `URL.revokeObjectURL()` — `downloadAsPNG` below does this automatically.
 *
 * @param canvas Canvas element to export
 * @param options Export options
 * @returns Object URL (`blob:...`) pointing at the encoded PNG
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

  // Convert to a PNG blob, then to an object URL.
  return new Promise<string>((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode canvas as PNG'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
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
  const url = await exportToPNG(canvas, options);

  // Create download link
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Defer revocation to the next tick — revoking synchronously can race the
  // browser's own read of `link.href` when it kicks off the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
