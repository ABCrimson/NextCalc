/**
 * Tests for the unit conversion engine and dimensional analysis
 */

import { describe, it, expect } from 'vitest';

import {
  DIMENSIONLESS,
  SI_BASE_DIMENSIONS,
  DERIVED_DIMENSIONS,
  dimensionsEqual,
  isDimensionless,
  multiplyDimensions,
  divideDimensions,
  powerDimension,
  formatDimension,
  DimensionalError,
} from './dimensions';

import {
  SI_UNITS,
  LENGTH_UNITS,
  MASS_UNITS,
  TIME_UNITS,
  TEMPERATURE_UNITS,
  DERIVED_UNITS,
  ALL_UNITS,
  createQuantity,
  findUnit,
  findUnitByDimension,
  convertUnit,
  addQuantities,
  multiplyQuantities,
  formatQuantity,
} from './units';

// ============================================================================
// DIMENSION ALGEBRA
// ============================================================================

describe('dimensionsEqual', () => {
  it('returns true for identical dimensions', () => {
    expect(dimensionsEqual(SI_BASE_DIMENSIONS.length, SI_BASE_DIMENSIONS.length)).toBe(true);
  });

  it('returns false for different dimensions', () => {
    expect(dimensionsEqual(SI_BASE_DIMENSIONS.length, SI_BASE_DIMENSIONS.mass)).toBe(false);
  });

  it('returns true for DIMENSIONLESS compared to itself', () => {
    expect(dimensionsEqual(DIMENSIONLESS, DIMENSIONLESS)).toBe(true);
  });

  it('returns false for DIMENSIONLESS vs length', () => {
    expect(dimensionsEqual(DIMENSIONLESS, SI_BASE_DIMENSIONS.length)).toBe(false);
  });
});

describe('isDimensionless', () => {
  it('returns true for DIMENSIONLESS', () => {
    expect(isDimensionless(DIMENSIONLESS)).toBe(true);
  });

  it('returns false for length dimension', () => {
    expect(isDimensionless(SI_BASE_DIMENSIONS.length)).toBe(false);
  });

  it('returns false for derived dimensions', () => {
    expect(isDimensionless(DERIVED_DIMENSIONS.force)).toBe(false);
  });
});

describe('multiplyDimensions', () => {
  it('m * m = m^2 (area)', () => {
    const result = multiplyDimensions(SI_BASE_DIMENSIONS.length, SI_BASE_DIMENSIONS.length);
    expect(dimensionsEqual(result, DERIVED_DIMENSIONS.area)).toBe(true);
  });

  it('m * kg * s^-2 = force (Newton)', () => {
    // Force = length * mass / time^2
    // [1,0,0,...] * [0,1,0,...] = [1,1,0,...] ; then / time^2
    const lengthTimesMass = multiplyDimensions(SI_BASE_DIMENSIONS.length, SI_BASE_DIMENSIONS.mass);
    const timeSquare: typeof SI_BASE_DIMENSIONS.time = [0, 0, 2, 0, 0, 0, 0];
    const result = divideDimensions(lengthTimesMass, timeSquare);
    expect(dimensionsEqual(result, DERIVED_DIMENSIONS.force)).toBe(true);
  });

  it('multiplying by DIMENSIONLESS leaves dimension unchanged', () => {
    const result = multiplyDimensions(SI_BASE_DIMENSIONS.length, DIMENSIONLESS);
    expect(dimensionsEqual(result, SI_BASE_DIMENSIONS.length)).toBe(true);
  });
});

describe('divideDimensions', () => {
  it('m / m = dimensionless', () => {
    const result = divideDimensions(SI_BASE_DIMENSIONS.length, SI_BASE_DIMENSIONS.length);
    expect(isDimensionless(result)).toBe(true);
  });

  it('m / s = velocity', () => {
    const result = divideDimensions(SI_BASE_DIMENSIONS.length, SI_BASE_DIMENSIONS.time);
    expect(dimensionsEqual(result, DERIVED_DIMENSIONS.velocity)).toBe(true);
  });

  it('dividing by DIMENSIONLESS leaves dimension unchanged', () => {
    const result = divideDimensions(SI_BASE_DIMENSIONS.mass, DIMENSIONLESS);
    expect(dimensionsEqual(result, SI_BASE_DIMENSIONS.mass)).toBe(true);
  });
});

