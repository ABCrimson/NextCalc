/**
 * Unit system with automatic conversions
 */

import type { Dimension } from './dimensions';
import {
  SI_BASE_DIMENSIONS,
  DERIVED_DIMENSIONS,
  dimensionsEqual,
  multiplyDimensions,
  DimensionalError,
} from './dimensions';

/**
 * Unit definition with dimension and conversion factor
 */
export interface UnitDefinition {
  readonly name: string;
  readonly symbol: string;
  readonly dimension: Dimension;
  readonly toSI: number; // Conversion factor to SI base unit
  readonly offset?: number; // For temperature conversions
}

/**
 * Quantity with value and unit
 */
export interface Quantity {
  readonly value: number;
  readonly unit: UnitDefinition;
}

/**
 * SI Base Units
 */
export const SI_UNITS: Record<string, UnitDefinition> = {
  meter: {
    name: 'meter',
    symbol: 'm',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 1,
  },
  kilogram: {
    name: 'kilogram',
    symbol: 'kg',
    dimension: SI_BASE_DIMENSIONS.mass,
    toSI: 1,
  },
  second: {
    name: 'second',
    symbol: 's',
    dimension: SI_BASE_DIMENSIONS.time,
    toSI: 1,
  },
  ampere: {
    name: 'ampere',
    symbol: 'A',
    dimension: SI_BASE_DIMENSIONS.current,
    toSI: 1,
  },
  kelvin: {
    name: 'kelvin',
    symbol: 'K',
    dimension: SI_BASE_DIMENSIONS.temperature,
    toSI: 1,
  },
  mole: {
    name: 'mole',
    symbol: 'mol',
    dimension: SI_BASE_DIMENSIONS.amount,
    toSI: 1,
  },
  candela: {
    name: 'candela',
    symbol: 'cd',
    dimension: SI_BASE_DIMENSIONS.luminousIntensity,
    toSI: 1,
  },
};

/**
 * Length units
 */
export const LENGTH_UNITS: Record<string, UnitDefinition> = {
  kilometer: {
    name: 'kilometer',
    symbol: 'km',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 1000,
  },
  centimeter: {
    name: 'centimeter',
    symbol: 'cm',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 0.01,
  },
  millimeter: {
    name: 'millimeter',
    symbol: 'mm',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 0.001,
  },
  mile: {
    name: 'mile',
    symbol: 'mi',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 1609.344,
  },
  foot: {
    name: 'foot',
    symbol: 'ft',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 0.3048,
  },
  inch: {
    name: 'inch',
    symbol: 'in',
    dimension: SI_BASE_DIMENSIONS.length,
    toSI: 0.0254,
  },
};

/**
 * Mass units
 */
export const MASS_UNITS: Record<string, UnitDefinition> = {
  gram: {
    name: 'gram',
    symbol: 'g',
    dimension: SI_BASE_DIMENSIONS.mass,
    toSI: 0.001,
  },
  pound: {
    name: 'pound',
    symbol: 'lb',
    dimension: SI_BASE_DIMENSIONS.mass,
    toSI: 0.45359237,
  },
  ounce: {
    name: 'ounce',
    symbol: 'oz',
    dimension: SI_BASE_DIMENSIONS.mass,
    toSI: 0.028349523125,
  },
};

/**
 * Time units
 */
export const TIME_UNITS: Record<string, UnitDefinition> = {
  minute: {
    name: 'minute',
    symbol: 'min',
    dimension: SI_BASE_DIMENSIONS.time,
    toSI: 60,
  },
  hour: {
    name: 'hour',
    symbol: 'h',
    dimension: SI_BASE_DIMENSIONS.time,
    toSI: 3600,
  },
  day: {
    name: 'day',
    symbol: 'd',
    dimension: SI_BASE_DIMENSIONS.time,
    toSI: 86400,
  },
  millisecond: {
    name: 'millisecond',
    symbol: 'ms',
    dimension: SI_BASE_DIMENSIONS.time,
    toSI: 0.001,
  },
};

/**
 * Temperature units (special handling for offsets)
 */
export const TEMPERATURE_UNITS: Record<string, UnitDefinition> = {
  celsius: {
    name: 'celsius',
    symbol: '°C',
    dimension: SI_BASE_DIMENSIONS.temperature,
    toSI: 1,
    offset: 273.15,
  },
  fahrenheit: {
    name: 'fahrenheit',
    symbol: '°F',
    dimension: SI_BASE_DIMENSIONS.temperature,
    toSI: 5 / 9,
    offset: 459.67,
  },
};

/**
 * Derived units
 */
export const DERIVED_UNITS: Record<string, UnitDefinition> = {
  // Force
  newton: {
    name: 'newton',
    symbol: 'N',
    dimension: DERIVED_DIMENSIONS.force,
    toSI: 1,
  },
  // Energy
  joule: {
    name: 'joule',
    symbol: 'J',
    dimension: DERIVED_DIMENSIONS.energy,
    toSI: 1,
  },
  // Power
  watt: {
    name: 'watt',
    symbol: 'W',
    dimension: DERIVED_DIMENSIONS.power,
    toSI: 1,
  },
  // Pressure
  pascal: {
    name: 'pascal',
    symbol: 'Pa',
    dimension: DERIVED_DIMENSIONS.pressure,
    toSI: 1,
  },
  // Frequency
  hertz: {
    name: 'hertz',
    symbol: 'Hz',
    dimension: DERIVED_DIMENSIONS.frequency,
    toSI: 1,
  },
};

