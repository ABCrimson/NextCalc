/**
 * Initial-condition generators for 2D PDE simulations.
 *
 * Extracted from app/[locale]/pde/page.tsx so both the PDE studio page and
 * the worksheet simulation cell can share the exact same preset library.
 * Pure functions — no 'use client' needed, safe to import from RSC and
 * client components alike.
 *
 * @module lib/simulation/initial-conditions
 */

/** The 11 built-in initial-condition presets. */
export const INITIAL_CONDITION_TYPES = [
  'center',
  'line',
  'corners',
  'ring',
  'cross',
  'gaussian',
  'random',
  'doubleGaussian',
  'sawtooth',
  'squarePulse',
  'sinc',
] as const;

export type InitialConditionType = (typeof INITIAL_CONDITION_TYPES)[number];

/** Runtime guard for deserialized preset strings (worksheet cells from DB/JSON). */
export function isInitialConditionType(value: string): value is InitialConditionType {
  return (INITIAL_CONDITION_TYPES as readonly string[]).includes(value);
}

/**
 * Generate the initial temperature/displacement grid for a preset.
 *
 * Values are (mostly) in [0, 100]; `sinc` intentionally goes negative for
 * wave-equation interest. The grid is row-major `gridSize × gridSize`.
 */
export function generateInitialCondition(type: InitialConditionType, gridSize: number): number[][] {
  const grid: number[][] = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(0));

  switch (type) {
    case 'center': {
      // Gaussian hot spot in the center — scaled to grid size for visible diffusion
      const center = Math.floor(gridSize / 2);
      const sigma = gridSize / 8; // Wider peak for better visualisation
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const dx = i - center;
          const dy = j - center;
          grid[i]![j] = 100 * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        }
      }
      break;
    }

    case 'line': {
      // Hot line across the middle
      const mid = Math.floor(gridSize / 2);
      for (let j = 0; j < gridSize; j++) {
        grid[mid]![j] = 100;
        if (mid > 0) grid[mid - 1]![j] = 50;
        if (mid < gridSize - 1) grid[mid + 1]![j] = 50;
      }
      break;
    }

    case 'corners': {
      // Hot corners
      const cornerSize = 5;
      for (let i = 0; i < cornerSize; i++) {
        for (let j = 0; j < cornerSize; j++) {
          const intensity = 100 * (1 - Math.sqrt(i * i + j * j) / (cornerSize * Math.sqrt(2)));
          grid[i]![j] = Math.max(0, intensity);
          grid[i]![gridSize - 1 - j] = Math.max(0, intensity);
          grid[gridSize - 1 - i]![j] = Math.max(0, intensity);
          grid[gridSize - 1 - i]![gridSize - 1 - j] = Math.max(0, intensity);
        }
      }
      break;
    }

    case 'ring': {
      // Ring pattern — width scales with grid for consistent aesthetics
      const ringCenter = Math.floor(gridSize / 2);
      const ringRadius = Math.floor(gridSize / 3);
      const ringWidth = Math.max(3, Math.floor(gridSize / 16));
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const dx = i - ringCenter;
          const dy = j - ringCenter;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.abs(dist - ringRadius);
          if (proximity < ringWidth) {
            grid[i]![j] = 100 * (1 - proximity / ringWidth);
          }
        }
      }
      break;
    }

    case 'cross': {
      // Cross pattern
      const crossMid = Math.floor(gridSize / 2);
      const crossWidth = 3;
      for (let i = 0; i < gridSize; i++) {
        for (let j = crossMid - crossWidth; j <= crossMid + crossWidth; j++) {
          if (j >= 0 && j < gridSize) {
            grid[i]![j] = 100 * (1 - Math.abs(j - crossMid) / crossWidth);
          }
        }
      }
      for (let j = 0; j < gridSize; j++) {
        for (let i = crossMid - crossWidth; i <= crossMid + crossWidth; i++) {
          if (i >= 0 && i < gridSize) {
            grid[i]![j] = Math.max(
              grid[i]![j] ?? 0,
              100 * (1 - Math.abs(i - crossMid) / crossWidth),
            );
          }
        }
      }
      break;
    }

    case 'gaussian': {
      // Multiple Gaussian peaks
      const peaks = [
        { x: gridSize / 4, y: gridSize / 4 },
        { x: (3 * gridSize) / 4, y: gridSize / 4 },
        { x: gridSize / 2, y: (3 * gridSize) / 4 },
      ];
      const sigma = gridSize / 10;
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          let value = 0;
          for (const peak of peaks) {
            const dx = i - peak.x;
            const dy = j - peak.y;
            const r2 = dx * dx + dy * dy;
            value += 100 * Math.exp(-r2 / (2 * sigma * sigma));
          }
          grid[i]![j] = Math.min(100, value);
        }
      }
      break;
    }

    case 'random':
      // Random hot spots
      for (let k = 0; k < 10; k++) {
        const x = Math.floor(Math.random() * (gridSize - 10)) + 5;
        const y = Math.floor(Math.random() * (gridSize - 10)) + 5;
        const size = 3;
        for (let i = x - size; i <= x + size; i++) {
          for (let j = y - size; j <= y + size; j++) {
            if (i >= 0 && i < gridSize && j >= 0 && j < gridSize) {
              const dist = Math.sqrt((i - x) ** 2 + (j - y) ** 2);
              grid[i]![j] = Math.max(grid[i]![j] ?? 0, 100 * (1 - dist / size));
            }
          }
        }
      }
      break;

    case 'doubleGaussian': {
      // Two Gaussian peaks: f(x) = exp(-(x-0.3)^2/0.01) + exp(-(x-0.7)^2/0.01)
      // Applied as separable product f(x)*f(y) for a 2D pattern
      const dgFn = (t: number): number =>
        Math.exp(-((t - 0.3) ** 2) / 0.01) + Math.exp(-((t - 0.7) ** 2) / 0.01);
      for (let i = 0; i < gridSize; i++) {
        const nx = i / (gridSize - 1);
        for (let j = 0; j < gridSize; j++) {
          const ny = j / (gridSize - 1);
          grid[i]![j] = 100 * dgFn(nx) * dgFn(ny);
        }
      }
      break;
    }

    case 'sawtooth': {
      // Sawtooth: f(x) = x - floor(x), with 3 repeats across the domain
      // Applied as separable product for 2D
      const stFn = (t: number): number => {
        const scaled = t * 3;
        return scaled - Math.floor(scaled);
      };
      for (let i = 0; i < gridSize; i++) {
        const nx = i / (gridSize - 1);
        for (let j = 0; j < gridSize; j++) {
          const ny = j / (gridSize - 1);
          grid[i]![j] = 100 * stFn(nx) * stFn(ny);
        }
      }
      break;
    }

    case 'squarePulse': {
      // Square pulse: f(x) = 1 if 0.3 < x < 0.7, else 0
      // Applied as separable product for a 2D box
      const spFn = (t: number): number => (t > 0.3 && t < 0.7 ? 1 : 0);
      for (let i = 0; i < gridSize; i++) {
        const nx = i / (gridSize - 1);
        for (let j = 0; j < gridSize; j++) {
          const ny = j / (gridSize - 1);
          grid[i]![j] = 100 * spFn(nx) * spFn(ny);
        }
      }
      break;
    }

    case 'sinc': {
      // Sinc function: f(x) = sin(t)/t where t = (x-0.5)*20, f(0.5) = 1
      // Applied as separable product for 2D
      const sincFn = (x: number): number => {
        const t = (x - 0.5) * 20;
        return t === 0 ? 1 : Math.sin(t) / t;
      };
      for (let i = 0; i < gridSize; i++) {
        const nx = i / (gridSize - 1);
        for (let j = 0; j < gridSize; j++) {
          const ny = j / (gridSize - 1);
          // sinc can be negative; scale so max is 100, keeping sign for wave equation interest
          grid[i]![j] = 100 * sincFn(nx) * sincFn(ny);
        }
      }
      break;
    }
  }

  return grid;
}
