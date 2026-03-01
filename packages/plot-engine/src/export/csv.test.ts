/**
 * Tests for CSV export functionality
 * @module export/csv.test
 */

import { describe, expect, it } from 'vitest';
import type { Point2D, Point3D } from '../types/index';
import { downloadAsCSV2D, downloadAsCSV3D, exportToCSV2D, exportToCSV3D } from './csv';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parses a CSV string into a 2D array of raw cell strings. */
function parseCSV(csv: string, delimiter = ','): string[][] {
  return csv
    .trim()
    .split('\n')
    .map((row) => row.split(delimiter));
}

// ---------------------------------------------------------------------------
// exportToCSV2D
// ---------------------------------------------------------------------------

describe('exportToCSV2D', () => {
  const points: Point2D[] = [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: -3.14, y: 9.81 },
  ];

  it('should include a header row by default', () => {
    const csv = exportToCSV2D(points);
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual(['x', 'y']);
  });

  it('should produce the correct number of data rows', () => {
    const csv = exportToCSV2D(points);
    const rows = parseCSV(csv);
    // header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('should format values with the default precision of 6', () => {
    const csv = exportToCSV2D([{ x: 1, y: 2 }]);
    const rows = parseCSV(csv);
    const dataRow = rows[1]!;
    expect(dataRow[0]).toBe('1.000000');
    expect(dataRow[1]).toBe('2.000000');
  });

  it('should respect a custom precision setting', () => {
    const csv = exportToCSV2D([{ x: Math.PI, y: Math.E }], { precision: 2 });
    const rows = parseCSV(csv);
    const dataRow = rows[1]!;
    expect(dataRow[0]).toBe('3.14');
    expect(dataRow[1]).toBe('2.72');
  });

  it('should respect precision: 0', () => {
    const csv = exportToCSV2D([{ x: 3.9, y: -1.5 }], { precision: 0 });
    const rows = parseCSV(csv);
    const dataRow = rows[1]!;
    expect(dataRow[0]).toBe('4');
    expect(dataRow[1]).toBe('-2');
  });

  it('should omit the header when includeHeader is false', () => {
    const csv = exportToCSV2D(points, { includeHeader: false });
    const rows = parseCSV(csv);
    // No header: first row is the first data point
    expect(rows).toHaveLength(3);
    expect(rows[0]![0]).toBe('0.000000');
  });

  it('should use a semicolon delimiter when specified', () => {
    const csv = exportToCSV2D(points, { delimiter: ';' });
    const rows = parseCSV(csv, ';');
    expect(rows[0]).toEqual(['x', 'y']);
    expect(rows[1]![0]).toBe('0.000000');
    expect(rows[1]![1]).toBe('0.000000');
  });

  it('should use a tab delimiter when specified', () => {
    const csv = exportToCSV2D([{ x: 1, y: 2 }], { delimiter: '\t' });
    const rows = parseCSV(csv, '\t');
    expect(rows[0]).toEqual(['x', 'y']);
    expect(rows[1]![0]).toBe('1.000000');
  });

  it('should return an empty string for an empty points array with no header', () => {
    const csv = exportToCSV2D([], { includeHeader: false });
    expect(csv).toBe('');
  });

  it('should return only the header row for an empty points array with header', () => {
    const csv = exportToCSV2D([], { includeHeader: true });
    expect(csv.trim()).toBe('x,y');
  });

  it('should handle negative coordinates correctly', () => {
    const csv = exportToCSV2D([{ x: -100, y: -0.001 }], { precision: 3 });
    const rows = parseCSV(csv);
    expect(rows[1]![0]).toBe('-100.000');
    expect(rows[1]![1]).toBe('-0.001');
  });

  it('should handle very large coordinates', () => {
    const csv = exportToCSV2D([{ x: 1e15, y: -1e15 }], { precision: 2 });
    const rows = parseCSV(csv);
    // toFixed on large numbers produces a fixed decimal string
    expect(rows[1]![0]).toBe('1000000000000000.00');
    expect(rows[1]![1]).toBe('-1000000000000000.00');
  });

  it('should produce rows terminated with a newline', () => {
    const csv = exportToCSV2D([{ x: 0, y: 0 }]);
    // Every row including the last should end with \n
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('should produce a valid CSV that round-trips through the parser', () => {
    const original: Point2D[] = [
      { x: 0.5, y: -0.5 },
      { x: 100, y: 200 },
    ];
    const csv = exportToCSV2D(original, { precision: 4 });
    const rows = parseCSV(csv).slice(1); // skip header
    const parsed = rows.map((row) => ({ x: Number(row[0]), y: Number(row[1]) }));

    expect(parsed[0]!.x).toBeCloseTo(0.5, 4);
    expect(parsed[0]!.y).toBeCloseTo(-0.5, 4);
    expect(parsed[1]!.x).toBeCloseTo(100, 4);
    expect(parsed[1]!.y).toBeCloseTo(200, 4);
  });
});

// ---------------------------------------------------------------------------
// exportToCSV3D
// ---------------------------------------------------------------------------

describe('exportToCSV3D', () => {
  const points: Point3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 3 },
    { x: -1, y: -2, z: -3 },
  ];

  it('should include an x,y,z header row by default', () => {
    const csv = exportToCSV3D(points);
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual(['x', 'y', 'z']);
  });

  it('should produce the correct number of data rows', () => {
    const csv = exportToCSV3D(points);
    const rows = parseCSV(csv);
    // header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('should format values with the default precision of 6', () => {
    const csv = exportToCSV3D([{ x: 1, y: 2, z: 3 }]);
    const rows = parseCSV(csv);
    const dataRow = rows[1]!;
    expect(dataRow[0]).toBe('1.000000');
    expect(dataRow[1]).toBe('2.000000');
    expect(dataRow[2]).toBe('3.000000');
  });

  it('should respect a custom precision setting', () => {
    const csv = exportToCSV3D([{ x: Math.PI, y: Math.E, z: Math.SQRT2 }], { precision: 3 });
    const rows = parseCSV(csv);
    const dataRow = rows[1]!;
    expect(dataRow[0]).toBe('3.142');
    expect(dataRow[1]).toBe('2.718');
    expect(dataRow[2]).toBe('1.414');
  });

  it('should omit the header when includeHeader is false', () => {
    const csv = exportToCSV3D(points, { includeHeader: false });
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(3);
    // First row is the first data point, not a header
    expect(Number(rows[0]![0])).toBe(0);
  });

  it('should use a semicolon delimiter when specified', () => {
    const csv = exportToCSV3D([{ x: 1, y: 2, z: 3 }], { delimiter: ';' });
    const rows = parseCSV(csv, ';');
    expect(rows[0]).toEqual(['x', 'y', 'z']);
    const dataRow = rows[1]!;
    expect(dataRow[0]).toBe('1.000000');
    expect(dataRow[1]).toBe('2.000000');
    expect(dataRow[2]).toBe('3.000000');
  });

  it('should return only the header for an empty points array', () => {
    const csv = exportToCSV3D([], { includeHeader: true });
    expect(csv.trim()).toBe('x,y,z');
  });

  it('should handle negative z coordinates', () => {
    const csv = exportToCSV3D([{ x: 0, y: 0, z: -5.5 }], { precision: 1 });
    const rows = parseCSV(csv);
    expect(rows[1]![2]).toBe('-5.5');
  });

  it('should produce rows terminated with a newline', () => {
    const csv = exportToCSV3D([{ x: 0, y: 0, z: 0 }]);
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('should round-trip through the parser', () => {
    const original: Point3D[] = [{ x: 1.111, y: 2.222, z: 3.333 }];
    const csv = exportToCSV3D(original, { precision: 3 });
    const rows = parseCSV(csv).slice(1);
    const row = rows[0]!;
    expect(Number(row[0])).toBeCloseTo(1.111, 3);
    expect(Number(row[1])).toBeCloseTo(2.222, 3);
    expect(Number(row[2])).toBeCloseTo(3.333, 3);
  });
});

// ---------------------------------------------------------------------------
// downloadAsCSV2D / downloadAsCSV3D  (DOM-dependent paths)
// These functions rely on Blob, URL.createObjectURL, and document.createElement.
// We test that they delegate correctly to their export functions and that the
// filename is normalised with a .csv extension, using minimal DOM stubs.
// ---------------------------------------------------------------------------

describe('downloadAsCSV2D', () => {
  it('should not throw when the DOM APIs are available', () => {
    // The happy-path invocation should not throw even though the browser
    // environment is minimal inside vitest (jsdom or happy-dom).
    const points: Point2D[] = [{ x: 0, y: 1 }];
    expect(() => downloadAsCSV2D(points, 'output')).not.toThrow();
  });

  it('should append .csv when the filename lacks the extension', () => {
    // Spy on the createElement path to capture the assigned download attribute.
    const originalCreate = document.createElement.bind(document);
    let capturedDownload: string | null = null;

    const createSpy = (tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(value: string) {
            capturedDownload = value;
          },
          get() {
            return capturedDownload ?? '';
          },
          configurable: true,
        });
        // Prevent actual navigation
        el.click = () => {};
      }
      return el;
    };

    document.createElement = createSpy as typeof document.createElement;

    try {
      downloadAsCSV2D([{ x: 0, y: 0 }], 'my-export');
      expect(capturedDownload).toBe('my-export.csv');
    } finally {
      document.createElement = originalCreate;
    }
  });

  it('should not double-append .csv when the filename already has the extension', () => {
    const originalCreate = document.createElement.bind(document);
    let capturedDownload: string | null = null;

    document.createElement = (tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(value: string) {
            capturedDownload = value;
          },
          get() {
            return capturedDownload ?? '';
          },
          configurable: true,
        });
        el.click = () => {};
      }
      return el;
    };

    try {
      downloadAsCSV2D([{ x: 1, y: 2 }], 'data.csv');
      expect(capturedDownload).toBe('data.csv');
    } finally {
      document.createElement = originalCreate;
    }
  });
});

