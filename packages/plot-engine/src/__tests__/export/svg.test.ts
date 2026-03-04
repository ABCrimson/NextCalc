import { describe, expect, it, vi, beforeEach } from 'vitest';
import { exportToSVG, downloadAsSVG } from '../../export/svg';
import type { Point2D, ExportSVGOptions } from '../../types/index';

const defaultViewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };

const defaultOptions: ExportSVGOptions = {
  width: 800,
  height: 600,
};

describe('exportToSVG', () => {
  // ── Basic structure ───────────────────────────────────────────────

  it('should produce a valid SVG element with correct dimensions', () => {
    const svg = exportToSVG([[]], defaultViewport, defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('</svg>');
  });

  it('should be a well-formed SVG (starts with <svg, ends with </svg>)', () => {
    const svg = exportToSVG([[{ x: 0, y: 0 }]], defaultViewport, defaultOptions);

    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  // ── Background ────────────────────────────────────────────────────

  it('should include background rect when backgroundColor is specified as string', () => {
    const svg = exportToSVG([[]], defaultViewport, {
      ...defaultOptions,
      backgroundColor: '#ffffff',
    });

    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
  });

  it('should include background rect with RGBA color object', () => {
    const svg = exportToSVG([[]], defaultViewport, {
      ...defaultOptions,
      backgroundColor: { r: 255, g: 128, b: 0, a: 0.5 },
    });

    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="rgba(255,128,0,0.5)"');
  });

  it('should include background rect with RGB color object (no alpha)', () => {
    const svg = exportToSVG([[]], defaultViewport, {
      ...defaultOptions,
      backgroundColor: { r: 0, g: 0, b: 0 },
    });

    expect(svg).toContain('fill="rgb(0,0,0)"');
  });

  it('should NOT include background rect when backgroundColor is not set', () => {
    const svg = exportToSVG([[]], defaultViewport, defaultOptions);
    expect(svg).not.toContain('<rect');
  });

  // ── Path rendering ────────────────────────────────────────────────

  it('should render a single series as an SVG path', () => {
    const points: Point2D[][] = [
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ],
    ];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);

    expect(svg).toContain('<path');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#2563eb"');
    expect(svg).toContain('stroke-width="2"');
  });

  it('should render multiple series as separate paths', () => {
    const points: Point2D[][] = [
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      [
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
    ];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);

    const pathMatches = svg.match(/<path/g);
    expect(pathMatches).toHaveLength(2);
  });

  it('should skip empty series (no path generated)', () => {
    const points: Point2D[][] = [[], [{ x: 0, y: 0 }, { x: 5, y: 5 }], []];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);

    const pathMatches = svg.match(/<path/g);
    expect(pathMatches).toHaveLength(1);
  });

  it('should handle all-empty series', () => {
    const svg = exportToSVG([[], [], []], defaultViewport, defaultOptions);
    expect(svg).not.toContain('<path');
  });

  // ── Coordinate transformation ─────────────────────────────────────

  it('should transform origin point (xMin, yMin) to bottom-left of SVG', () => {
    // Point at viewport origin (0, 0) should map to SVG (0, height)
    const points: Point2D[][] = [[{ x: 0, y: 0 }]];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);

    // Single point won't generate a path (no L command), but the M command
    // should contain the transformed coordinates
    // x = (0-0)/(10-0) * 800 = 0
    // y = 600 - (0-0)/(10-0) * 600 = 600
    // However, single-point series will have a path with just M but the
    // series has length > 0, so it does get rendered
    expect(svg).toContain('M 0 600');
  });

  it('should transform top-right corner to SVG top-right', () => {
    // Point at (10, 10) => SVG (800, 0)
    const points: Point2D[][] = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    ];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);
    expect(svg).toContain('L 800 0');
  });

  it('should flip the y-axis (SVG y=0 is top, math y=0 is bottom)', () => {
    // Point (5, 0) should map to y=600 in SVG (bottom)
    // Point (5, 10) should map to y=0 in SVG (top)
    const points: Point2D[][] = [
      [
        { x: 5, y: 0 },
        { x: 5, y: 10 },
      ],
    ];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);

    // x = (5-0)/10 * 800 = 400
    // y0 = 600 - (0/10)*600 = 600
    // y10 = 600 - (10/10)*600 = 0
    expect(svg).toContain('M 400 600');
    expect(svg).toContain('L 400 0');
  });

  it('should scale correctly for non-square viewports', () => {
    const viewport = { xMin: -1, xMax: 1, yMin: -2, yMax: 2 };
    const options: ExportSVGOptions = { width: 400, height: 800 };
    const points: Point2D[][] = [[{ x: 0, y: 0 }, { x: 1, y: 2 }]];

    const svg = exportToSVG(points, viewport, options);

    // Point (0, 0): x = (0-(-1))/2 * 400 = 200, y = 800 - (0-(-2))/4 * 800 = 400
    // Point (1, 2): x = (1-(-1))/2 * 400 = 400, y = 800 - (2-(-2))/4 * 800 = 0
    expect(svg).toContain('M 200 400');
    expect(svg).toContain('L 400 0');
  });

  // ── Path string format ────────────────────────────────────────────

  it('should use M for the first point and L for subsequent points', () => {
    const points: Point2D[][] = [
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ],
    ];
    const svg = exportToSVG(points, defaultViewport, defaultOptions);

    // Extract the d attribute content
    const dMatch = svg.match(/d="([^"]+)"/);
    expect(dMatch).not.toBeNull();
    const d = dMatch![1]!;

    expect(d).toMatch(/^M /);
    const lCount = (d.match(/ L /g) ?? []).length;
    expect(lCount).toBe(2); // two L commands after the initial M
  });

  // ── XML escaping in background color ──────────────────────────────

  it('should escape special XML characters in backgroundColor string', () => {
    // A contrived color string with characters that need escaping
    const svg = exportToSVG([[]], defaultViewport, {
      ...defaultOptions,
      backgroundColor: 'color<"test">&',
    });

    expect(svg).toContain('&lt;');
    expect(svg).toContain('&quot;');
    expect(svg).toContain('&amp;');
    expect(svg).not.toContain('color<"test">&');
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('should handle negative viewport coordinates', () => {
    const viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    const points: Point2D[][] = [
      [
        { x: -10, y: -10 },
        { x: 10, y: 10 },
      ],
    ];

    const svg = exportToSVG(points, viewport, defaultOptions);
    expect(svg).toContain('<path');
    // (-10, -10) => (0, 600), (10, 10) => (800, 0)
    expect(svg).toContain('M 0 600');
    expect(svg).toContain('L 800 0');
  });

  it('should produce no path elements when given empty points array', () => {
    const svg = exportToSVG([], defaultViewport, defaultOptions);
    expect(svg).not.toContain('<path');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('should handle very small viewport (near-zero range)', () => {
    const viewport = { xMin: 0, xMax: 0.001, yMin: 0, yMax: 0.001 };
    const points: Point2D[][] = [[{ x: 0, y: 0 }, { x: 0.0005, y: 0.0005 }]];

    // Should not throw, and should produce valid SVG
    const svg = exportToSVG(points, viewport, defaultOptions);
    expect(svg).toContain('<path');
  });
});

describe('downloadAsSVG', () => {
  let mockLink: {
    download: string;
    href: string;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
      remove: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((child) => child);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-svg-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('should trigger a download with correct filename', () => {
    downloadAsSVG([[{ x: 0, y: 0 }]], defaultViewport, 'plot.svg', defaultOptions);

    expect(mockLink.download).toBe('plot.svg');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.remove).toHaveBeenCalled();
  });

  it('should append .svg if not present', () => {
    downloadAsSVG([[]], defaultViewport, 'myplot', defaultOptions);
    expect(mockLink.download).toBe('myplot.svg');
  });

  it('should not double-append .svg', () => {
    downloadAsSVG([[]], defaultViewport, 'chart.svg', defaultOptions);
    expect(mockLink.download).toBe('chart.svg');
  });

  it('should create and revoke a Blob URL', () => {
    downloadAsSVG([[]], defaultViewport, 'test', defaultOptions);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-svg-url');
  });
});
