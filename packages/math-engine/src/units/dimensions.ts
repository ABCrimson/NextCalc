/**
 * Dimensional analysis for unit-aware calculations
 * Implements the Seven SI Base Dimensions
 */

/**
 * Seven SI base dimensions (powers)
 * [Length, Mass, Time, Electric Current, Temperature, Amount of Substance, Luminous Intensity]
 */
export type Dimension = readonly [
  number, // Length (meter)
  number, // Mass (kilogram)
  number, // Time (second)
  number, // Electric Current (ampere)
  number, // Temperature (kelvin)
  number, // Amount of Substance (mole)
  number, // Luminous Intensity (candela)
];

/**
 * Dimensionless quantity (all powers = 0)
 */
export const DIMENSIONLESS: Dimension = [0, 0, 0, 0, 0, 0, 0];

/**
 * Base SI dimensions
 */
export const SI_BASE_DIMENSIONS = {
  length: [1, 0, 0, 0, 0, 0, 0] as Dimension,
  mass: [0, 1, 0, 0, 0, 0, 0] as Dimension,
  time: [0, 0, 1, 0, 0, 0, 0] as Dimension,
  current: [0, 0, 0, 1, 0, 0, 0] as Dimension,
  temperature: [0, 0, 0, 0, 1, 0, 0] as Dimension,
  amount: [0, 0, 0, 0, 0, 1, 0] as Dimension,
  luminousIntensity: [0, 0, 0, 0, 0, 0, 1] as Dimension,
} as const;

/**
 * Derived dimensions
 */
export const DERIVED_DIMENSIONS = {
  // Mechanical
  area: [2, 0, 0, 0, 0, 0, 0] as Dimension, // m²
  volume: [3, 0, 0, 0, 0, 0, 0] as Dimension, // m³
  velocity: [1, 0, -1, 0, 0, 0, 0] as Dimension, // m/s
  acceleration: [1, 0, -2, 0, 0, 0, 0] as Dimension, // m/s²
  force: [1, 1, -2, 0, 0, 0, 0] as Dimension, // kg⋅m/s² (Newton)
  energy: [2, 1, -2, 0, 0, 0, 0] as Dimension, // kg⋅m²/s² (Joule)
  power: [2, 1, -3, 0, 0, 0, 0] as Dimension, // kg⋅m²/s³ (Watt)
  pressure: [-1, 1, -2, 0, 0, 0, 0] as Dimension, // kg/(m⋅s²) (Pascal)

  // Electrical
  charge: [0, 0, 1, 1, 0, 0, 0] as Dimension, // A⋅s (Coulomb)
  voltage: [2, 1, -3, -1, 0, 0, 0] as Dimension, // kg⋅m²/(A⋅s³) (Volt)
  resistance: [2, 1, -3, -2, 0, 0, 0] as Dimension, // kg⋅m²/(A²⋅s³) (Ohm)
  capacitance: [-2, -1, 4, 2, 0, 0, 0] as Dimension, // A²⋅s⁴/(kg⋅m²) (Farad)

  // Frequency
  frequency: [0, 0, -1, 0, 0, 0, 0] as Dimension, // 1/s (Hertz)
} as const;

/**
 * Check if two dimensions are equal
 */
export function dimensionsEqual(a: Dimension, b: Dimension): boolean {
  return a.every((val, i) => val === b[i]);
}

/**
 * Check if a dimension is dimensionless
 */
export function isDimensionless(dim: Dimension): boolean {
  return dimensionsEqual(dim, DIMENSIONLESS);
}

/**
 * Multiply two dimensions (add exponents)
 */
export function multiplyDimensions(a: Dimension, b: Dimension): Dimension {
  return a.map((val, i) => val + (b[i] ?? 0)) as unknown as Dimension;
}

/**
 * Divide two dimensions (subtract exponents)
 */
export function divideDimensions(a: Dimension, b: Dimension): Dimension {
  return a.map((val, i) => val - (b[i] ?? 0)) as unknown as Dimension;
}

/**
 * Raise dimension to a power (multiply all exponents)
 */
export function powerDimension(dim: Dimension, power: number): Dimension {
  return dim.map((val) => val * power) as unknown as Dimension;
}

/**
 * Format dimension as string (e.g., "m²/s" for acceleration)
 */
export function formatDimension(dim: Dimension): string {
  const labels = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'];
  const positive: string[] = [];
  const negative: string[] = [];

  dim.forEach((power, i) => {
    if (power === 0) return;

    const label = labels[i];
    if (!label) return;
    const abs = Math.abs(power);
    const formatted = abs === 1 ? label : `${label}${toSuperscript(abs)}`;

    if (power > 0) {
      positive.push(formatted);
    } else {
      negative.push(formatted);
    }
  });

  if (positive.length === 0 && negative.length === 0) {
    return '1'; // Dimensionless
  }

  if (negative.length === 0) {
    return positive.join('⋅');
  }

  if (positive.length === 0) {
    return `1/${negative.join('⋅')}`;
  }

  return `${positive.join('⋅')}/${negative.join('⋅')}`;
}

/**
 * Convert number to superscript
 */
function toSuperscript(n: number): string {
  const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return String(n)
    .split('')
    .map((digit) => superscripts[parseInt(digit, 10)])
    .join('');
}

/**
 * Dimensional analysis error
 */
export class DimensionalError extends Error {
  constructor(
    message: string,
    public expected: Dimension,
    public actual: Dimension,
  ) {
    super(`${message}\nExpected: ${formatDimension(expected)}\nActual: ${formatDimension(actual)}`);
    this.name = 'DimensionalError';
  }
}
