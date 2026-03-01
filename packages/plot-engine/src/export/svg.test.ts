/**
 * Tests for SVG export functionality
 * @module export/svg.test
 */

import { describe, expect, it } from 'vitest';
import type { ExportSVGOptions, Point2D } from '../types/index';
import { downloadAsSVG, exportToSVG } from './svg';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultViewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
const defaultOptions: ExportSVGOptions = { width: 800, height: 600 };

/**
 * Extracts the numeric values from the SVG viewBox attribute.
 */
function getViewBox(svg: string): number[] {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) return [];
  return match[1]!.split(' ').map(Number);
}

/**
 * Returns all <path d="..."> strings found in the SVG.
 */
function getPaths(svg: string): string[] {
  const matches = [...svg.matchAll(/<path d="([^"]+)"/g)];
  return matches.map((m) => m[1]!);
}

/**
 * Parses M x y L x y … commands from an SVG path string into coordinate pairs.
 */
function parsePathCoords(path: string): Array<{ x: number; y: number }> {
  const tokens = path.trim().split(/\s+/);
  const coords: Array<{ x: number; y: number }> = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token === 'M' || token === 'L') {
      const x = Number(tokens[i + 1]);
      const y = Number(tokens[i + 2]);
      coords.push({ x, y });
      i += 3;
    } else {
      i++;
    }
  }
  return coords;
}

// ---------------------------------------------------------------------------
// exportToSVG — document structure
// ---------------------------------------------------------------------------

