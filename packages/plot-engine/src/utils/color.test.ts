/**
 * Tests for color utilities
 * @module utils/color.test
 */

import { describe, expect, it } from 'vitest';
import { getColorFromMap, interpolateColor, parseColor, rgbaToHex, rgbaToString } from './color';

describe('Color Utilities', () => {
  describe('parseColor', () => {
    it('should parse hex colors correctly', () => {
      expect(parseColor('#ff0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
      expect(parseColor('#00ff00')).toEqual({ r: 0, g: 1, b: 0, a: 1 });
      expect(parseColor('#0000ff')).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    });

    it('should parse short hex colors', () => {
      expect(parseColor('#f00')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it('should parse hex colors with alpha', () => {
      const result = parseColor('#ff0000ff');
      expect(result.r).toBe(1);
      expect(result.g).toBe(0);
      expect(result.b).toBe(0);
      expect(result.a).toBe(1);
    });

    it('should parse RGB colors', () => {
      expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it('should parse RGBA colors', () => {
      expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    });

    it('should parse named colors', () => {
      expect(parseColor('red')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
      expect(parseColor('blue')).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    });

    it('should parse object colors', () => {
      expect(parseColor({ r: 255, g: 128, b: 0 })).toEqual({
        r: 1,
        g: 128 / 255,
        b: 0,
        a: 1,
      });
    });
  });

  describe('rgbaToString', () => {
    it('should convert RGBA to string', () => {
      expect(rgbaToString({ r: 1, g: 0, b: 0, a: 1 })).toBe('rgb(255, 0, 0)');
      expect(rgbaToString({ r: 1, g: 0, b: 0, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)');
    });
  });

  describe('rgbaToHex', () => {
    it('should convert RGBA to hex', () => {
      expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
      expect(rgbaToHex({ r: 0, g: 1, b: 0, a: 1 })).toBe('#00ff00');
    });

    it('should include alpha in hex', () => {
      expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 0.5 })).toBe('#ff000080');
    });
  });

  describe('interpolateColor', () => {
    it('should interpolate between two colors', () => {
      const c1 = '#ff0000'; // red
      const c2 = '#0000ff'; // blue

      const mid = interpolateColor(c1, c2, 0.5);
      expect(mid.r).toBeCloseTo(0.5, 1);
      expect(mid.g).toBeCloseTo(0, 1);
      expect(mid.b).toBeCloseTo(0.5, 1);
    });

    it('should return first color at t=0', () => {
      const result = interpolateColor('#ff0000', '#0000ff', 0);
      expect(result.r).toBe(1);
      expect(result.g).toBe(0);
      expect(result.b).toBe(0);
    });

    it('should return second color at t=1', () => {
      const result = interpolateColor('#ff0000', '#0000ff', 1);
      expect(result.r).toBe(0);
      expect(result.g).toBe(0);
      expect(result.b).toBe(1);
    });
  });

  describe('getColorFromMap', () => {
    it('should return colors from viridis map', () => {
      const color1 = getColorFromMap('viridis', 0);
      const color2 = getColorFromMap('viridis', 0.5);
      const color3 = getColorFromMap('viridis', 1);

      expect(color1.r).toBeLessThan(color3.r);
      expect([color1, color2, color3].every((c) => c.r >= 0 && c.r <= 1)).toBe(true);
    });

    it('should clamp values to [0, 1]', () => {
      expect(() => getColorFromMap('viridis', -0.5)).not.toThrow();
      expect(() => getColorFromMap('viridis', 1.5)).not.toThrow();
    });
  });
});
