/**
 * PNG export handler
 *
 * Converts LaTeX math expressions to PNG format via a two-stage pipeline:
 *
 *   1. LaTeX → SVG   (MathJax 4.x, see svg-internal.ts)
 *   2. SVG   → PNG   (@cf-wasm/resvg, WebAssembly running inside Workers)
 *
 * The @cf-wasm/resvg package provides a Cloudflare-Workers-compatible WASM
 * build of resvg.  We use the `/workerd` sub-path export which is optimised
 * for the workerd runtime and supports asynchronous WASM instantiation via
 * `Resvg.async()`.
 */

import { Resvg } from '@cf-wasm/resvg/workerd';

import { generateRasterSvgFromLatex, type SvgOptions } from './svg-internal.js';
import {
  uploadToR2,
  generateExportKey,
  validateFileSize,
  getMimeType,
  type UploadResult,
  type R2Bucket,
} from '../utils/r2.js';

// ---------------------------------------------------------------------------
// Shared encoder — avoids creating a new instance on every call.
// ---------------------------------------------------------------------------
const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Export configuration for PNG generation
 */
export interface PngExportRequest {
  latex: string;
  userId?: string;
  options?: {
    width?: number;
    height?: number;
    dpi?: number;
    backgroundColor?: string;
    transparent?: boolean;
  };
}

/**
 * PNG export result
 */
export interface PngExportResult extends UploadResult {
  format: 'png';
  dimensions: {
    width: number;
    height: number;
  };
  dpi: number;
}

/**
 * Result from a raw SVG → PNG conversion (no R2 upload).
 */