describe('downloadAsCSV3D', () => {
  it('should not throw when the DOM APIs are available', () => {
    const points: Point3D[] = [{ x: 0, y: 1, z: 2 }];
    expect(() => downloadAsCSV3D(points, 'output')).not.toThrow();
  });

  it('should append .csv when the filename lacks the extension', () => {
    const originalCreate = document.createElement.bind(document);
    let capturedDownload: string | null = null;

    document.createElement = (tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(value: string) {
            capturedDownload = value;
          },
          get() {
            return capturedDownload ?? '';
          },
          configurable: true,
        });
        el.click = () => {};
      }
      return el;
    };

    try {
      downloadAsCSV3D([{ x: 0, y: 0, z: 0 }], 'my-3d-export');
      expect(capturedDownload).toBe('my-3d-export.csv');
    } finally {
      document.createElement = originalCreate;
    }
  });

  it('should not double-append .csv when the filename already has the extension', () => {
    const originalCreate = document.createElement.bind(document);
    let capturedDownload: string | null = null;

    document.createElement = (tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(value: string) {
            capturedDownload = value;
          },
          get() {
            return capturedDownload ?? '';
          },
          configurable: true,
        });
        el.click = () => {};
      }
      return el;
    };

    try {
      downloadAsCSV3D([{ x: 1, y: 2, z: 3 }], 'data.csv');
      expect(capturedDownload).toBe('data.csv');
    } finally {
      document.createElement = originalCreate;
    }
  });
});
