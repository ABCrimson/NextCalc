/**
 * SVG export functionality
 * Re-renders plot data as SVG for vector graphics
 * @module export/svg
 */

import type { Color, ExportSVGOptions, Point2D } from '../types/index';

/**
 * Escapes a string for safe use inside an XML/SVG attribute value.
 */
function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function colorToString(color: Color): string {
  if (typeof color === 'string') return color;
  return color.a !== undefined
    ? `rgba(${color.r},${color.g},${color.b},${color.a})`
    : `rgb(${color.r},${color.g},${color.b})`;
}

/**
 * Converts an array of points to an SVG path string
 */
function pointsToPath(points: Point2D[]): string {
  if (points.length === 0) return '';

  const firstPoint = points[0];
  if (!firstPoint) return '';

  let path = `M ${firstPoint.x} ${firstPoint.y}`;
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point) {
      path += ` L ${point.x} ${point.y}`;
    }
  }

  return path;
}

/**
 * Exports 2D plot data to SVG
 * @param points Array of 2D points
 * @param options Export options
 * @returns SVG string
 */
export function exportToSVG(
  points: Point2D[][],
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number },
  options: ExportSVGOptions,
): string {
  const { width, height, backgroundColor } = options;

  // Calculate scaling factors
  const scaleX = width / (viewport.xMax - viewport.xMin);
  const scaleY = height / (viewport.yMax - viewport.yMin);

  // Transform points to SVG coordinates (y-axis flipped)
  const transformedPoints = points.map((series) =>
    series.map((p) => ({
      x: (p.x - viewport.xMin) * scaleX,
      y: height - (p.y - viewport.yMin) * scaleY,
    })),
  );

  // Generate SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  if (backgroundColor) {
    svg += `\n  <rect width="${width}" height="${height}" fill="${escapeXmlAttr(colorToString(backgroundColor))}"/>`;
  }

  // Plot each series
  for (const series of transformedPoints) {
    if (series.length > 0) {
      const path = pointsToPath(series);
      svg += `\n  <path d="${path}" fill="none" stroke="#2563eb" stroke-width="2"/>`;
    }
  }

  svg += '\n</svg>';

  return svg;
}

/**
 * Downloads plot data as SVG file
 * @param points Array of 2D points
 * @param viewport Viewport bounds
 * @param filename Output filename
 * @param options Export options
 */
export function downloadAsSVG(
  points: Point2D[][],
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number },
  filename: string,
  options: ExportSVGOptions,
): void {
  const svg = exportToSVG(points, viewport, options);

  // Create blob and download
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
