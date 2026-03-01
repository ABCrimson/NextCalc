/**
 * Tests for PNG export functionality
 * @module export/png.test
 *
 * exportToPNG and downloadAsPNG both require HTMLCanvasElement with a working
 * 2D rendering context and toDataURL. We exercise:
 *   - parameter validation / option defaults (scale, transparent, backgroundColor)
 *   - the downloadAsPNG filename normalisation logic (same pattern as csv/svg)
 *   - error propagation when the canvas context is unavailable
 *
 * We intentionally do NOT mock deep WebGL/canvas rendering; the tests use a
 * lightweight stub that satisfies the interface surface the code touches.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExportPNGOptions } from '../types/index';
import { downloadAsPNG, exportToPNG } from './png';

// ---------------------------------------------------------------------------
// Canvas stub factory
// ---------------------------------------------------------------------------

/**
 * Returns a fake HTMLCanvasElement whose getContext('2d') returns a minimal
 * CanvasRenderingContext2D stub.  The fake toDataURL always returns a small
 * valid-looking data URL.
 */
function makeCanvasStub(
  options: { failContext?: boolean; dataUrl?: string } = {},
): HTMLCanvasElement {
  const ctxStub = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  };

  const canvasStub = {
    width: 0,
    height: 0,
    getContext: vi.fn((type: string) => {
      if (type === '2d' && !options.failContext) return ctxStub;
      return null;
    }),
    toDataURL: vi.fn(() => options.dataUrl ?? 'data:image/png;base64,abc123'),
    style: { cursor: '' },
  } as unknown as HTMLCanvasElement;

  return canvasStub;
}

/**
 * Overrides document.createElement so that any <canvas> element created by
 * the export functions returns our stub instead.
 */
function patchCreateElement(
  canvasOverride: HTMLCanvasElement,
  linkClickSpy?: ReturnType<typeof vi.fn>,
): () => void {
  const originalCreate = document.createElement.bind(document);

  document.createElement = (tag: string) => {
    if (tag === 'canvas') return canvasOverride;
    const el = originalCreate(tag);
    if (tag === 'a' && linkClickSpy) {
      el.click = linkClickSpy;
    }
    return el;
  };

  return () => {
    document.createElement = originalCreate;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// exportToPNG — option defaults and parameter handling
// ---------------------------------------------------------------------------

describe('exportToPNG', () => {
  it('should return a data URL string', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub({ dataUrl: 'data:image/png;base64,TESTPNG' });
    const restore = patchCreateElement(exportCanvas);

    try {
      const result = await exportToPNG(sourceCanvas, { width: 100, height: 100 });
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^data:image\/png/);
    } finally {
      restore();
    }
  });

  it('should set exportCanvas.width = width * scale (default scale=1)', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, { width: 400, height: 300 });
      expect(exportCanvas.width).toBe(400);
      expect(exportCanvas.height).toBe(300);
    } finally {
      restore();
    }
  });

  it('should multiply canvas dimensions by the scale factor', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, { width: 200, height: 100, scale: 3 });
      expect(exportCanvas.width).toBe(600);
      expect(exportCanvas.height).toBe(300);
    } finally {
      restore();
    }
  });

  it('should call ctx.scale with the provided scale factor', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, { width: 100, height: 100, scale: 2 });
      const ctx = exportCanvas.getContext('2d') as { scale: ReturnType<typeof vi.fn> };
      expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    } finally {
      restore();
    }
  });

  it('should call ctx.fillRect when transparent=false and backgroundColor is provided', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, {
        width: 100,
        height: 100,
        transparent: false,
        backgroundColor: '#ff0000',
      });
      const ctx = exportCanvas.getContext('2d') as { fillRect: ReturnType<typeof vi.fn> };
      expect(ctx.fillRect).toHaveBeenCalledOnce();
    } finally {
      restore();
    }
  });

  it('should NOT call ctx.fillRect when transparent=true', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, {
        width: 100,
        height: 100,
        transparent: true,
        backgroundColor: '#ffffff',
      });
      const ctx = exportCanvas.getContext('2d') as { fillRect: ReturnType<typeof vi.fn> };
      expect(ctx.fillRect).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('should NOT call ctx.fillRect when backgroundColor is omitted', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, { width: 100, height: 100 });
      const ctx = exportCanvas.getContext('2d') as { fillRect: ReturnType<typeof vi.fn> };
      expect(ctx.fillRect).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('should call ctx.drawImage with the source canvas and correct dimensions', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, { width: 320, height: 240 });
      const ctx = exportCanvas.getContext('2d') as { drawImage: ReturnType<typeof vi.fn> };
      expect(ctx.drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 0, 320, 240);
    } finally {
      restore();
    }
  });

  it('should call toDataURL with image/png mime type', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await exportToPNG(sourceCanvas, { width: 100, height: 100 });
      expect(exportCanvas.toDataURL).toHaveBeenCalledWith('image/png');
    } finally {
      restore();
    }
  });

  it('should throw when the export canvas cannot provide a 2D context', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub({ failContext: true });
    const restore = patchCreateElement(exportCanvas);

    try {
      await expect(exportToPNG(sourceCanvas, { width: 100, height: 100 })).rejects.toThrow(
        'Failed to get 2D context for export',
      );
    } finally {
      restore();
    }
  });

  it('should accept an object backgroundColor', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      // Should not throw — colorToString handles object colors
      const options: ExportPNGOptions = {
        width: 100,
        height: 100,
        transparent: false,
        backgroundColor: { r: 0, g: 128, b: 255 },
      };
      await expect(exportToPNG(sourceCanvas, options)).resolves.toMatch(/^data:image\/png/);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// downloadAsPNG — filename normalisation and delegation
// ---------------------------------------------------------------------------

describe('downloadAsPNG', () => {
  it('should not throw for a valid canvas and options', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();
    const restore = patchCreateElement(exportCanvas);

    try {
      await expect(
        downloadAsPNG(sourceCanvas, 'output', { width: 100, height: 100 }),
      ).resolves.toBeUndefined();
    } finally {
      restore();
    }
  });

  it('should append .png when the filename lacks the extension', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();

    const originalCreate = document.createElement.bind(document);
    let capturedDownload: string | null = null;

    document.createElement = (tag: string) => {
      if (tag === 'canvas') return exportCanvas;
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
      await downloadAsPNG(sourceCanvas, 'my-chart', { width: 100, height: 100 });
      expect(capturedDownload).toBe('my-chart.png');
    } finally {
      document.createElement = originalCreate;
    }
  });

  it('should not double-append .png when the filename already has the extension', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub();

    const originalCreate = document.createElement.bind(document);
    let capturedDownload: string | null = null;

    document.createElement = (tag: string) => {
      if (tag === 'canvas') return exportCanvas;
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
      await downloadAsPNG(sourceCanvas, 'chart.png', { width: 100, height: 100 });
      expect(capturedDownload).toBe('chart.png');
    } finally {
      document.createElement = originalCreate;
    }
  });

  it('should propagate errors from exportToPNG', async () => {
    const sourceCanvas = makeCanvasStub();
    const exportCanvas = makeCanvasStub({ failContext: true });
    const restore = patchCreateElement(exportCanvas);

    try {
      await expect(
        downloadAsPNG(sourceCanvas, 'chart', { width: 100, height: 100 }),
      ).rejects.toThrow('Failed to get 2D context for export');
    } finally {
      restore();
    }
  });
});