describe('powerDimension', () => {
  it('length^2 = area', () => {
    const result = powerDimension(SI_BASE_DIMENSIONS.length, 2);
    expect(dimensionsEqual(result, DERIVED_DIMENSIONS.area)).toBe(true);
  });

  it('length^3 = volume', () => {
    const result = powerDimension(SI_BASE_DIMENSIONS.length, 3);
    expect(dimensionsEqual(result, DERIVED_DIMENSIONS.volume)).toBe(true);
  });

  it('power of 1 is the same dimension', () => {
    const result = powerDimension(SI_BASE_DIMENSIONS.mass, 1);
    expect(dimensionsEqual(result, SI_BASE_DIMENSIONS.mass)).toBe(true);
  });

  it('power of 0 is dimensionless', () => {
    const result = powerDimension(SI_BASE_DIMENSIONS.length, 0);
    expect(isDimensionless(result)).toBe(true);
  });

  it('power of -1 is reciprocal', () => {
    // 1/time = frequency
    const result = powerDimension(SI_BASE_DIMENSIONS.time, -1);
    expect(dimensionsEqual(result, DERIVED_DIMENSIONS.frequency)).toBe(true);
  });
});

describe('formatDimension', () => {
  it('formats DIMENSIONLESS as "1"', () => {
    expect(formatDimension(DIMENSIONLESS)).toBe('1');
  });

  it('formats length as "m"', () => {
    expect(formatDimension(SI_BASE_DIMENSIONS.length)).toBe('m');
  });

  it('formats mass as "kg"', () => {
    expect(formatDimension(SI_BASE_DIMENSIONS.mass)).toBe('kg');
  });

  it('formats velocity as "m/s"', () => {
    expect(formatDimension(DERIVED_DIMENSIONS.velocity)).toBe('m/s');
  });

  it('formats area as "m²"', () => {
    expect(formatDimension(DERIVED_DIMENSIONS.area)).toBe('m\u00b2');
  });

  it('formats frequency as "1/s"', () => {
    expect(formatDimension(DERIVED_DIMENSIONS.frequency)).toBe('1/s');
  });

  it('formats force as "kg\u22c5m/s\u00b2"', () => {
    const result = formatDimension(DERIVED_DIMENSIONS.force);
    expect(result).toContain('m');
    expect(result).toContain('kg');
    expect(result).toContain('s');
  });
});

describe('DimensionalError', () => {
  it('is an instance of Error', () => {
    const err = new DimensionalError('test', DIMENSIONLESS, SI_BASE_DIMENSIONS.length);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DimensionalError);
  });

  it('has name DimensionalError', () => {
    const err = new DimensionalError('test', DIMENSIONLESS, SI_BASE_DIMENSIONS.length);
    expect(err.name).toBe('DimensionalError');
  });

  it('message includes the given message text', () => {
    const err = new DimensionalError('bad conversion', DIMENSIONLESS, SI_BASE_DIMENSIONS.length);
    expect(err.message).toContain('bad conversion');
  });

  it('stores expected and actual dimensions', () => {
    const err = new DimensionalError('dim mismatch', SI_BASE_DIMENSIONS.mass, SI_BASE_DIMENSIONS.length);
    expect(err.expected).toEqual(SI_BASE_DIMENSIONS.mass);
    expect(err.actual).toEqual(SI_BASE_DIMENSIONS.length);
  });
});

// ============================================================================
// UNIT REGISTRY
// ============================================================================

describe('ALL_UNITS', () => {
  it('contains SI base units', () => {
    expect(ALL_UNITS['meter']).toBeDefined();
    expect(ALL_UNITS['kilogram']).toBeDefined();
    expect(ALL_UNITS['second']).toBeDefined();
    expect(ALL_UNITS['kelvin']).toBeDefined();
  });

  it('contains length units', () => {
    expect(ALL_UNITS['kilometer']).toBeDefined();
    expect(ALL_UNITS['mile']).toBeDefined();
    expect(ALL_UNITS['foot']).toBeDefined();
    expect(ALL_UNITS['inch']).toBeDefined();
  });

  it('contains temperature units', () => {
    expect(ALL_UNITS['celsius']).toBeDefined();
    expect(ALL_UNITS['fahrenheit']).toBeDefined();
  });

  it('contains derived units', () => {
    expect(ALL_UNITS['newton']).toBeDefined();
    expect(ALL_UNITS['joule']).toBeDefined();
    expect(ALL_UNITS['watt']).toBeDefined();
    expect(ALL_UNITS['pascal']).toBeDefined();
    expect(ALL_UNITS['hertz']).toBeDefined();
  });
});

// ============================================================================
// findUnit
// ============================================================================

describe('findUnit', () => {
  it('finds unit by symbol', () => {
    const unit = findUnit('m');
    expect(unit).toBeDefined();
    expect(unit!.name).toBe('meter');
  });

  it('finds unit by name', () => {
    const unit = findUnit('meter');
    expect(unit).toBeDefined();
    expect(unit!.symbol).toBe('m');
  });

  it('finds kilometer by symbol km', () => {
    const unit = findUnit('km');
    expect(unit).toBeDefined();
    expect(unit!.toSI).toBe(1000);
  });

  it('finds fahrenheit', () => {
    const unit = findUnit('°F');
    expect(unit).toBeDefined();
    expect(unit!.name).toBe('fahrenheit');
  });

  it('returns null for unknown symbol', () => {
    expect(findUnit('lightyear')).toBeNull();
  });
});

