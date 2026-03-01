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

  let csv = '';

  // Header
  if (includeHeader) {
    csv += `x${delimiter}y\n`;
  }

  // Data rows
  for (const point of points) {
    const x = point.x.toFixed(precision);
    const y = point.y.toFixed(precision);
    csv += `${x}${delimiter}${y}\n`;
  }

  return csv;
}

/**
 * Exports 3D points to CSV format
 * @param points Array of 3D points
 * @param options Export options
 * @returns CSV string
 */
export function exportToCSV3D(points: Point3D[], options: ExportCSVOptions = {}): string {
  const { delimiter = ',', includeHeader = true, precision = 6 } = options;

  let csv = '';

  // Header
  if (includeHeader) {
    csv += `x${delimiter}y${delimiter}z\n`;
  }

  // Data rows
  for (const point of points) {
    const x = point.x.toFixed(precision);
    const y = point.y.toFixed(precision);
    const z = point.z.toFixed(precision);
    csv += `${x}${delimiter}${y}${delimiter}${z}\n`;
  }

  return csv;
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
  link.click();

  URL.revokeObjectURL(url);
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
  link.click();

  URL.revokeObjectURL(url);
}
