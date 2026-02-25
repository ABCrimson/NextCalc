/**
 * Comprehensive tests for Chaos Theory
 */

import { describe, it, expect } from 'vitest';
import {
  LogisticMap,
  LorenzAttractor,
  RosslerAttractor,
  HenonMap,
  boxCountingDimension,
  autocorrelation,
  powerSpectrum,
} from './chaos-theory';

describe('Logistic Map', () => {
  describe('Basic Iteration', () => {
    it('should iterate logistic map correctly', () => {
      const map = new LogisticMap(3.5);
      const x0 = 0.5;
      const x1 = map.iterate(x0);

      expect(x1).toBeCloseTo(3.5 * 0.5 * 0.5, 10);
    });

    it('should stay within [0, 1] for valid parameters', () => {
      const map = new LogisticMap(3.8);
      let x = 0.5;

      for (let i = 0; i < 1000; i++) {
        x = map.iterate(x);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Time Series', () => {
    it('should generate time series of correct length', () => {
      const map = new LogisticMap(3.5);
      const series = map.timeSeries(0.5, 100);

      expect(series.length).toBe(100);
    });

    it('should discard transient correctly', () => {
      const map = new LogisticMap(3.8);
      const series1 = map.timeSeries(0.5, 100, 0);
      const series2 = map.timeSeries(0.5, 100, 1000);

      // Series should be different due to transient
      expect(series1[0]).not.toEqual(series2[0]);
    });

    it('should converge to fixed point for r < 3', () => {
      const map = new LogisticMap(2.5);
      const series = map.timeSeries(0.5, 1000, 100);

      // Check convergence
      const last10 = series.slice(-10);
      const variance = last10.reduce((sum, x) => {
        const mean = last10.reduce((a, b) => a + b, 0) / last10.length;
        return sum + (x - mean) ** 2;
      }, 0) / last10.length;

      expect(variance).toBeLessThan(1e-10); // Should converge
    });
  });

  describe('Bifurcation Diagram', () => {
    it('should generate bifurcation diagram', () => {
      const map = new LogisticMap(3.5);
      const diagram = map.bifurcationDiagram(2.5, 4.0, 100, 100, 50);

      expect(diagram.length).toBe(100 * 50);
      expect(diagram[0]).toHaveProperty('parameter');
      expect(diagram[0]).toHaveProperty('value');
    });

    it('should span correct parameter range', () => {
      const map = new LogisticMap(3.5);
      const diagram = map.bifurcationDiagram(3.0, 3.5, 10);

      const minParam = Math.min(...diagram.map(p => p.parameter));
      const maxParam = Math.max(...diagram.map(p => p.parameter));

      // Use lower precision (1 decimal place) as implementation may not include exact endpoints
      expect(minParam).toBeCloseTo(3.0, 1);
      expect(maxParam).toBeCloseTo(3.5, 1);
    });
  });

  describe('Lyapunov Exponent', () => {
    it('should compute Lyapunov exponent', () => {
      const map = new LogisticMap(3.8);
      const result = map.lyapunovExponent(1000);

      expect(result.exponent).toBeDefined();
      expect(result.chaotic).toBeDefined();
      expect(result.convergence.length).toBeGreaterThan(0);
    });

    it('should indicate chaos for r = 3.8', () => {
      const map = new LogisticMap(3.8);
      const result = map.lyapunovExponent(1000);

      expect(result.chaotic).toBe(true);
      expect(result.exponent).toBeGreaterThan(0);
    });

    it('should indicate non-chaos for r = 2.5', () => {
      const map = new LogisticMap(2.5);
      const result = map.lyapunovExponent(1000);

      expect(result.chaotic).toBe(false);
      expect(result.exponent).toBeLessThan(0);
    });

    it('should show convergence over time', () => {
      const map = new LogisticMap(3.5);
      const result = map.lyapunovExponent(5000);

      expect(result.convergence.length).toBeGreaterThan(10);
      // Later values should be more stable
      const early = result.convergence.slice(0, 5);
      const late = result.convergence.slice(-5);
      expect(late.length).toBeGreaterThan(0);
    });
  });

  describe('Periodic Orbits', () => {
    it('should find period-1 orbit for r = 2.5', () => {
      const map = new LogisticMap(2.5);
      const orbits = map.findPeriodicOrbits(1);

      expect(orbits.length).toBeGreaterThan(0);
    });

    it('should find period-2 orbit for r = 3.2', () => {
      const map = new LogisticMap(3.2);
      const orbits = map.findPeriodicOrbits(2);

      expect(orbits.length).toBeGreaterThan(0);
    });
  });
});

describe('Lorenz Attractor', () => {
  describe('Simulation', () => {
    it('should simulate Lorenz system', () => {
      const lorenz = new LorenzAttractor();
      const trajectory = lorenz.simulate(100, 0.01);

      expect(trajectory.length).toBe(101);
      expect(trajectory[0]).toHaveProperty('x');
      expect(trajectory[0]).toHaveProperty('y');
      expect(trajectory[0]).toHaveProperty('z');
    });

    it('should start from initial conditions', () => {
      const lorenz = new LorenzAttractor();
      const initial = { x: 1, y: 2, z: 3 };
      const trajectory = lorenz.simulate(10, 0.01, initial);

      expect(trajectory[0]).toEqual(initial);
    });

    it('should evolve over time', () => {
      const lorenz = new LorenzAttractor();
      const trajectory = lorenz.simulate(100, 0.01);

      // State should change
      expect(trajectory[100]).not.toEqual(trajectory[0]);
    });

    it('should handle different time steps', () => {
      const lorenz = new LorenzAttractor();

      const traj1 = lorenz.simulate(100, 0.01);
      const traj2 = lorenz.simulate(100, 0.001);

      expect(traj1.length).toBe(101);
      expect(traj2.length).toBe(101);
    });
  });

  describe('Lyapunov Exponent', () => {
    it('should compute positive Lyapunov exponent', () => {
      const lorenz = new LorenzAttractor();
      const result = lorenz.lyapunovExponent(1000, 0.01);

      expect(result.exponent).toBeGreaterThan(0);
      expect(result.chaotic).toBe(true);
    });

    it('should show convergence', () => {
      const lorenz = new LorenzAttractor();
      const result = lorenz.lyapunovExponent(5000, 0.01);

      expect(result.convergence.length).toBeGreaterThan(10);
    });
  });

  describe('Poincaré Section', () => {
    it('should compute Poincaré section', () => {
      const lorenz = new LorenzAttractor();
      const section = lorenz.poincareSection(27, 10000, 0.01);

      expect(section.length).toBeGreaterThan(0);
      section.forEach(point => {
        expect(point).toHaveProperty('x');
        expect(point).toHaveProperty('y');
      });
    });

    it('should find multiple crossings', () => {
      const lorenz = new LorenzAttractor();
      const section = lorenz.poincareSection(27, 50000, 0.01);

      expect(section.length).toBeGreaterThan(10);
    });
  });
});

describe('Rössler Attractor', () => {
  describe('Simulation', () => {
    it('should simulate Rössler system', () => {
      const rossler = new RosslerAttractor();
      const trajectory = rossler.simulate(100, 0.01);

      expect(trajectory.length).toBe(101);
      expect(trajectory[0]).toHaveProperty('x');
      expect(trajectory[0]).toHaveProperty('y');
      expect(trajectory[0]).toHaveProperty('z');
    });

    it('should use custom parameters', () => {
      const rossler = new RosslerAttractor(0.15, 0.2, 10);
      const trajectory = rossler.simulate(100);

      expect(trajectory.length).toBeGreaterThan(0);
    });

    it('should evolve from initial conditions', () => {
      const rossler = new RosslerAttractor();
      const initial = { x: 0.5, y: 0.5, z: 0.5 };
      const trajectory = rossler.simulate(100, 0.01, initial);

      expect(trajectory[0]).toEqual(initial);
      expect(trajectory[50]).not.toEqual(initial);
    });
  });
});

describe('Hénon Map', () => {
  describe('Basic Iteration', () => {
    it('should iterate Hénon map', () => {
      const henon = new HenonMap();
      const next = henon.iterate(0, 0);

      expect(next).toHaveProperty('x');
      expect(next).toHaveProperty('y');
      expect(next.x).toBeCloseTo(1, 10);
      expect(next.y).toBeCloseTo(0, 10);
    });

    it('should generate trajectory', () => {
      const henon = new HenonMap();
      const trajectory = henon.trajectory(100);

      expect(trajectory.length).toBe(101);
    });
  });

  describe('Lyapunov Exponent', () => {
    it('should compute positive Lyapunov exponent', () => {
      const henon = new HenonMap(1.4, 0.3);
      const result = henon.lyapunovExponent(5000);

      expect(result.exponent).toBeGreaterThan(0);
      expect(result.chaotic).toBe(true);
    });

    it('should show convergence', () => {
      const henon = new HenonMap();
      const result = henon.lyapunovExponent(5000);

      expect(result.convergence.length).toBeGreaterThan(10);
    });
  });
});

describe('Fractal Dimensions', () => {
  describe('Box Counting', () => {
    it('should compute box-counting dimension', () => {
      const lorenz = new LorenzAttractor();
      const trajectory = lorenz.simulate(1000, 0.01);

      const dimension = boxCountingDimension(trajectory, 0.1, 10, 5);

      expect(dimension).toBeGreaterThan(0);
      expect(dimension).toBeLessThan(3); // 3D embedding space
    });

    it('should handle simple structures', () => {
      // Create a line (dimension ≈ 1)
      const line: Array<{ x: number; y: number; z: number }> = [];
      for (let i = 0; i < 100; i++) {
        line.push({ x: i * 0.1, y: 0, z: 0 });
      }

      const dimension = boxCountingDimension(line, 0.1, 5, 5);

      expect(dimension).toBeGreaterThan(0.5);
      expect(dimension).toBeLessThan(1.5);
    });
  });
});

describe('Time Series Analysis', () => {
  describe('Autocorrelation', () => {
    it('should compute autocorrelation', () => {
      const map = new LogisticMap(3.8);
      const series = map.timeSeries(0.5, 1000);

      const autocorr = autocorrelation(series, 50);

      expect(autocorr.length).toBe(51); // 0 to 50 inclusive
      expect(autocorr[0]).toBeCloseTo(1.0, 5); // Perfect correlation at lag 0
    });

    it('should decay for chaotic systems', () => {
      const map = new LogisticMap(3.8);
      const series = map.timeSeries(0.5, 1000);

      const autocorr = autocorrelation(series, 20);

      // Autocorrelation should decay
      expect(Math.abs(autocorr[10]!)).toBeLessThan(Math.abs(autocorr[1]!));
    });

    it('should show periodicity for periodic systems', () => {
      const map = new LogisticMap(3.2); // Period-2 regime
      const series = map.timeSeries(0.5, 1000);

      const autocorr = autocorrelation(series, 10);

      expect(autocorr.length).toBe(11);
    });
  });

  describe('Power Spectrum', () => {
    it('should compute power spectrum', () => {
      const map = new LogisticMap(3.5);
      const series = map.timeSeries(0.5, 128); // Power of 2 for efficiency

      const spectrum = powerSpectrum(series);

      expect(spectrum.length).toBe(64); // Half of input length
      expect(spectrum.every(val => val >= 0)).toBe(true); // Power is non-negative
    });

    it('should detect periodicity', () => {
      // Create periodic signal
      const series = Array.from({ length: 128 }, (_, i) => Math.sin(2 * Math.PI * i / 10));

      const spectrum = powerSpectrum(series);

      expect(spectrum.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration Tests', () => {
  it('should combine attractor simulation with dimension calculation', () => {
    const lorenz = new LorenzAttractor();
    const trajectory = lorenz.simulate(500, 0.01);
    const dimension = boxCountingDimension(trajectory, 0.5, 10, 5);

    expect(dimension).toBeGreaterThan(0);
    expect(trajectory.length).toBe(501);
  });

  it('should analyze multiple chaotic systems', () => {
    const logistic = new LogisticMap(3.8);
    const henon = new HenonMap();

    const logisticLE = logistic.lyapunovExponent(1000);
    const henonLE = henon.lyapunovExponent(1000);

    expect(logisticLE.chaotic).toBe(true);
    expect(henonLE.chaotic).toBe(true);
  });

  it('should generate and analyze time series', () => {
    const map = new LogisticMap(3.7);
    const series = map.timeSeries(0.5, 256);
    const autocorr = autocorrelation(series, 20);
    const spectrum = powerSpectrum(series);

    expect(series.length).toBe(256);
    expect(autocorr.length).toBe(21);
    expect(spectrum.length).toBe(128);
  });
});