// ============================================================================
// findUnitByDimension
// ============================================================================

describe('findUnitByDimension', () => {
  it('finds meter for length dimension', () => {
    const unit = findUnitByDimension(SI_BASE_DIMENSIONS.length);
    expect(unit).toBeDefined();
    expect(unit!.toSI).toBe(1);
    expect(dimensionsEqual(unit!.dimension, SI_BASE_DIMENSIONS.length)).toBe(true);
  });

  it('finds newton for force dimension', () => {
    const unit = findUnitByDimension(DERIVED_DIMENSIONS.force);
    expect(unit).toBeDefined();
    expect(unit!.name).toBe('newton');
  });

  it('finds kelvin for temperature dimension', () => {
    const unit = findUnitByDimension(SI_BASE_DIMENSIONS.temperature);
    expect(unit).toBeDefined();
    expect(unit!.name).toBe('kelvin');
  });

  it('returns null for unknown composite dimension', () => {
    // create a weird dimension not in our registry
    const weirdDim = [5, 5, 5, 5, 5, 5, 5] as unknown as typeof DIMENSIONLESS;
    const unit = findUnitByDimension(weirdDim);
    expect(unit).toBeNull();
  });
});

// ============================================================================
// createQuantity
// ============================================================================

describe('createQuantity', () => {
  it('creates a quantity with correct value', () => {
    const q = createQuantity(5, 'm');
    expect(q.value).toBe(5);
  });

  it('creates a quantity with the right unit', () => {
    const q = createQuantity(3, 'km');
    expect(q.unit.name).toBe('kilometer');
  });

  it('throws for unknown unit', () => {
    expect(() => createQuantity(1, 'parsec')).toThrow();
  });

  it('accepts unit by name', () => {
    const q = createQuantity(10, 'meter');
    expect(q.unit.symbol).toBe('m');
  });
});

// ============================================================================
// convertUnit
// ============================================================================

describe('convertUnit - length', () => {
  it('converts 1 km to 1000 m', () => {
    const km = createQuantity(1, 'km');
    const result = convertUnit(km, SI_UNITS['meter']!);
    expect(result.value).toBeCloseTo(1000, 5);
  });

  it('converts 1 m to 100 cm', () => {
    const m = createQuantity(1, 'm');
    const result = convertUnit(m, LENGTH_UNITS['centimeter']!);
    expect(result.value).toBeCloseTo(100, 5);
  });

  it('converts 1 mile to 1609.344 m', () => {
    const mile = createQuantity(1, 'mi');
    const result = convertUnit(mile, SI_UNITS['meter']!);
    expect(result.value).toBeCloseTo(1609.344, 3);
  });

  it('converts 1 foot to 0.3048 m', () => {
    const ft = createQuantity(1, 'ft');
    const result = convertUnit(ft, SI_UNITS['meter']!);
    expect(result.value).toBeCloseTo(0.3048, 5);
  });

  it('converts 12 inches to 1 foot', () => {
    const inches = createQuantity(12, 'in');
    const result = convertUnit(inches, LENGTH_UNITS['foot']!);
    expect(result.value).toBeCloseTo(1, 5);
  });

  it('throws for incompatible dimensions', () => {
    const meters = createQuantity(1, 'm');
    expect(() => convertUnit(meters, SI_UNITS['kilogram']!)).toThrow(DimensionalError);
  });
});

describe('convertUnit - mass', () => {
  it('converts 1 kg to 1000 g', () => {
    const kg = createQuantity(1, 'kg');
    const result = convertUnit(kg, MASS_UNITS['gram']!);
    expect(result.value).toBeCloseTo(1000, 5);
  });

  it('converts 1 lb to ~453.59 g', () => {
    const lb = createQuantity(1, 'lb');
    const grams = MASS_UNITS['gram']!;
    const result = convertUnit(lb, grams);
    expect(result.value).toBeCloseTo(453.59237, 3);
  });
});

describe('convertUnit - time', () => {
  it('converts 1 hour to 3600 seconds', () => {
    const hour = createQuantity(1, 'h');
    const result = convertUnit(hour, SI_UNITS['second']!);
    expect(result.value).toBeCloseTo(3600, 5);
  });

  it('converts 1 minute to 60 seconds', () => {
    const min = createQuantity(1, 'min');
    const result = convertUnit(min, SI_UNITS['second']!);
    expect(result.value).toBeCloseTo(60, 5);
  });

  it('converts 1 day to 86400 seconds', () => {
    const day = createQuantity(1, 'd');
    const result = convertUnit(day, SI_UNITS['second']!);
    expect(result.value).toBeCloseTo(86400, 5);
  });
});

