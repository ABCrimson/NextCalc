/**
 * SVG export handler
 * Converts LaTeX math expressions to SVG format using MathJax
 */

import type { R2Bucket } from '../utils/r2.js';
import {
  generateExportKey,
  getMimeType,
  type UploadResult,
  uploadToR2,
  validateFileSize,
} from '../utils/r2.js';
import { generateSvgFromLatex as generateSvgInternal } from './svg-internal.js';

/**
 * Export configuration for SVG generation
 */
export interface SvgExportRequest {
  latex: string;
  userId?: string;
  options?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    inline?: boolean;
  };
}

/**
 * SVG export result
 */
export interface SvgExportResult extends UploadResult {
  format: 'svg';
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Converts LaTeX expression to SVG format
 *
 * Features:
 * - High-quality vector graphics
 * - Scalable to any size
 * - Customizable colors and styling
 * - Inline or display mode
 *
 * Note: This is a simplified implementation. In production:
 * - Use MathJax for actual LaTeX to SVG conversion
 * - Consider using a headless browser for complex rendering
 * - Cache common expressions
 *
 * @param request - SVG export request
 * @param bucket - R2 bucket for storage
 * @param maxFileSize - Maximum file size in bytes
 * @returns SVG export result with download URL
 */
export async function exportToSvg(
  request: SvgExportRequest,
  bucket: R2Bucket,
  maxFileSize: number,
): Promise<SvgExportResult> {
  const { latex, userId, options = {} } = request;

  // Default options
  const fontSize = options.fontSize || 16;
  const color = options.color || '#000000';
  const backgroundColor = options.backgroundColor || 'transparent';
  const inline = options.inline ?? false;

  // Generate SVG content
  // In production, use MathJax or similar library for accurate LaTeX rendering
  const svg = await generateSvgInternal(latex, {
    fontSize,
    color,
    backgroundColor,
    inline,
  });

  // Convert SVG string to ArrayBuffer
  const svgBuffer = new TextEncoder().encode(svg);

  // Validate file size
  validateFileSize(svgBuffer.byteLength, maxFileSize);

  // Generate unique key for R2
  const key = generateExportKey(userId, 'svg');

  // Upload to R2
  const uploadResult = await uploadToR2(bucket, key, svgBuffer, getMimeType('svg'), {
    latex,
    createdAt: new Date().toISOString(),
    userId: userId || 'anonymous',
  });

  // Parse SVG dimensions
  const dimensions = extractSvgDimensions(svg);

  return {
    ...uploadResult,
    format: 'svg',
    ...(dimensions ? { dimensions } : {}),
  };
}

/**
 * Extracts width and height from SVG markup
 *
 * @param svg - SVG markup
 * @returns Dimensions object or undefined
 */
function extractSvgDimensions(svg: string): { width: number; height: number } | undefined {
  const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);

  if (widthMatch?.[1] && heightMatch?.[1]) {
    return {
      width: parseFloat(widthMatch[1]),
      height: parseFloat(heightMatch[1]),
    };
  }

  return undefined;
}

/**
 * Batch export multiple expressions to SVG
 *
 * @param expressions - Array of LaTeX expressions
 * @param userId - User ID
 * @param bucket - R2 bucket
 * @param maxFileSize - Maximum file size per SVG
 * @returns Array of export results
 */
export async function batchExportToSvg(
  expressions: string[],
  userId: string | undefined,
  bucket: R2Bucket,
  maxFileSize: number,
): Promise<SvgExportResult[]> {
  const results: SvgExportResult[] = [];

  for (const latex of expressions) {
    try {
      const result = await exportToSvg(
        { latex, ...(userId ? { userId } : {}) },
        bucket,
        maxFileSize,
      );
      results.push(result);
    } catch (error) {
      // Log error but continue with other exports
      console.error(`Failed to export expression "${latex}":`, error);
    }
  }

  return results;
}

/**
 * Optimizes SVG output for smaller file size
 *
 * @param svg - SVG markup
 * @returns Optimized SVG markup
 */
export function optimizeSvg(svg: string): string {
  // Remove XML declaration if present
  let optimized = svg.replace(/<\?xml[^?]*\?>\s*/g, '');

  // Remove comments
  optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');

  // Remove unnecessary whitespace
  optimized = optimized.replace(/>\s+</g, '><');

  // Trim
  optimized = optimized.trim();

  return optimized;
}
