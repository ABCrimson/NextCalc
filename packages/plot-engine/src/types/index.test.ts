/**
 * Tests for the plot-engine type system
 * @module types/index.test
 *
 * The types module exports runtime type-guard functions whose correctness
 * we can verify without needing a canvas or DOM environment.  All TypeScript
 * interface definitions are compile-time only, so we validate them through
 * structural compatibility checks expressed as ordinary value tests.
 */

import { describe, expect, it } from 'vitest';
import type {
  ExportCSVOptions,
  ExportPNGOptions,
  ExportSVGOptions,
  Plot2DCartesianConfig,
  Plot2DImplicitConfig,
  Plot2DParametricConfig,
  Plot2DPolarConfig,
  Plot2DVectorFieldConfig,
  Plot3DCurveConfig,
  Plot3DParametricCurveConfig,
  Plot3DParametricSurfaceConfig,
  Plot3DSurfaceConfig,
  PlotConfig,
  SamplingConfig,
  Viewport,
} from './index';
import {
  is2DPlot,
  is3DPlot,
  isImplicitPlot,
  isParametricPlot,
  isSurfacePlot,
  isVectorFieldPlot,
} from './index';

// ---------------------------------------------------------------------------
// Minimal fixture factories
// ---------------------------------------------------------------------------

const noop = () => 0;
const noop2 = (_x: number, _y: number) => 0;

const cartesian2D: Plot2DCartesianConfig = {
  type: '2d-cartesian',
  functions: [{ fn: noop }],
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  xAxis: {
    label: 'x',
    min: -10,
    max: 10,
    scale: 'linear',
    grid: { enabled: true, majorStep: 1, color: '#ccc', opacity: 1 },
    ticks: { enabled: true, format: (v) => String(v) },
  },
  yAxis: {
    label: 'y',
    min: -10,
    max: 10,
    scale: 'linear',
    grid: { enabled: true, majorStep: 1, color: '#ccc', opacity: 1 },
    ticks: { enabled: true, format: (v) => String(v) },
  },
};

const polar2D: Plot2DPolarConfig = {
  type: '2d-polar',
  functions: [{ fn: noop }],
  thetaRange: { min: 0, max: 2 * Math.PI },
  rRange: { min: 0, max: 10 },
};

const parametric2D: Plot2DParametricConfig = {
  type: '2d-parametric',
  functions: [{ x: noop, y: noop }],
  tRange: { min: 0, max: 2 * Math.PI },
  viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
};

const implicit2D: Plot2DImplicitConfig = {
  type: '2d-implicit',
  fn: noop2,
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
};

const vectorField2D: Plot2DVectorFieldConfig = {
  type: '2d-vector-field',
  field: { x: noop2, y: noop2 },
  viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
};

const surface3D: Plot3DSurfaceConfig = {
  type: '3d-surface',
  fn: noop2,
  viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 },
  resolution: { x: 50, y: 50 },
};

const parametricSurface3D: Plot3DParametricSurfaceConfig = {
  type: '3d-parametric',
  functions: { x: noop2, y: noop2, z: noop2 },
  uRange: { min: 0, max: 2 * Math.PI },
  vRange: { min: 0, max: Math.PI },
  resolution: { u: 32, v: 32 },
};

const curve3D: Plot3DCurveConfig = {
  type: '3d-curve',
  functions: { x: noop, y: noop, z: noop },
  tRange: { min: 0, max: 10 },
};

const parametricCurve3D: Plot3DParametricCurveConfig = {
  type: '3d-parametric-curve',
  functions: { x: noop, y: noop, z: noop },
  tRange: { min: 0, max: 10 },
};

// Collect the full discriminated union for exhaustive checks
const allConfigs: PlotConfig[] = [
  cartesian2D,
  polar2D,
  parametric2D,
  implicit2D,
  vectorField2D,
  surface3D,
  parametricSurface3D,
  curve3D,
  parametricCurve3D,
];

// ---------------------------------------------------------------------------
// is2DPlot
// ---------------------------------------------------------------------------

