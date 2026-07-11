import { describe, expect, it } from 'vitest';
import {
  nextMode,
  nextSpeed,
  SPEED_STEPS,
  SWEEP_DURATION_MS,
  stepSliderValue,
} from './variable-sliders';

describe('nextMode', () => {
  it('cycles loop -> bounce -> once -> loop', () => {
    expect(nextMode('loop')).toBe('bounce');
    expect(nextMode('bounce')).toBe('once');
    expect(nextMode('once')).toBe('loop');
  });
});

describe('nextSpeed', () => {
  it('cycles 0.5 -> 1 -> 2 -> 4 -> 0.5', () => {
    expect(nextSpeed(0.5)).toBe(1);
    expect(nextSpeed(1)).toBe(2);
    expect(nextSpeed(2)).toBe(4);
    expect(nextSpeed(4)).toBe(0.5);
  });

  it('falls back to the first speed step for a speed outside SPEED_STEPS', () => {
    // indexOf(123) === -1 -> (-1 + 1) % 4 === 0 -> SPEED_STEPS[0]
    expect(nextSpeed(123)).toBe(SPEED_STEPS[0]);
  });

  it('SPEED_STEPS is the documented 0.5/1/2/4 progression', () => {
    expect(SPEED_STEPS).toEqual([0.5, 1, 2, 4]);
  });
});

describe('stepSliderValue', () => {
  const base = { min: 0, max: 10, speed: 1, direction: 1 as const };

  it('advances by (span / SWEEP_DURATION_MS) * dt * speed * direction', () => {
    const result = stepSliderValue({ ...base, value: 0, mode: 'loop', dt: 400 });
    // span=10, dt=400ms, speed=1 -> delta = 10/4000 * 400 = 1
    expect(result.value).toBeCloseTo(1, 10);
    expect(result.direction).toBe(1);
    expect(result.finished).toBe(false);
  });

  it('scales linearly with speed', () => {
    const at1x = stepSliderValue({ ...base, value: 0, mode: 'loop', dt: 400, speed: 1 });
    const at4x = stepSliderValue({ ...base, value: 0, mode: 'loop', dt: 400, speed: 4 });
    expect(at4x.value).toBeCloseTo(at1x.value * 4, 10);
  });

  describe('loop mode', () => {
    it('wraps back to min once value reaches max', () => {
      const result = stepSliderValue({
        ...base,
        value: 9.5,
        mode: 'loop',
        dt: SWEEP_DURATION_MS, // a full sweep worth of dt guarantees overshoot
      });
      expect(result.value).toBe(base.min);
      expect(result.direction).toBe(1);
      expect(result.finished).toBe(false);
    });

    it('never reports finished', () => {
      const result = stepSliderValue({ ...base, value: 9.99, mode: 'loop', dt: 1000 });
      expect(result.finished).toBe(false);
    });
  });

  describe('bounce mode', () => {
    it('clamps at max and flips direction to -1', () => {
      const result = stepSliderValue({
        ...base,
        value: 9.5,
        mode: 'bounce',
        direction: 1,
        dt: 1000,
      });
      expect(result.value).toBe(base.max);
      expect(result.direction).toBe(-1);
      expect(result.finished).toBe(false);
    });

    it('clamps at min and flips direction to +1 when travelling backwards', () => {
      const result = stepSliderValue({
        ...base,
        value: 0.5,
        mode: 'bounce',
        direction: -1,
        dt: 1000,
      });
      expect(result.value).toBe(base.min);
      expect(result.direction).toBe(1);
      expect(result.finished).toBe(false);
    });

    it('does not flip direction mid-sweep', () => {
      const result = stepSliderValue({
        ...base,
        value: 5,
        mode: 'bounce',
        direction: 1,
        dt: 10,
      });
      expect(result.direction).toBe(1);
      expect(result.value).toBeGreaterThan(5);
      expect(result.value).toBeLessThan(base.max);
    });
  });

  describe('once mode', () => {
    it('clamps at max and reports finished', () => {
      const result = stepSliderValue({
        ...base,
        value: 9.5,
        mode: 'once',
        dt: 1000,
      });
      expect(result.value).toBe(base.max);
      expect(result.finished).toBe(true);
    });

    it('is not finished mid-sweep', () => {
      const result = stepSliderValue({
        ...base,
        value: 5,
        mode: 'once',
        dt: 10,
      });
      expect(result.finished).toBe(false);
      expect(result.value).toBeGreaterThan(5);
    });
  });

  it('a full SWEEP_DURATION_MS-length dt at 1x sweeps exactly one full span', () => {
    const result = stepSliderValue({
      min: -5,
      max: 5,
      speed: 1,
      direction: 1,
      value: -5,
      mode: 'bounce',
      dt: SWEEP_DURATION_MS,
    });
    // -5 + (10/4000)*4000*1 = 5 exactly -> clamps at max, flips direction
    expect(result.value).toBe(5);
    expect(result.direction).toBe(-1);
  });
});
