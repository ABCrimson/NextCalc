/**
 * Tests for WebGL3DRenderer.render() plot-type validation.
 *
 * Regression coverage: render() used to hash the config (hashPlot3DConfig)
 * BEFORE checking the plot type, so passing a 2D config died inside the hash
 * with an opaque `TypeError: Invalid value used as weak map key` (from
 * `getFunctionId(undefined)`) instead of the renderer's descriptive
 * "Unsupported plot type" error. The type guard now runs first.
 *
 * @module renderers/webgl-3d.test
 */

import { describe, expect, it } from 'vitest';
import type { Plot2DCartesianConfig } from '../types/index';
import { WebGL3DRenderer } from './webgl-3d';

function make2DConfig(): Plot2DCartesianConfig {
  const axis = {
    label: '',
    min: -5,
    max: 5,
    scale: 'linear',
    grid: { enabled: true, majorStep: 1, color: '#334155', opacity: 0.3 },
    ticks: { enabled: true, format: (v: number) => String(v) },
  } as const;

  return {
    type: '2d-cartesian',
    functions: [{ fn: (x: number) => x * x }],
    viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    xAxis: axis,
    yAxis: axis,
  };
}

describe('WebGL3DRenderer.render', () => {
  it('rejects a 2D config with a descriptive error instead of an opaque TypeError', () => {
    const canvas = document.createElement('canvas');
    const renderer = new WebGL3DRenderer(canvas);

    expect(() => renderer.render(make2DConfig())).toThrow(
      /Unsupported plot type for WebGL 3D renderer: 2d-cartesian/,
    );
  });
});