describe('is2DPlot', () => {
  it('should return true for 2d-cartesian', () => {
    expect(is2DPlot(cartesian2D)).toBe(true);
  });

  it('should return true for 2d-polar', () => {
    expect(is2DPlot(polar2D)).toBe(true);
  });

  it('should return true for 2d-parametric', () => {
    expect(is2DPlot(parametric2D)).toBe(true);
  });

  it('should return true for 2d-implicit', () => {
    expect(is2DPlot(implicit2D)).toBe(true);
  });

  it('should return true for 2d-vector-field', () => {
    expect(is2DPlot(vectorField2D)).toBe(true);
  });

  it('should return false for 3d-surface', () => {
    expect(is2DPlot(surface3D)).toBe(false);
  });

  it('should return false for 3d-parametric', () => {
    expect(is2DPlot(parametricSurface3D)).toBe(false);
  });

  it('should return false for 3d-curve', () => {
    expect(is2DPlot(curve3D)).toBe(false);
  });

  it('should return false for 3d-parametric-curve', () => {
    expect(is2DPlot(parametricCurve3D)).toBe(false);
  });

  it('should classify exactly 5 configs as 2D out of all 9', () => {
    const twoDCount = allConfigs.filter(is2DPlot).length;
    expect(twoDCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// is3DPlot
// ---------------------------------------------------------------------------

describe('is3DPlot', () => {
  it('should return false for 2d-cartesian', () => {
    expect(is3DPlot(cartesian2D)).toBe(false);
  });

  it('should return false for 2d-polar', () => {
    expect(is3DPlot(polar2D)).toBe(false);
  });

  it('should return false for 2d-parametric', () => {
    expect(is3DPlot(parametric2D)).toBe(false);
  });

  it('should return false for 2d-implicit', () => {
    expect(is3DPlot(implicit2D)).toBe(false);
  });

  it('should return false for 2d-vector-field', () => {
    expect(is3DPlot(vectorField2D)).toBe(false);
  });

  it('should return true for 3d-surface', () => {
    expect(is3DPlot(surface3D)).toBe(true);
  });

  it('should return true for 3d-parametric', () => {
    expect(is3DPlot(parametricSurface3D)).toBe(true);
  });

  it('should return true for 3d-curve', () => {
    expect(is3DPlot(curve3D)).toBe(true);
  });

  it('should return true for 3d-parametric-curve', () => {
    expect(is3DPlot(parametricCurve3D)).toBe(true);
  });

  it('should classify exactly 4 configs as 3D out of all 9', () => {
    const threeDCount = allConfigs.filter(is3DPlot).length;
    expect(threeDCount).toBe(4);
  });

  it('should be the complement of is2DPlot for all known configs', () => {
    for (const config of allConfigs) {
      expect(is2DPlot(config)).toBe(!is3DPlot(config));
    }
  });
});

// ---------------------------------------------------------------------------
// isParametricPlot
// ---------------------------------------------------------------------------

describe('isParametricPlot', () => {
  it('should return false for 2d-cartesian', () => {
    expect(isParametricPlot(cartesian2D)).toBe(false);
  });

  it('should return false for 2d-polar', () => {
    expect(isParametricPlot(polar2D)).toBe(false);
  });

  it('should return true for 2d-parametric', () => {
    expect(isParametricPlot(parametric2D)).toBe(true);
  });

  it('should return false for 2d-implicit', () => {
    expect(isParametricPlot(implicit2D)).toBe(false);
  });

  it('should return false for 2d-vector-field', () => {
    expect(isParametricPlot(vectorField2D)).toBe(false);
  });

  it('should return false for 3d-surface', () => {
    expect(isParametricPlot(surface3D)).toBe(false);
  });

  it('should return true for 3d-parametric (surface)', () => {
    expect(isParametricPlot(parametricSurface3D)).toBe(true);
  });

  it('should return true for 3d-curve (matches the "3d-curve" special case)', () => {
    expect(isParametricPlot(curve3D)).toBe(true);
  });

  it('should return true for 3d-parametric-curve', () => {
    expect(isParametricPlot(parametricCurve3D)).toBe(true);
  });

  it('should classify exactly 4 configs as parametric out of all 9', () => {
    const parametricCount = allConfigs.filter(isParametricPlot).length;
    expect(parametricCount).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// isSurfacePlot
// ---------------------------------------------------------------------------

describe('isSurfacePlot', () => {
  it('should return true for 3d-surface', () => {
    expect(isSurfacePlot(surface3D)).toBe(true);
  });

  it('should return true for 3d-parametric', () => {
    expect(isSurfacePlot(parametricSurface3D)).toBe(true);
  });

  it('should return false for all non-surface types', () => {
    const nonSurface: PlotConfig[] = [
      cartesian2D,
      polar2D,
      parametric2D,
      implicit2D,
      vectorField2D,
      curve3D,
      parametricCurve3D,
    ];
    for (const config of nonSurface) {
      expect(isSurfacePlot(config)).toBe(false);
    }
  });

  it('should classify exactly 2 configs as surface plots out of all 9', () => {
    const surfaceCount = allConfigs.filter(isSurfacePlot).length;
    expect(surfaceCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isImplicitPlot
// ---------------------------------------------------------------------------

describe('isImplicitPlot', () => {
  it('should return true for 2d-implicit', () => {
    expect(isImplicitPlot(implicit2D)).toBe(true);
  });

  it('should return false for all other plot types', () => {
    const others: PlotConfig[] = [
      cartesian2D,
      polar2D,
      parametric2D,
      vectorField2D,
      surface3D,
      parametricSurface3D,
      curve3D,
      parametricCurve3D,
    ];
    for (const config of others) {
      expect(isImplicitPlot(config)).toBe(false);
    }
  });

  it('should classify exactly 1 config as implicit out of all 9', () => {
    const implicitCount = allConfigs.filter(isImplicitPlot).length;
    expect(implicitCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isVectorFieldPlot
// ---------------------------------------------------------------------------

describe('isVectorFieldPlot', () => {
  it('should return true for 2d-vector-field', () => {
    expect(isVectorFieldPlot(vectorField2D)).toBe(true);
  });

  it('should return false for all other plot types', () => {
    const others: PlotConfig[] = [
      cartesian2D,
      polar2D,
      parametric2D,
      implicit2D,
      surface3D,
      parametricSurface3D,
      curve3D,
      parametricCurve3D,
    ];
    for (const config of others) {
      expect(isVectorFieldPlot(config)).toBe(false);
    }
  });

  it('should classify exactly 1 config as a vector field out of all 9', () => {
    const vfCount = allConfigs.filter(isVectorFieldPlot).length;
    expect(vfCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type guard mutual exclusivity
// ---------------------------------------------------------------------------

describe('type guard mutual exclusivity', () => {
  it('isSurfacePlot and isImplicitPlot should never both be true for the same config', () => {
    for (const config of allConfigs) {
      expect(isSurfacePlot(config) && isImplicitPlot(config)).toBe(false);
    }
  });

  it('isImplicitPlot and isVectorFieldPlot should never both be true for the same config', () => {
    for (const config of allConfigs) {
      expect(isImplicitPlot(config) && isVectorFieldPlot(config)).toBe(false);
    }
  });

  it('is2DPlot and is3DPlot should never both be true for the same config', () => {
    for (const config of allConfigs) {
      expect(is2DPlot(config) && is3DPlot(config)).toBe(false);
    }
  });

  it('is2DPlot or is3DPlot should be true for every known config', () => {
    for (const config of allConfigs) {
      expect(is2DPlot(config) || is3DPlot(config)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Structural shape tests — verify interface fields are present at runtime
// ---------------------------------------------------------------------------

describe('interface structural shapes', () => {
  describe('Viewport', () => {
    it('should accept a minimal 2D viewport with xMin, xMax, yMin, yMax', () => {
      const vp: Viewport = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
      expect(vp.xMin).toBe(-1);
      expect(vp.xMax).toBe(1);
      expect(vp.yMin).toBe(-1);
      expect(vp.yMax).toBe(1);
    });

    it('should accept optional zMin and zMax', () => {
      const vp: Viewport = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
      expect(vp.zMin).toBe(-1);
      expect(vp.zMax).toBe(1);
    });
  });

  describe('SamplingConfig', () => {
    it('should accept a valid sampling config with all required fields', () => {
      const cfg: SamplingConfig = {
        initialSamples: 100,
        maxDepth: 5,
        angleTolerance: 0.01,
        method: 'recursive-subdivision',
      };
      expect(cfg.initialSamples).toBe(100);
      expect(cfg.method).toBe('recursive-subdivision');
    });

    it('should accept all three method values', () => {
      const methods: SamplingConfig['method'][] = [
        'recursive-subdivision',
        'curvature-based',
        'uniform',
      ];
      for (const method of methods) {
        const cfg: SamplingConfig = {
          initialSamples: 10,
          maxDepth: 3,
          angleTolerance: 0.1,
          method,
        };
        expect(cfg.method).toBe(method);
      }
    });

    it('should accept optional useGPU flag', () => {
      const cfg: SamplingConfig = {
        initialSamples: 10,
        maxDepth: 3,
        angleTolerance: 0.1,
        method: 'uniform',
        useGPU: true,
      };
      expect(cfg.useGPU).toBe(true);
    });
  });

  describe('ExportCSVOptions', () => {
    it('should accept an empty options object (all fields optional)', () => {
      const opts: ExportCSVOptions = {};
      expect(opts).toBeDefined();
    });

    it('should accept all optional fields', () => {
      const opts: ExportCSVOptions = { delimiter: ';', includeHeader: false, precision: 3 };
      expect(opts.delimiter).toBe(';');
      expect(opts.includeHeader).toBe(false);
      expect(opts.precision).toBe(3);
    });
  });

  describe('ExportSVGOptions', () => {
    it('should accept required width and height fields', () => {
      const opts: ExportSVGOptions = { width: 800, height: 600 };
      expect(opts.width).toBe(800);
      expect(opts.height).toBe(600);
    });

    it('should accept optional embedFonts and backgroundColor fields', () => {
      const opts: ExportSVGOptions = {
        width: 800,
        height: 600,
        embedFonts: true,
        backgroundColor: '#ffffff',
      };
      expect(opts.embedFonts).toBe(true);
      expect(opts.backgroundColor).toBe('#ffffff');
    });
  });

  describe('ExportPNGOptions', () => {
    it('should accept required width and height fields', () => {
      const opts: ExportPNGOptions = { width: 1920, height: 1080 };
      expect(opts.width).toBe(1920);
      expect(opts.height).toBe(1080);
    });

    it('should accept optional scale, backgroundColor, and transparent fields', () => {
      const opts: ExportPNGOptions = {
        width: 100,
        height: 100,
        scale: 2,
        backgroundColor: { r: 255, g: 255, b: 255, a: 1 },
        transparent: false,
      };
      expect(opts.scale).toBe(2);
      expect(opts.transparent).toBe(false);
    });
  });

  describe('PlotConfig discriminated union', () => {
    it('should narrow to Plot2DCartesianConfig via type field', () => {
      const config: PlotConfig = cartesian2D;
      if (config.type === '2d-cartesian') {
        // TypeScript narrows here; we just assert runtime shape
        expect(config.functions).toBeDefined();
        expect(config.viewport).toBeDefined();
      } else {
        // Should never reach here
        expect(false).toBe(true);
      }
    });

    it('should narrow to Plot3DSurfaceConfig via type field', () => {
      const config: PlotConfig = surface3D;
      if (config.type === '3d-surface') {
        expect(config.fn).toBeDefined();
        expect(config.resolution).toBeDefined();
      } else {
        expect(false).toBe(true);
      }
    });

    it('should carry every type discriminant in the union', () => {
      const types = allConfigs.map((c) => c.type);
      expect(types).toContain('2d-cartesian');
      expect(types).toContain('2d-polar');
      expect(types).toContain('2d-parametric');
      expect(types).toContain('2d-implicit');
      expect(types).toContain('2d-vector-field');
      expect(types).toContain('3d-surface');
      expect(types).toContain('3d-parametric');
      expect(types).toContain('3d-curve');
      expect(types).toContain('3d-parametric-curve');
    });
  });
});