export interface PngConversionResult {
  /** Rendered PNG bytes. */
  png: Uint8Array;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

// ---------------------------------------------------------------------------
// Core export function
// ---------------------------------------------------------------------------

/**
 * Converts a LaTeX expression to PNG and uploads it to R2.
 *
 * Pipeline:
 *   1. Render LaTeX → SVG  via MathJax (generateSvgFromLatex)
 *   2. Rasterise SVG → PNG via resvg WASM
 *   3. Extract pixel dimensions from the rendered image
 *   4. Validate file size against the caller-supplied limit
 *   5. Upload the PNG to R2 and return the result
 *
 * @param request      - PNG export request (LaTeX + options)
 * @param bucket       - R2 bucket binding for storage
 * @param maxFileSize  - Maximum allowed PNG size in bytes
 * @returns Upload result including dimensions, DPI, and download URL
 */
export async function exportToPng(
  request: PngExportRequest,
  bucket: R2Bucket,
  maxFileSize: number,
): Promise<PngExportResult> {
  const { latex, userId, options = {} } = request;

  // Resolve defaults
  const dpi = options.dpi ?? 144; // Retina display
  const transparent = options.transparent ?? false;
  const backgroundColor = transparent
    ? 'transparent'
    : (options.backgroundColor ?? '#FFFFFF');

  // ------------------------------------------------------------------
  // Step 1: LaTeX → SVG
  // ------------------------------------------------------------------
  const svgOptions: SvgOptions = {
    fontSize: 16,
    color: '#000000',
    backgroundColor,
    inline: false,
  };

  const svgString = await generateRasterSvgFromLatex(latex, svgOptions);

  // ------------------------------------------------------------------
  // Step 2 + 3: SVG → PNG and extract dimensions (single render pass)
  // ------------------------------------------------------------------
  const { png, width, height } = await convertSvgToPng(svgString, dpi, backgroundColor);

  // ------------------------------------------------------------------
  // Step 4: Validate size
  // ------------------------------------------------------------------
  validateFileSize(png.byteLength, maxFileSize);

  // ------------------------------------------------------------------
  // Step 5: Upload to R2
  // ------------------------------------------------------------------
  const key = generateExportKey(userId, 'png');

  const uploadResult = await uploadToR2(
    bucket,
    key,
    png,
    getMimeType('png'),
    {
      latex,
      width: width.toString(),
      height: height.toString(),
      dpi: dpi.toString(),
      createdAt: new Date().toISOString(),
      userId: userId ?? 'anonymous',
    },
  );

  return {
    ...uploadResult,
    format: 'png',
    dimensions: { width, height },
    dpi,
  };
}

// ---------------------------------------------------------------------------
// SVG → PNG conversion
// ---------------------------------------------------------------------------

/**
 * Converts an SVG string to PNG using resvg (WASM).
 *
 * Returns the rasterised bytes together with the rendered pixel dimensions
 * in a single render pass — callers never need a second Resvg instantiation.
 *
 * @param svgString       - Complete SVG markup
 * @param dpi             - Rasterisation DPI (e.g. 144 for Retina)
 * @param backgroundColor - Background colour; 'transparent' for alpha channel
 * @returns PNG bytes and rendered dimensions
 */
export async function convertSvgToPng(
  svgString: string,
  dpi: number,
  backgroundColor: string,
): Promise<PngConversionResult> {
  const resvg = await Resvg.async(encoder.encode(svgString), {
    dpi,
    fitTo: { mode: 'original' as const },
    ...(backgroundColor !== 'transparent' ? { background: backgroundColor } : {}),
  });

  const rendered = resvg.render();
  return {
    png: rendered.asPng(),
    width: rendered.width,
    height: rendered.height,
  };
}

// ---------------------------------------------------------------------------
// Batch export
// ---------------------------------------------------------------------------

/**
 * Batch export multiple LaTeX expressions to PNG.
 *
 * Expressions are processed sequentially to avoid overwhelming CPU time
 * limits in the Worker.  Failures for individual expressions are logged
 * and skipped; the returned array contains only successful results.
 *
 * @param expressions  - Array of LaTeX strings
 * @param userId       - Optional user ID for R2 key namespacing
 * @param bucket       - R2 bucket binding
 * @param maxFileSize  - Maximum file size per PNG in bytes
 * @param options      - Common export options applied to every expression
 * @returns Array of successful export results
 */
export async function batchExportToPng(
  expressions: string[],
  userId: string | undefined,
  bucket: R2Bucket,
  maxFileSize: number,
  options?: PngExportRequest['options'],
): Promise<PngExportResult[]> {
  const results: PngExportResult[] = [];

  for (const latex of expressions) {
    try {
      const result = await exportToPng(
        {
          latex,
          ...(userId !== undefined ? { userId } : {}),
          ...(options ? { options } : {}),
        },
        bucket,
        maxFileSize,
      );
      results.push(result);
    } catch (error) {
      console.error(`Failed to export expression "${latex}":`, error);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Returns the recommended DPI for a given use case.
 *
 * @param useCase - Target output medium
 * @returns DPI value
 */
export function getRecommendedDpi(
  useCase: 'web' | 'print' | 'retina' | 'presentation',
): number {
  const dpiMap = {
    web: 72,
    retina: 144,
    presentation: 150,
    print: 300,
  };

  return dpiMap[useCase];
}

/**
 * Estimates the uncompressed PNG file size based on pixel dimensions.
 *
 * This is a rough upper-bound estimate.  Actual PNG files will typically
 * be smaller due to DEFLATE compression, especially for math content
 * which is mostly flat colour and large transparent areas.
 *
 * @param width           - Image width in pixels
 * @param height          - Image height in pixels
 * @param hasTransparency - Whether the PNG will include an alpha channel
 * @returns Estimated size in bytes
 */
export function estimatePngSize(
  width: number,
  height: number,
  hasTransparency: boolean,
): number {
  // RGBA (4 bytes) vs RGB (3 bytes) per pixel, plus PNG header overhead
  const bytesPerPixel = hasTransparency ? 4 : 3;
  const overhead = 1024;

  return width * height * bytesPerPixel + overhead;
}
