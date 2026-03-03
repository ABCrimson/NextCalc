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
  length: [1, 0, 0, 0, 0, 0, 0],
  mass: [0, 1, 0, 0, 0, 0, 0],
  time: [0, 0, 1, 0, 0, 0, 0],
  current: [0, 0, 0, 1, 0, 0, 0],
  temperature: [0, 0, 0, 0, 1, 0, 0],
  amount: [0, 0, 0, 0, 0, 1, 0],
  luminousIntensity: [0, 0, 0, 0, 0, 0, 1],
} as const satisfies Record<string, Dimension>;

/**
 * Derived dimensions
 */
export const DERIVED_DIMENSIONS = {
  // Mechanical
  area: [2, 0, 0, 0, 0, 0, 0], // m²
  volume: [3, 0, 0, 0, 0, 0, 0], // m³
  velocity: [1, 0, -1, 0, 0, 0, 0], // m/s
  acceleration: [1, 0, -2, 0, 0, 0, 0], // m/s²
  force: [1, 1, -2, 0, 0, 0, 0], // kg⋅m/s² (Newton)
  energy: [2, 1, -2, 0, 0, 0, 0], // kg⋅m²/s² (Joule)
  power: [2, 1, -3, 0, 0, 0, 0], // kg⋅m²/s³ (Watt)
  pressure: [-1, 1, -2, 0, 0, 0, 0], // kg/(m⋅s²) (Pascal)

  // Electrical
  charge: [0, 0, 1, 1, 0, 0, 0], // A⋅s (Coulomb)
  voltage: [2, 1, -3, -1, 0, 0, 0], // kg⋅m²/(A⋅s³) (Volt)
  resistance: [2, 1, -3, -2, 0, 0, 0], // kg⋅m²/(A²⋅s³) (Ohm)
  capacitance: [-2, -1, 4, 2, 0, 0, 0], // A²⋅s⁴/(kg⋅m²) (Farad)

  // Frequency
  frequency: [0, 0, -1, 0, 0, 0, 0], // 1/s (Hertz)
} as const satisfies Record<string, Dimension>;

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
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
    a[3] + b[3],
    a[4] + b[4],
    a[5] + b[5],
    a[6] + b[6],
  ] satisfies Dimension;
}

/**
 * Divide two dimensions (subtract exponents)
 */
export function divideDimensions(a: Dimension, b: Dimension): Dimension {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
    a[3] - b[3],
    a[4] - b[4],
    a[5] - b[5],
    a[6] - b[6],
  ] satisfies Dimension;
}

/**
 * Raise dimension to a power (multiply all exponents)
 */
export function powerDimension(dim: Dimension, power: number): Dimension {
  return [
    dim[0] * power,
    dim[1] * power,
    dim[2] * power,
    dim[3] * power,
    dim[4] * power,
    dim[5] * power,
    dim[6] * power,
  ] satisfies Dimension;
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