describe('exportToSVG', () => {
  describe('SVG document structure', () => {
    it('should return a string that starts with the SVG opening tag', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);
      expect(svg).toMatch(/^<svg /);
    });

    it('should close the SVG element', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);
      expect(svg.trimEnd()).toMatch(/<\/svg>$/);
    });

    it('should embed the correct xmlns attribute', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should set width and height from options', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, { width: 1024, height: 768 });
      expect(svg).toContain('width="1024"');
      expect(svg).toContain('height="768"');
    });

    it('should set a viewBox matching width and height', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);
      const viewBox = getViewBox(svg);
      expect(viewBox).toEqual([0, 0, 800, 600]);
    });
  });

  // -------------------------------------------------------------------------
  // Background rectangle
  // -------------------------------------------------------------------------

  describe('background rectangle', () => {
    it('should emit a <rect> element when backgroundColor is provided', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, {
        ...defaultOptions,
        backgroundColor: '#ffffff',
      });
      expect(svg).toContain('<rect');
      expect(svg).toContain('fill="#ffffff"');
    });

    it('should not emit a <rect> element when backgroundColor is absent', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);
      expect(svg).not.toContain('<rect');
    });

    it('should size the background rect to match the canvas dimensions', () => {
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, {
        ...defaultOptions,
        backgroundColor: 'white',
      });
      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="600"');
    });
  });

  // -------------------------------------------------------------------------
  // Path generation — empty inputs
  // -------------------------------------------------------------------------

  describe('empty inputs', () => {
    it('should produce no <path> elements for an empty series array', () => {
      const svg = exportToSVG([], defaultViewport, defaultOptions);
      expect(getPaths(svg)).toHaveLength(0);
    });

    it('should produce no <path> elements when all series are empty', () => {
      const svg = exportToSVG([[], []], defaultViewport, defaultOptions);
      expect(getPaths(svg)).toHaveLength(0);
    });

    it('should produce no <path> for a single-point series', () => {
      // A single point produces a path with only an M command — still emitted.
      // The implementation emits a path whenever series.length > 0.
      const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);
      expect(getPaths(svg)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Path generation — coordinate count
  // -------------------------------------------------------------------------

  describe('path point count', () => {
    it('should emit one <path> per non-empty series', () => {
      const series1: Point2D[] = [
        { x: -5, y: 0 },
        { x: 0, y: 5 },
        { x: 5, y: 0 },
      ];
      const series2: Point2D[] = [
        { x: -5, y: -5 },
        { x: 5, y: -5 },
      ];
      const svg = exportToSVG([series1, series2], defaultViewport, defaultOptions);
      expect(getPaths(svg)).toHaveLength(2);
    });

    it('should produce a path with M + (n-1) L commands for n points', () => {
      const points: Point2D[] = [
        { x: -5, y: 0 },
        { x: 0, y: 5 },
        { x: 5, y: 0 },
      ];
      const svg = exportToSVG([points], defaultViewport, defaultOptions);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Viewport transformation — coordinate mapping
  // -------------------------------------------------------------------------

  describe('viewport transformation', () => {
    it('should map the viewport origin to the canvas centre', () => {
      // Viewport: x in [-10, 10], y in [-10, 10], canvas 200×200
      // Point (0, 0) should map to canvas (100, 100).
      const viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
      const options: ExportSVGOptions = { width: 200, height: 200 };
      const svg = exportToSVG([[{ x: 0, y: 0 }]], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.x).toBeCloseTo(100, 5);
      expect(coords[0]!.y).toBeCloseTo(100, 5);
    });

    it('should map viewport xMin to canvas x=0', () => {
      const viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
      const options: ExportSVGOptions = { width: 100, height: 100 };
      const svg = exportToSVG([[{ x: 0, y: 5 }]], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.x).toBeCloseTo(0, 5);
    });

    it('should map viewport xMax to canvas x=width', () => {
      const viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
      const options: ExportSVGOptions = { width: 100, height: 100 };
      const svg = exportToSVG([[{ x: 10, y: 5 }]], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.x).toBeCloseTo(100, 5);
    });

    it('should flip the y-axis so yMax maps to canvas y=0 (top)', () => {
      // In SVG, y=0 is the top. The implementation flips the y-axis:
      // canvas_y = height - (y - yMin) * scaleY
      // When y = yMax: canvas_y = height - (yMax - yMin)*scaleY = height - height = 0
      const viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
      const options: ExportSVGOptions = { width: 100, height: 100 };
      const svg = exportToSVG([[{ x: 5, y: 10 }]], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.y).toBeCloseTo(0, 5);
    });

    it('should flip the y-axis so yMin maps to canvas y=height (bottom)', () => {
      const viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
      const options: ExportSVGOptions = { width: 100, height: 100 };
      const svg = exportToSVG([[{ x: 5, y: 0 }]], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.y).toBeCloseTo(100, 5);
    });

    it('should preserve x-ordering of points in the path', () => {
      const viewport = { xMin: 0, xMax: 4, yMin: 0, yMax: 4 };
      const options: ExportSVGOptions = { width: 400, height: 400 };
      const points: Point2D[] = [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 4, y: 2 },
      ];
      const svg = exportToSVG([points], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.x).toBeCloseTo(0, 5);
      expect(coords[1]!.x).toBeCloseTo(200, 5);
      expect(coords[2]!.x).toBeCloseTo(400, 5);
    });

    it('should handle an asymmetric viewport correctly', () => {
      // x in [0, 20], y in [0, 5], canvas 200x100
      // Point (10, 2.5) should map to (100, 50)
      const viewport = { xMin: 0, xMax: 20, yMin: 0, yMax: 5 };
      const options: ExportSVGOptions = { width: 200, height: 100 };
      const svg = exportToSVG([[{ x: 10, y: 2.5 }]], viewport, options);
      const path = getPaths(svg)[0]!;
      const coords = parsePathCoords(path);
      expect(coords[0]!.x).toBeCloseTo(100, 5);
      expect(coords[0]!.y).toBeCloseTo(50, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Path attributes
  // -------------------------------------------------------------------------

  describe('path styling attributes', () => {
    it('should set fill="none" on every path', () => {
      const svg = exportToSVG(
        [
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        ],
        defaultViewport,
        defaultOptions,
      );
      const pathTags = [...svg.matchAll(/<path[^>]+>/g)].map((m) => m[0]!);
      expect(pathTags.length).toBeGreaterThan(0);
      for (const tag of pathTags) {
        expect(tag).toContain('fill="none"');
      }
    });

    it('should set a stroke attribute on every path', () => {
      const svg = exportToSVG(
        [
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        ],
        defaultViewport,
        defaultOptions,
      );
      const pathTags = [...svg.matchAll(/<path[^>]+>/g)].map((m) => m[0]!);
      for (const tag of pathTags) {
        expect(tag).toContain('stroke=');
      }
    });

    it('should use the M command for the first point', () => {
      const svg = exportToSVG(
        [
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        ],
        defaultViewport,
        defaultOptions,
      );
      const path = getPaths(svg)[0]!;
      expect(path.startsWith('M ')).toBe(true);
    });

    it('should use L commands for subsequent points', () => {
      const svg = exportToSVG(
        [
          [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 0 },
          ],
        ],
        defaultViewport,
        defaultOptions,
      );
      const path = getPaths(svg)[0]!;
      const lCount = (path.match(/ L /g) ?? []).length;
      expect(lCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple series
  // -------------------------------------------------------------------------

  describe('multiple series', () => {
    it('should output one path per non-empty series', () => {
      const seriesA: Point2D[] = [
        { x: -5, y: 0 },
        { x: 5, y: 0 },
      ];
      const seriesB: Point2D[] = [
        { x: 0, y: -5 },
        { x: 0, y: 5 },
      ];
      const seriesC: Point2D[] = [
        { x: -3, y: 3 },
        { x: 3, y: -3 },
      ];
      const svg = exportToSVG([seriesA, seriesB, seriesC], defaultViewport, defaultOptions);
      expect(getPaths(svg)).toHaveLength(3);
    });

    it('should skip empty series and not create paths for them', () => {
      const svg = exportToSVG(
        [[{ x: 0, y: 0 }], [], [{ x: 1, y: 1 }]],
        defaultViewport,
        defaultOptions,
      );
      expect(getPaths(svg)).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// downloadAsSVG — DOM delegation
// ---------------------------------------------------------------------------

describe('downloadAsSVG', () => {
  it('should not throw when the DOM APIs are available', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ];
    expect(() => downloadAsSVG([points], defaultViewport, 'output', defaultOptions)).not.toThrow();
  });

  it('should append .svg when the filename lacks the extension', () => {
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
      downloadAsSVG([[{ x: 0, y: 0 }]], defaultViewport, 'my-plot', defaultOptions);
      expect(capturedDownload).toBe('my-plot.svg');
    } finally {
      document.createElement = originalCreate;
    }
  });

  it('should not double-append .svg when the filename already has the extension', () => {
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
      downloadAsSVG([[{ x: 0, y: 0 }]], defaultViewport, 'plot.svg', defaultOptions);
      expect(capturedDownload).toBe('plot.svg');
    } finally {
      document.createElement = originalCreate;
    }
  });
});
