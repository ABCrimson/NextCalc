/**
 * Unit tests for Export service handlers
 *
 * The pdf.ts and png.ts modules import @cf-wasm/resvg/workerd (WASM) and
 * modern-pdf-lib at the top level.  Both must be mocked before any handler import
 * so the module graph resolves without attempting WASM instantiation.
 */

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @cf-wasm/resvg/workerd — WASM cannot be instantiated in vitest.
// ---------------------------------------------------------------------------
vi.mock('@cf-wasm/resvg/workerd', () => ({
  Resvg: {
    async: vi.fn().mockResolvedValue({
      render: vi.fn().mockReturnValue({
        width: 200,
        height: 50,
        asPng: () => new Uint8Array(100),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock modern-pdf-lib — createPdf() and PageSizes are used.
// ---------------------------------------------------------------------------
vi.mock('modern-pdf-lib', () => {
  const mockPage = { drawImage: vi.fn() };
  const mockImage = { width: 200, height: 50 };
  const mockDoc = {
    setTitle: vi.fn(),
    setAuthor: vi.fn(),
    setSubject: vi.fn(),
    setCreator: vi.fn(),
    setProducer: vi.fn(),
    setCreationDate: vi.fn(),
    addPage: vi.fn().mockReturnValue(mockPage),
    embedPng: vi.fn().mockReturnValue(mockImage),
    save: vi.fn().mockResolvedValue(new Uint8Array(512)),
  };
  return {
    createPdf: vi.fn().mockReturnValue(mockDoc),
    PageSizes: {
      A4: [595.28, 841.89],
      Letter: [612, 792],
      Legal: [612, 1008],
    },
  };
});

// ---------------------------------------------------------------------------
// Mock MathJax internals — svg-internal.ts uses MathJax which cannot load
// in a vitest environment on Windows.
// ---------------------------------------------------------------------------
vi.mock('../handlers/svg-internal.js', () => ({
  generateSvgFromLatex: vi
    .fn()
    .mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text>mock</text></svg>',
    ),
  generateRasterSvgFromLatex: vi
    .fn()
    .mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text>mock</text></svg>',
    ),
}));

import { createLatexDocument, validateLatexSyntax } from '../handlers/pdf.js';
import { estimatePngSize, getRecommendedDpi } from '../handlers/png.js';
import { optimizeSvg } from '../handlers/svg.js';

describe('PDF Handler', () => {
  describe('validateLatexSyntax', () => {
    it('should validate balanced braces', () => {
      expect(validateLatexSyntax('\\frac{1}{2}')).toBe(true);
      expect(validateLatexSyntax('\\frac{1}{2')).toBe(false);
    });

    it('should validate balanced dollar signs', () => {
      expect(validateLatexSyntax('$x^2$')).toBe(true);
      expect(validateLatexSyntax('$x^2')).toBe(false);
    });

    it('should accept valid LaTeX commands', () => {
      expect(validateLatexSyntax('\\int x dx')).toBe(true);
      expect(validateLatexSyntax('\\sum_{i=1}^{n} i')).toBe(true);
    });
  });

  describe('createLatexDocument', () => {
    it('should create a complete LaTeX document', () => {
      const doc = createLatexDocument('E = mc^2', {
        title: 'Test Document',
        author: 'Test Author',
      });

      expect(doc).toContain('\\documentclass');
      expect(doc).toContain('\\title{Test Document}');
      expect(doc).toContain('\\author{Test Author}');
      expect(doc).toContain('E = mc^2');
      expect(doc).toContain('\\begin{document}');
      expect(doc).toContain('\\end{document}');
    });

    it('should include specified packages', () => {
      const doc = createLatexDocument('content', {
        packages: ['amsmath', 'graphicx'],
      });

      expect(doc).toContain('\\usepackage{amsmath}');
      expect(doc).toContain('\\usepackage{graphicx}');
    });
  });
});

describe('PNG Handler', () => {
  describe('getRecommendedDpi', () => {
    it('should return correct DPI for web', () => {
      expect(getRecommendedDpi('web')).toBe(72);
    });

    it('should return correct DPI for retina', () => {
      expect(getRecommendedDpi('retina')).toBe(144);
    });

    it('should return correct DPI for print', () => {
      expect(getRecommendedDpi('print')).toBe(300);
    });

    it('should return correct DPI for presentation', () => {
      expect(getRecommendedDpi('presentation')).toBe(150);
    });
  });

  describe('estimatePngSize', () => {
    it('should estimate size for RGB image', () => {
      const size = estimatePngSize(800, 600, false);
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(800 * 600 * 3 + 1024);
    });

    it('should estimate size for RGBA image', () => {
      const size = estimatePngSize(800, 600, true);
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(800 * 600 * 4 + 1024);
    });
  });
});

describe('SVG Handler', () => {
  describe('optimizeSvg', () => {
    it('should remove XML declaration', () => {
      const svg = '<?xml version="1.0"?><svg></svg>';
      const optimized = optimizeSvg(svg);
      expect(optimized).not.toContain('<?xml');
    });

    it('should remove comments', () => {
      const svg = '<svg><!-- comment --></svg>';
      const optimized = optimizeSvg(svg);
      expect(optimized).not.toContain('<!--');
    });

    it('should remove unnecessary whitespace', () => {
      const svg = '<svg>  <rect>  </rect>  </svg>';
      const optimized = optimizeSvg(svg);
      expect(optimized).toBe('<svg><rect></rect></svg>');
    });
  });
});