/**
 * All units registry
 */
export const ALL_UNITS: Record<string, UnitDefinition> = {
  ...SI_UNITS,
  ...LENGTH_UNITS,
  ...MASS_UNITS,
  ...TIME_UNITS,
  ...TEMPERATURE_UNITS,
  ...DERIVED_UNITS,
};

/**
 * Create a quantity with value and unit
 */
export function createQuantity(value: number, unitSymbol: string): Quantity {
  const unit = findUnit(unitSymbol);
  if (!unit) {
    throw new Error(`Unknown unit: ${unitSymbol}`);
  }
  return { value, unit };
}

/**
 * Find unit by symbol or name
 */
export function findUnit(symbolOrName: string): UnitDefinition | null {
  // Try exact match on symbol
  for (const unit of Object.values(ALL_UNITS)) {
    if (unit.symbol === symbolOrName || unit.name === symbolOrName) {
      return unit;
    }
  }
  return null;
}

/**
 * Find SI unit by dimension
 * Returns the SI unit with toSI=1 that matches the dimension
 */
export function findUnitByDimension(dimension: Dimension): UnitDefinition | null {
  // First try to find an exact match with toSI = 1 (SI base unit)
  for (const unit of Object.values(ALL_UNITS)) {
    if (dimensionsEqual(unit.dimension, dimension) && unit.toSI === 1) {
      return unit;
    }
  }
  // Fall back to any unit with matching dimension
  for (const unit of Object.values(ALL_UNITS)) {
    if (dimensionsEqual(unit.dimension, dimension)) {
      return unit;
    }
  }
  return null;
}

/**
 * Create a composite unit from dimension
 * Generates a unit definition for derived dimensions like m²/s
 */
function createCompositeUnit(dimension: Dimension): UnitDefinition {
  const labels = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'];
  const positive: string[] = [];
  const negative: string[] = [];

  dimension.forEach((power, i) => {
    if (power === 0) return;
    const label = labels[i];
    if (!label) return;
    const abs = Math.abs(power);
    const formatted = abs === 1 ? label : `${label}^${abs}`;

    if (power > 0) {
      positive.push(formatted);
    } else {
      negative.push(formatted);
    }
  });

  let symbol: string;
  let name: string;

  if (positive.length === 0 && negative.length === 0) {
    symbol = '';
    name = 'dimensionless';
  } else if (negative.length === 0) {
    symbol = positive.join('·');
    name = symbol;
  } else if (positive.length === 0) {
    symbol = `1/${negative.join('·')}`;
    name = symbol;
  } else {
    symbol = `${positive.join('·')}/${negative.join('·')}`;
    name = symbol;
  }

  return {
    name,
    symbol,
    dimension,
    toSI: 1,
  };
}

/**
 * Convert quantity to different unit
 */
export function convertUnit(quantity: Quantity, targetUnit: UnitDefinition): Quantity {
  // Check dimensional compatibility
  if (!dimensionsEqual(quantity.unit.dimension, targetUnit.dimension)) {
    throw new DimensionalError(
      'Cannot convert between incompatible dimensions',
      targetUnit.dimension,
      quantity.unit.dimension
    );
  }

  // Handle temperature conversions with offset
  if (quantity.unit.offset !== undefined || targetUnit.offset !== undefined) {
    const toKelvin = quantity.value * quantity.unit.toSI + (quantity.unit.offset || 0);
    const value = (toKelvin - (targetUnit.offset || 0)) / targetUnit.toSI;
    return { value, unit: targetUnit };
  }

  // Standard conversion: value_SI = value * toSI
  const valueSI = quantity.value * quantity.unit.toSI;
  const value = valueSI / targetUnit.toSI;

  return { value, unit: targetUnit };
}

/**
 * Add two quantities (must have same dimension)
 */
export function addQuantities(a: Quantity, b: Quantity): Quantity {
  if (!dimensionsEqual(a.unit.dimension, b.unit.dimension)) {
    throw new DimensionalError(
      'Cannot add quantities with different dimensions',
      a.unit.dimension,
      b.unit.dimension
    );
  }

  // Convert b to a's unit, then add
  const bConverted = convertUnit(b, a.unit);
  return {
    value: a.value + bConverted.value,
    unit: a.unit,
  };
}

/**
 * Multiply two quantities
 * Result dimension is the product of input dimensions (exponents add)
 */
export function multiplyQuantities(a: Quantity, b: Quantity): Quantity {
  // Convert both to SI
  const aValueSI = a.value * a.unit.toSI;
  const bValueSI = b.value * b.unit.toSI;

  // Result value in SI units
  const resultValueSI = aValueSI * bValueSI;

  // Result dimension is product of dimensions (exponents add)
  const resultDimension = multiplyDimensions(a.unit.dimension, b.unit.dimension);

  // Try to find an existing SI unit for this dimension
  const matchingUnit = findUnitByDimension(resultDimension);

  // Use matching unit or create composite unit
  const resultUnit = matchingUnit || createCompositeUnit(resultDimension);

  return {
    value: resultValueSI,
    unit: resultUnit,
  };
}

/**
 * Format quantity as string
 */
export function formatQuantity(quantity: Quantity, precision = 6): string {
  const value = quantity.value.toPrecision(precision);
  return `${value} ${quantity.unit.symbol}`;
}