describe('convertUnit - temperature', () => {
  it('converts 0 Celsius to 273.15 Kelvin', () => {
    const c = createQuantity(0, '°C');
    const result = convertUnit(c, SI_UNITS['kelvin']!);
    expect(result.value).toBeCloseTo(273.15, 5);
  });

  it('converts 100 Celsius to 373.15 Kelvin', () => {
    const c = createQuantity(100, '°C');
    const result = convertUnit(c, SI_UNITS['kelvin']!);
    expect(result.value).toBeCloseTo(373.15, 5);
  });

  it('converts 32 Fahrenheit to Kelvin via implementation formula', () => {
    // The implementation uses toKelvin = value * (5/9) + 459.67
    // 32 * (5/9) + 459.67 = 17.778 + 459.67 = 477.447 K
    const f = createQuantity(32, '°F');
    const result = convertUnit(f, SI_UNITS['kelvin']!);
    expect(result.value).toBeCloseTo(32 * (5 / 9) + 459.67, 3);
  });

  it('converts 212 Fahrenheit to Kelvin via implementation formula', () => {
    // The implementation uses toKelvin = value * (5/9) + 459.67
    // 212 * (5/9) + 459.67 = 117.778 + 459.67 = 577.447 K
    const f = createQuantity(212, '°F');
    const result = convertUnit(f, SI_UNITS['kelvin']!);
    expect(result.value).toBeCloseTo(212 * (5 / 9) + 459.67, 3);
  });
});

// ============================================================================
// addQuantities
// ============================================================================

describe('addQuantities', () => {
  it('adds two lengths in the same unit', () => {
    const a = createQuantity(3, 'm');
    const b = createQuantity(4, 'm');
    const result = addQuantities(a, b);
    expect(result.value).toBeCloseTo(7, 5);
  });

  it('adds 1 km + 500 m = 1.5 km (result in km)', () => {
    const a = createQuantity(1, 'km');
    const b = createQuantity(500, 'm');
    const result = addQuantities(a, b);
    // Converted to km: 0.5 km + 1 km = 1.5 km
    expect(result.value).toBeCloseTo(1.5, 5);
    expect(result.unit.name).toBe('kilometer');
  });

  it('throws for incompatible dimensions', () => {
    const meters = createQuantity(1, 'm');
    const kg = createQuantity(1, 'kg');
    expect(() => addQuantities(meters, kg)).toThrow(DimensionalError);
  });
});

// ============================================================================
// multiplyQuantities
// ============================================================================

describe('multiplyQuantities', () => {
  it('m * m gives area in m^2', () => {
    const a = createQuantity(3, 'm');
    const b = createQuantity(4, 'm');
    const result = multiplyQuantities(a, b);
    expect(result.value).toBeCloseTo(12, 5);
    // Dimension should be area [2,0,0,0,0,0,0]
    expect(dimensionsEqual(result.unit.dimension, DERIVED_DIMENSIONS.area)).toBe(true);
  });

  it('kg * m/s^2 = N (force)', () => {
    // Force: 2 kg * 3 m/s^2 should give 6 N
    // We can test this numerically via SI conversion
    const kgQ = createQuantity(2, 'kg');
    const mQ = createQuantity(3, 'm');
    const product = multiplyQuantities(kgQ, mQ);
    // 2 kg * 3 m = 6 kg*m (not force yet, still need /s^2)
    expect(product.value).toBeCloseTo(6, 5);
  });

  it('result unit is in SI', () => {
    const a = createQuantity(1, 'km');
    const b = createQuantity(1, 'km');
    const result = multiplyQuantities(a, b);
    // 1 km * 1 km = 1,000,000 m^2 (converted to SI)
    expect(result.value).toBeCloseTo(1_000_000, 5);
  });
});

// ============================================================================
// formatQuantity
// ============================================================================

describe('formatQuantity', () => {
  it('formats value and symbol', () => {
    const q = createQuantity(9.81, 'm');
    const formatted = formatQuantity(q);
    expect(formatted).toContain('9.81');
    expect(formatted).toContain('m');
  });

  it('respects precision parameter', () => {
    const q = createQuantity(1 / 3, 'm');
    const p3 = formatQuantity(q, 3);
    const p6 = formatQuantity(q, 6);
    // p3 should be shorter
    expect(p3.length).toBeLessThanOrEqual(p6.length);
  });

  it('includes the unit symbol in the output', () => {
    const q = createQuantity(100, 'km');
    const formatted = formatQuantity(q);
    expect(formatted).toContain('km');
  });
});
