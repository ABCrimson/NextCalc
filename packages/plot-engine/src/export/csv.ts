/**
 * CSV export functionality
 * Exports raw plot data as CSV
 * @module export/csv
 */

import type { ExportCSVOptions, Point2D, Point3D } from '../types/index';

/**
 * Exports 2D points to CSV format
 * @param points Array of 2D points
 * @param options Export options
 * @returns CSV string
 */
export function exportToCSV2D(points: Point2D[], options: ExportCSVOptions = {}): string {
  const { delimiter = ',', includeHeader = true, precision = 6 } = options;

  const rows: string[] = [];

  // Header
  if (includeHeader) {
    rows.push(`x${delimiter}y`);
  }

  // Data rows
  for (const point of points) {
    const x = point.x.toFixed(precision);
    const y = point.y.toFixed(precision);
    rows.push(`${x}${delimiter}${y}`);
  }

  return rows.length > 0 ? `${rows.join('\n')}\n` : '';
}

/**
 * Exports 3D points to CSV format
 * @param points Array of 3D points
 * @param options Export options
 * @returns CSV string
 */
export function exportToCSV3D(points: Point3D[], options: ExportCSVOptions = {}): string {
  const { delimiter = ',', includeHeader = true, precision = 6 } = options;

  const rows: string[] = [];

  // Header
  if (includeHeader) {
    rows.push(`x${delimiter}y${delimiter}z`);
  }

  // Data rows
  for (const point of points) {
    const x = point.x.toFixed(precision);
    const y = point.y.toFixed(precision);
    const z = point.z.toFixed(precision);
    rows.push(`${x}${delimiter}${y}${delimiter}${z}`);
  }

  return rows.length > 0 ? `${rows.join('\n')}\n` : '';
}

/**
 * Downloads 2D points as CSV file
 * @param points Array of 2D points
 * @param filename Output filename
 * @param options Export options
 */
export function downloadAsCSV2D(
  points: Point2D[],
  filename: string,
  options: ExportCSVOptions = {},
): void {
  const csv = exportToCSV2D(points, options);

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Defer revocation to the next tick — revoking synchronously can race the
  // browser's own read of `link.href` when it kicks off the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Downloads 3D points as CSV file
 * @param points Array of 3D points
 * @param filename Output filename
 * @param options Export options
 */
export function downloadAsCSV3D(
  points: Point3D[],
  filename: string,
  options: ExportCSVOptions = {},
): void {
  const csv = exportToCSV3D(points, options);

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Defer revocation to the next tick — revoking synchronously can race the
  // browser's own read of `link.href` when it kicks off the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
