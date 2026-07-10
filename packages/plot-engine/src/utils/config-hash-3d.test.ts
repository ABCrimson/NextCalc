/**
 * Tests for 3D plot config change-detection hashing.
 *
 * Regression coverage for the stale-geometry bug: hashConfig used to hash
 * `fn: 'function'` (a hardcoded literal) instead of the actual function
 * identity, and for curve types spread the raw config through
 * `JSON.stringify`, which silently drops function-valued properties. Both
 * paths meant editing a plotted formula with an unchanged viewport/resolution
 * never produced a different hash, so the mesh was never rebuilt.
 *
 * @module utils/config-hash-3d.test
 */

import { describe, expect, it } from 'vitest';
import type {
  Plot2DCartesianConfig,
  Plot3DCurveConfig,
  Plot3DParametricCurveConfig,
  Plot3DParametricSurfaceConfig,
  Plot3DSurfaceConfig,
} from '../types/index';
import { hashPlot3DConfig, isPlot3DConfig } from './config-hash-3d';

describe('hashPlot3DConfig', () => {
  describe('3d-surface', () => {
    const makeConfig = (fn: (x: number, y: number) => number): Plot3DSurfaceConfig => ({
      type: '3d-surface',
      fn,
      viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      resolution: { x: 50, y: 50 },
      colorMap: 'viridis',
      wireframe: false,
    });

    it('produces different hashes for different fn closures with an identical config shape', () => {
      const fnA = (x: number, y: number) => x + y;
      const fnB = (x: number, y: number) => x + y; // byte-identical source, different closure

      expect(hashPlot3DConfig(makeConfig(fnA))).not.toBe(hashPlot3DConfig(makeConfig(fnB)));
    });

    it('produces the same hash across calls for the same function reference and config', () => {
      const fn = (x: number, y: number) => x * y;
      const config = makeConfig(fn);

      expect(hashPlot3DConfig(config)).toBe(hashPlot3DConfig(config));
    });

    it('produces the same hash when the same fn is re-supplied via a new but equal config object', () => {
      const fn = (x: number, y: number) => x - y;
      expect(hashPlot3DConfig(makeConfig(fn))).toBe(hashPlot3DConfig(makeConfig(fn)));
    });

    it('changes hash when viewport changes but fn stays the same', () => {
      const fn = (x: number, y: number) => x - y;
      const config1 = makeConfig(fn);
      const config2: Plot3DSurfaceConfig = {
        ...config1,
        viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      };

      expect(hashPlot3DConfig(config1)).not.toBe(hashPlot3DConfig(config2));
    });
  });

  describe('3d-parametric', () => {
    it('detects a changed function even when every other field is identical', () => {
      const shared = (u: number, v: number) => u + v;
      const configA: Plot3DParametricSurfaceConfig = {
        type: '3d-parametric',
        functions: { x: shared, y: shared, z: shared },
        uRange: { min: 0, max: 1 },
        vRange: { min: 0, max: 1 },
        resolution: { u: 20, v: 20 },
      };
      const differentZ = (u: number, v: number) => u - v;
      const configB: Plot3DParametricSurfaceConfig = {
        ...configA,
        functions: { ...configA.functions, z: differentZ },
      };

      expect(hashPlot3DConfig(configA)).not.toBe(hashPlot3DConfig(configB));
    });
  });

  describe('3d-curve (regression: JSON.stringify silently drops function props)', () => {
    it('detects a changed function with an otherwise byte-identical config', () => {
      const identity = (t: number) => t;
      const configA: Plot3DCurveConfig = {
        type: '3d-curve',
        functions: { x: identity, y: identity, z: identity },
        tRange: { min: 0, max: 1 },
      };
      const doubled = (t: number) => t * 2;
      const configB: Plot3DCurveConfig = {
        ...configA,
        functions: { ...configA.functions, x: doubled },
      };

      // Prior to the fix these hashes were IDENTICAL: `{ type, ...rest }`
      // is JSON.stringify'd, and JSON.stringify drops function-valued
      // properties entirely, so `functions` never made it into the hash.
      expect(hashPlot3DConfig(configA)).not.toBe(hashPlot3DConfig(configB));
    });
  });

  describe('3d-parametric-curve', () => {
    it('detects a changed function with an otherwise byte-identical config', () => {
      const identity = (t: number) => t;
      const configA: Plot3DParametricCurveConfig = {
        type: '3d-parametric-curve',
        functions: { x: identity, y: identity, z: identity },
        tRange: { min: 0, max: 2 * Math.PI },
      };
      const cosLike = (t: number) => Math.cos(t);
      const configB: Plot3DParametricCurveConfig = {
        ...configA,
        functions: { ...configA.functions, y: cosLike },
      };

      expect(hashPlot3DConfig(configA)).not.toBe(hashPlot3DConfig(configB));
    });
  });
});

describe('isPlot3DConfig', () => {
  it('accepts all four 3D plot types', () => {
    const t = (v: number) => v;
    const threeD = [
      {
        type: '3d-surface',
        fn: (x: number, y: number) => x + y,
        viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
        resolution: { x: 10, y: 10 },
        colorMap: 'viridis',
        wireframe: false,
      },
      {
        type: '3d-parametric',
        functions: { x: t, y: t, z: t },
        uRange: { min: 0, max: 1 },
        vRange: { min: 0, max: 1 },
        resolution: { u: 10, v: 10 },
      },
      { type: '3d-curve', functions: { x: t, y: t, z: t }, tRange: { min: 0, max: 1 } },
      {
        type: '3d-parametric-curve',
        functions: { x: t, y: t, z: t },
        tRange: { min: 0, max: 1 },
      },
    ] as const;

    for (const config of threeD) {
      expect(isPlot3DConfig(config)).toBe(true);
    }
  });

  it('rejects 2D configs (guards render() from hashing them into a TypeError)', () => {
    const config: Plot2DCartesianConfig = {
      type: '2d-cartesian',
      functions: [{ fn: (x: number) => x }],
      viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      xAxis: {
        label: 'x',
        min: -5,
        max: 5,
        scale: 'linear',
        grid: { enabled: true, majorStep: 1, color: '#334155', opacity: 0.3 },
        ticks: { enabled: true, format: (v: number) => String(v) },
      },
      yAxis: {
        label: 'y',
        min: -5,
        max: 5,
        scale: 'linear',
        grid: { enabled: true, majorStep: 1, color: '#334155', opacity: 0.3 },
        ticks: { enabled: true, format: (v: number) => String(v) },
      },
    };

    expect(isPlot3DConfig(config)).toBe(false);
  });
});
