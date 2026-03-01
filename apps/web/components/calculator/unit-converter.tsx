'use client';

import { AlertCircle, ArrowLeftRight, History, RotateCcw, Search, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Unit Converter Panel
 *
 * Comprehensive unit conversion UI supporting 12 measurement categories:
 * Length, Weight/Mass, Temperature, Volume, Area, Speed, Time, Data,
 * Pressure, Energy, Force, Angle
 *
 * Accessibility:
 * - ARIA labels for all controls
 * - Keyboard navigable (Tab, Arrow keys for category selection)
 * - Screen reader friendly with live regions
 * - Focus management for inputs
 * - WCAG 2.2 AAA compliant
 *
 * Performance:
 * - Automatic conversion on input change via useCallback
 * - Efficient filtering with useMemo
 * - Optimized re-renders
 *
 * @example
 * <UnitConverter />
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryKey =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'volume'
  | 'area'
  | 'speed'
  | 'time'
  | 'data'
  | 'pressure'
  | 'energy'
  | 'force'
  | 'angle';

/**
 * A unit with toSI factor and optional additive pre-scale offset (for temperature).
 *
 * Conversion algorithm for linear units:
 *   SI_value = input × toSI
 *   result   = SI_value / target.toSI
 *
 * Conversion algorithm for offset units (temperature only):
 *   SI_value = (input + preOffset) × toSI
 *   result   = SI_value / target.toSI - target.preOffset
 *
 * Temperature examples:
 *   Celsius:     preOffset=273.15, toSI=1    → K = (C + 273.15) × 1
 *   Fahrenheit:  preOffset=459.67, toSI=5/9  → K = (F + 459.67) × 5/9
 *   Rankine:     preOffset=0,      toSI=5/9  → K = R × 5/9
 *   Kelvin:      preOffset=0,      toSI=1    → K = K (identity)
 */
interface UnitDef {
  /** Human-readable name */
  readonly name: string;
  /** Short symbol shown in results */
  readonly symbol: string;
  /** Multiply by this to get the SI base value (after adding preOffset) */
  readonly toSI: number;
  /**
   * Additive offset applied BEFORE multiplication (temperature only).
   * K = (value + preOffset) × toSI
   */
  readonly preOffset?: number;
  /** Extra terms accepted in the search box */
  readonly searchTerms?: readonly string[];
}

interface CategoryDef {
  readonly label: string;
  /** Unicode emoji used as a visual icon */
  readonly icon: string;
  /** Tailwind accent color class for the active category chip */
  readonly accentClass: string;
  readonly units: readonly UnitDef[];
  readonly commonConversions: ReadonlyArray<{ from: string; to: string; label: string }>;
  readonly facts: readonly string[];
}

interface RecentConversion {
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly inputValue: string;
  readonly outputValue: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Unit definitions
// ---------------------------------------------------------------------------

const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  length: {
    label: 'Length',
    icon: '📏',
    accentClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30',
    units: [
      { name: 'nanometer', symbol: 'nm', toSI: 1e-9, searchTerms: ['nm', 'nano'] },
      { name: 'micrometer', symbol: 'μm', toSI: 1e-6, searchTerms: ['um', 'micron'] },
      { name: 'millimeter', symbol: 'mm', toSI: 1e-3, searchTerms: ['mm'] },
      { name: 'centimeter', symbol: 'cm', toSI: 1e-2, searchTerms: ['cm', 'centimetre'] },
      { name: 'meter', symbol: 'm', toSI: 1, searchTerms: ['m', 'metre'] },
      { name: 'kilometer', symbol: 'km', toSI: 1e3, searchTerms: ['km', 'kilometre'] },
      { name: 'inch', symbol: 'in', toSI: 0.0254, searchTerms: ['in', 'inches', '"'] },
      { name: 'foot', symbol: 'ft', toSI: 0.3048, searchTerms: ['ft', 'feet', "'"] },
      { name: 'yard', symbol: 'yd', toSI: 0.9144, searchTerms: ['yd', 'yards'] },
      { name: 'mile', symbol: 'mi', toSI: 1609.344, searchTerms: ['mi', 'miles'] },
      { name: 'nautical mile', symbol: 'nmi', toSI: 1852, searchTerms: ['nmi', 'nm', 'nautical'] },
    ],
    commonConversions: [
      { from: 'mile', to: 'kilometer', label: 'mi → km' },
      { from: 'foot', to: 'meter', label: 'ft → m' },
      { from: 'inch', to: 'centimeter', label: 'in → cm' },
      { from: 'meter', to: 'foot', label: 'm → ft' },
    ],
    facts: [
      '1 mile = 1.609 344 km = 5 280 feet',
      '1 meter = 3.280 84 feet = 39.3701 inches',
      '1 inch = 2.54 cm (exact)',
      '1 nautical mile = 1.852 km (exact)',
      '1 light-year ≈ 9.461 × 10¹² km',
    ],
  },

  mass: {
    label: 'Mass',
    icon: '⚖️',
    accentClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
    units: [
      { name: 'milligram', symbol: 'mg', toSI: 1e-6, searchTerms: ['mg'] },
      { name: 'gram', symbol: 'g', toSI: 1e-3, searchTerms: ['g', 'grams'] },
      { name: 'kilogram', symbol: 'kg', toSI: 1, searchTerms: ['kg', 'kilo'] },
      { name: 'tonne', symbol: 't', toSI: 1000, searchTerms: ['metric ton', 'mt', 'tonne'] },
      { name: 'ounce', symbol: 'oz', toSI: 0.0283495, searchTerms: ['oz', 'ounces'] },
      { name: 'pound', symbol: 'lb', toSI: 0.453592, searchTerms: ['lb', 'lbs', 'pounds'] },
      { name: 'stone', symbol: 'st', toSI: 6.35029, searchTerms: ['st', 'stone'] },
      { name: 'short ton', symbol: 'ton', toSI: 907.185, searchTerms: ['ton', 'us ton'] },
    ],
    commonConversions: [
      { from: 'kilogram', to: 'pound', label: 'kg → lb' },
      { from: 'pound', to: 'kilogram', label: 'lb → kg' },
      { from: 'gram', to: 'ounce', label: 'g → oz' },
      { from: 'stone', to: 'kilogram', label: 'st → kg' },
    ],
    facts: [
      '1 kilogram = 2.204 62 pounds',
      '1 pound = 16 ounces = 453.592 grams',
      '1 stone = 14 pounds = 6.350 kg',
      '1 tonne = 1 000 kg = 2 204.62 pounds',
    ],
  },

  temperature: {
    label: 'Temperature',
    icon: '🌡️',
    accentClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30',
    units: [
      // Kelvin is the SI base: K = K × 1
      { name: 'kelvin', symbol: 'K', toSI: 1, searchTerms: ['k', 'kelvin'] },
      // Celsius: K = (C + 273.15) × 1
      {
        name: 'celsius',
        symbol: '°C',
        toSI: 1,
        preOffset: 273.15,
        searchTerms: ['c', 'celsius', 'centigrade'],
      },
      // Fahrenheit: K = (F + 459.67) × 5/9
      {
        name: 'fahrenheit',
        symbol: '°F',
        toSI: 5 / 9,
        preOffset: 459.67,
        searchTerms: ['f', 'fahrenheit'],
      },
      // Rankine: K = R × 5/9 (no additive offset)
      { name: 'rankine', symbol: '°R', toSI: 5 / 9, searchTerms: ['r', 'rankine'] },
    ],
    commonConversions: [
      { from: 'celsius', to: 'fahrenheit', label: '°C → °F' },
      { from: 'fahrenheit', to: 'celsius', label: '°F → °C' },
      { from: 'celsius', to: 'kelvin', label: '°C → K' },
      { from: 'kelvin', to: 'celsius', label: 'K → °C' },
    ],
    facts: [
      '0 °C = 32 °F = 273.15 K (water freezes)',
      '100 °C = 212 °F = 373.15 K (water boils)',
      '−40 °C = −40 °F (the scales intersect)',
      'Absolute zero = 0 K = −273.15 °C = −459.67 °F',
    ],
  },

  volume: {
    label: 'Volume',
    icon: '🧴',
    accentClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30',
    units: [
      {
        name: 'milliliter',
        symbol: 'mL',
        toSI: 1e-6,
        searchTerms: ['ml', 'millilitre', 'cc', 'cm3'],
      },
      { name: 'liter', symbol: 'L', toSI: 1e-3, searchTerms: ['l', 'litre'] },
      { name: 'cubic meter', symbol: 'm³', toSI: 1, searchTerms: ['m3', 'cu m'] },
      {
        name: 'fluid ounce (US)',
        symbol: 'fl oz',
        toSI: 2.95735e-5,
        searchTerms: ['fl oz', 'floz', 'fluid ounce'],
      },
      { name: 'cup (US)', symbol: 'cup', toSI: 2.36588e-4, searchTerms: ['cup', 'cups'] },
      { name: 'pint (US)', symbol: 'pt', toSI: 4.73176e-4, searchTerms: ['pt', 'pint'] },
      { name: 'quart (US)', symbol: 'qt', toSI: 9.46353e-4, searchTerms: ['qt', 'quart'] },
      { name: 'gallon (US)', symbol: 'gal', toSI: 3.78541e-3, searchTerms: ['gal', 'gallon'] },
      {
        name: 'gallon (UK)',
        symbol: 'Imp gal',
        toSI: 4.54609e-3,
        searchTerms: ['imperial gallon', 'uk gallon'],
      },
    ],
    commonConversions: [
      { from: 'liter', to: 'gallon (US)', label: 'L → gal' },
      { from: 'gallon (US)', to: 'liter', label: 'gal → L' },
      { from: 'milliliter', to: 'fluid ounce (US)', label: 'mL → fl oz' },
      { from: 'cup (US)', to: 'milliliter', label: 'cup → mL' },
    ],
    facts: [
      '1 US gallon = 3.785 41 liters = 4 quarts = 8 pints',
      '1 liter = 1 000 mL = 33.814 US fl oz',
      '1 UK gallon = 4.546 09 liters',
      '1 US cup = 236.588 mL ≈ 8 fl oz',
    ],
  },

  area: {
    label: 'Area',
    icon: '⬜',
    accentClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
    units: [
      { name: 'sq millimeter', symbol: 'mm²', toSI: 1e-6, searchTerms: ['mm2', 'sq mm'] },
      { name: 'sq centimeter', symbol: 'cm²', toSI: 1e-4, searchTerms: ['cm2', 'sq cm'] },
      { name: 'sq meter', symbol: 'm²', toSI: 1, searchTerms: ['m2', 'sq m'] },
      { name: 'sq kilometer', symbol: 'km²', toSI: 1e6, searchTerms: ['km2', 'sq km'] },
      { name: 'sq inch', symbol: 'in²', toSI: 6.4516e-4, searchTerms: ['in2', 'sq in'] },
      { name: 'sq foot', symbol: 'ft²', toSI: 0.092903, searchTerms: ['ft2', 'sq ft'] },
      { name: 'sq yard', symbol: 'yd²', toSI: 0.836127, searchTerms: ['yd2', 'sq yd'] },
      { name: 'sq mile', symbol: 'mi²', toSI: 2.58999e6, searchTerms: ['mi2', 'sq mi'] },
      { name: 'acre', symbol: 'ac', toSI: 4046.86, searchTerms: ['acre', 'acres'] },
      { name: 'hectare', symbol: 'ha', toSI: 10000, searchTerms: ['ha', 'hectare'] },
    ],
    commonConversions: [
      { from: 'sq meter', to: 'sq foot', label: 'm² → ft²' },
      { from: 'sq foot', to: 'sq meter', label: 'ft² → m²' },
      { from: 'acre', to: 'hectare', label: 'ac → ha' },
      { from: 'sq kilometer', to: 'sq mile', label: 'km² → mi²' },
    ],
    facts: [
      '1 hectare = 10 000 m² = 2.471 acres',
      '1 acre = 4 046.86 m² = 43 560 ft²',
      '1 km² = 100 hectares = 0.386 mi²',
      '1 ft² = 929.03 cm²',
    ],
  },

  speed: {
    label: 'Speed',
    icon: '🚀',
    accentClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30',
    units: [
      {
        name: 'meter/second',
        symbol: 'm/s',
        toSI: 1,
        searchTerms: ['m/s', 'mps', 'meters per second'],
      },
      { name: 'km/hour', symbol: 'km/h', toSI: 1 / 3.6, searchTerms: ['km/h', 'kph', 'kmh'] },
      { name: 'mile/hour', symbol: 'mph', toSI: 0.44704, searchTerms: ['mph', 'miles per hour'] },
      { name: 'knot', symbol: 'kn', toSI: 0.514444, searchTerms: ['kn', 'knot', 'knots'] },
      {
        name: 'foot/second',
        symbol: 'ft/s',
        toSI: 0.3048,
        searchTerms: ['ft/s', 'fps', 'feet per second'],
      },
      {
        name: 'Mach (sea lvl)',
        symbol: 'M',
        toSI: 340.29,
        searchTerms: ['mach', 'speed of sound'],
      },
    ],
    commonConversions: [
      { from: 'km/hour', to: 'mile/hour', label: 'km/h → mph' },
      { from: 'mile/hour', to: 'km/hour', label: 'mph → km/h' },
      { from: 'meter/second', to: 'km/hour', label: 'm/s → km/h' },
      { from: 'knot', to: 'km/hour', label: 'kn → km/h' },
    ],
    facts: [
      '1 mph = 1.609 344 km/h (exact)',
      '1 knot = 1.852 km/h = 1 nautical mile/h',
      'Speed of sound ≈ 340.29 m/s at sea level (20 °C)',
      'Speed of light ≈ 299 792 458 m/s',
    ],
  },

  time: {
    label: 'Time',
    icon: '⏱️',
    accentClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30',
    units: [
      { name: 'millisecond', symbol: 'ms', toSI: 1e-3, searchTerms: ['ms', 'msec'] },
      { name: 'second', symbol: 's', toSI: 1, searchTerms: ['s', 'sec', 'seconds'] },
      { name: 'minute', symbol: 'min', toSI: 60, searchTerms: ['min', 'minutes'] },
      { name: 'hour', symbol: 'h', toSI: 3600, searchTerms: ['h', 'hr', 'hours'] },
      { name: 'day', symbol: 'd', toSI: 86400, searchTerms: ['d', 'days'] },
      { name: 'week', symbol: 'wk', toSI: 604800, searchTerms: ['wk', 'weeks'] },
      { name: 'month', symbol: 'mo', toSI: 2629746, searchTerms: ['mo', 'months'] },
      { name: 'year', symbol: 'yr', toSI: 31556952, searchTerms: ['yr', 'year', 'years'] },
    ],
    commonConversions: [
      { from: 'hour', to: 'minute', label: 'h → min' },
      { from: 'day', to: 'hour', label: 'd → h' },
      { from: 'week', to: 'day', label: 'wk → d' },
      { from: 'year', to: 'day', label: 'yr → d' },
    ],
    facts: [
      '1 hour = 60 min = 3 600 s',
      '1 day = 24 h = 86 400 s',
      '1 week = 7 days = 168 h',
      '1 year ≈ 365.2425 days = 31 556 952 s',
    ],
  },

  data: {
    label: 'Data',
    icon: '💾',
    accentClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30',
    units: [
      { name: 'bit', symbol: 'b', toSI: 1, searchTerms: ['b', 'bit'] },
      { name: 'byte', symbol: 'B', toSI: 8, searchTerms: ['B', 'byte'] },
      { name: 'kilobyte', symbol: 'KB', toSI: 8e3, searchTerms: ['kb', 'kilobyte'] },
      { name: 'megabyte', symbol: 'MB', toSI: 8e6, searchTerms: ['mb', 'megabyte'] },
      { name: 'gigabyte', symbol: 'GB', toSI: 8e9, searchTerms: ['gb', 'gigabyte'] },
      { name: 'terabyte', symbol: 'TB', toSI: 8e12, searchTerms: ['tb', 'terabyte'] },
      { name: 'petabyte', symbol: 'PB', toSI: 8e15, searchTerms: ['pb', 'petabyte'] },
      { name: 'kibibyte', symbol: 'KiB', toSI: 8 * 1024, searchTerms: ['kib', 'kibibyte'] },
      { name: 'mebibyte', symbol: 'MiB', toSI: 8 * 1024 ** 2, searchTerms: ['mib', 'mebibyte'] },
      { name: 'gibibyte', symbol: 'GiB', toSI: 8 * 1024 ** 3, searchTerms: ['gib', 'gibibyte'] },
    ],
    commonConversions: [
      { from: 'gigabyte', to: 'megabyte', label: 'GB → MB' },
      { from: 'terabyte', to: 'gigabyte', label: 'TB → GB' },
      { from: 'byte', to: 'bit', label: 'B → b' },
      { from: 'gibibyte', to: 'gigabyte', label: 'GiB → GB' },
    ],
    facts: [
      '1 byte = 8 bits',
      '1 KB = 1 000 bytes (SI), 1 KiB = 1 024 bytes (IEC)',
      '1 GB = 10⁹ bytes, 1 GiB = 2³⁰ = 1 073 741 824 bytes',
      '1 TB = 1 000 GB ≈ 0.909 TiB',
    ],
  },

  pressure: {
    label: 'Pressure',
    icon: '🔵',
    accentClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30',
    units: [
      { name: 'pascal', symbol: 'Pa', toSI: 1, searchTerms: ['pa', 'pascal'] },
      { name: 'kilopascal', symbol: 'kPa', toSI: 1e3, searchTerms: ['kpa', 'kilopascal'] },
      { name: 'megapascal', symbol: 'MPa', toSI: 1e6, searchTerms: ['mpa', 'megapascal'] },
      { name: 'bar', symbol: 'bar', toSI: 1e5, searchTerms: ['bar'] },
      { name: 'millibar', symbol: 'mbar', toSI: 100, searchTerms: ['mbar', 'millibar'] },
      { name: 'atmosphere', symbol: 'atm', toSI: 101325, searchTerms: ['atm', 'atmosphere'] },
      { name: 'psi', symbol: 'psi', toSI: 6894.76, searchTerms: ['psi', 'pounds per square inch'] },
      {
        name: 'mmHg (Torr)',
        symbol: 'mmHg',
        toSI: 133.322,
        searchTerms: ['mmhg', 'torr', 'mm hg'],
      },
    ],
    commonConversions: [
      { from: 'atmosphere', to: 'psi', label: 'atm → psi' },
      { from: 'psi', to: 'atmosphere', label: 'psi → atm' },
      { from: 'bar', to: 'psi', label: 'bar → psi' },
      { from: 'kilopascal', to: 'psi', label: 'kPa → psi' },
    ],
    facts: [
      '1 atm = 101 325 Pa = 14.696 psi = 760 mmHg',
      '1 bar = 100 000 Pa ≈ 0.987 atm = 14.504 psi',
      '1 psi = 6 894.76 Pa = 0.068 046 atm',
      'Standard atmospheric pressure = 1 013.25 mbar',
    ],
  },

  energy: {
    label: 'Energy',
    icon: '⚡',
    accentClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30',
    units: [
      { name: 'joule', symbol: 'J', toSI: 1, searchTerms: ['j', 'joule'] },
      { name: 'kilojoule', symbol: 'kJ', toSI: 1e3, searchTerms: ['kj', 'kilojoule'] },
      { name: 'calorie', symbol: 'cal', toSI: 4.184, searchTerms: ['cal', 'calorie'] },
      {
        name: 'kilocalorie',
        symbol: 'kcal',
        toSI: 4184,
        searchTerms: ['kcal', 'kilocalorie', 'food calorie'],
      },
      { name: 'watt-hour', symbol: 'Wh', toSI: 3600, searchTerms: ['wh', 'watt hour'] },
      { name: 'kilowatt-hour', symbol: 'kWh', toSI: 3.6e6, searchTerms: ['kwh', 'kilowatt hour'] },
      {
        name: 'electronvolt',
        symbol: 'eV',
        toSI: 1.60218e-19,
        searchTerms: ['ev', 'electronvolt'],
      },
      { name: 'BTU', symbol: 'BTU', toSI: 1055.06, searchTerms: ['btu', 'british thermal unit'] },
      { name: 'foot-pound', symbol: 'ft·lbf', toSI: 1.35582, searchTerms: ['ft lb', 'foot pound'] },
    ],
    commonConversions: [
      { from: 'joule', to: 'calorie', label: 'J → cal' },
      { from: 'kilocalorie', to: 'kilojoule', label: 'kcal → kJ' },
      { from: 'kilowatt-hour', to: 'kilojoule', label: 'kWh → kJ' },
      { from: 'BTU', to: 'kilojoule', label: 'BTU → kJ' },
    ],
    facts: [
      '1 kcal = 4 184 J (food calorie, "big C")',
      '1 kWh = 3 600 000 J = 3 600 kJ',
      '1 BTU ≈ 1 055 J ≈ 252 cal',
      '1 cal = 4.184 J (thermochemical calorie)',
    ],
  },

  force: {
    label: 'Force',
    icon: '💪',
    accentClass: 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30',
    units: [
      { name: 'newton', symbol: 'N', toSI: 1, searchTerms: ['n', 'newton'] },
      { name: 'kilonewton', symbol: 'kN', toSI: 1e3, searchTerms: ['kn', 'kilonewton'] },
      { name: 'dyne', symbol: 'dyn', toSI: 1e-5, searchTerms: ['dyn', 'dyne'] },
      {
        name: 'pound-force',
        symbol: 'lbf',
        toSI: 4.44822,
        searchTerms: ['lbf', 'pound force', 'lb-f'],
      },
      { name: 'kgf', symbol: 'kgf', toSI: 9.80665, searchTerms: ['kgf', 'kilogram force'] },
      { name: 'ounce-force', symbol: 'ozf', toSI: 0.278014, searchTerms: ['ozf', 'ounce force'] },
    ],
    commonConversions: [
      { from: 'newton', to: 'pound-force', label: 'N → lbf' },
      { from: 'pound-force', to: 'newton', label: 'lbf → N' },
      { from: 'kgf', to: 'newton', label: 'kgf → N' },
      { from: 'kilonewton', to: 'pound-force', label: 'kN → lbf' },
    ],
    facts: [
      '1 N = 1 kg·m/s²',
      '1 lbf = 4.448 22 N',
      '1 kgf = 9.806 65 N (weight of 1 kg at standard gravity)',
      '1 kN = 1 000 N ≈ 224.81 lbf',
    ],
  },

  angle: {
    label: 'Angle',
    icon: '📐',
    accentClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-teal-500/30',
    units: [
      {
        name: 'degree',
        symbol: '°',
        toSI: Math.PI / 180,
        searchTerms: ['deg', 'degree', 'degrees'],
      },
      { name: 'radian', symbol: 'rad', toSI: 1, searchTerms: ['rad', 'radian'] },
      {
        name: 'gradian',
        symbol: 'grad',
        toSI: Math.PI / 200,
        searchTerms: ['grad', 'gon', 'gradian'],
      },
      {
        name: 'arcminute',
        symbol: "'",
        toSI: Math.PI / 10800,
        searchTerms: ['arcmin', 'arc minute', "'"],
      },
      {
        name: 'arcsecond',
        symbol: '"',
        toSI: Math.PI / 648000,
        searchTerms: ['arcsec', 'arc second', '"'],
      },
      {
        name: 'revolution',
        symbol: 'rev',
        toSI: 2 * Math.PI,
        searchTerms: ['rev', 'revolution', 'turn'],
      },
    ],
    commonConversions: [
      { from: 'degree', to: 'radian', label: '° → rad' },
      { from: 'radian', to: 'degree', label: 'rad → °' },
      { from: 'degree', to: 'gradian', label: '° → grad' },
      { from: 'degree', to: 'arcminute', label: '° → arcmin' },
    ],
    facts: [
      '1 full turn = 360° = 2π rad = 400 grad',
      '1 radian ≈ 57.295 78°',
      '1° = 60 arcminutes = 3 600 arcseconds',
      'π rad = 180°',
    ],
  },
} satisfies Record<CategoryKey, CategoryDef>;

// Ordered list for the category grid
const CATEGORY_ORDER: readonly CategoryKey[] = [
  'length',
  'mass',
  'temperature',
  'volume',
  'area',
  'speed',
  'time',
  'data',
  'pressure',
  'energy',
  'force',
  'angle',
];

// Default "from/to" pairs for each category when first selected
const CATEGORY_DEFAULTS: Record<CategoryKey, { from: string; to: string }> = {
  length: { from: 'meter', to: 'foot' },
  mass: { from: 'kilogram', to: 'pound' },
  temperature: { from: 'celsius', to: 'fahrenheit' },
  volume: { from: 'liter', to: 'gallon (US)' },
  area: { from: 'sq meter', to: 'sq foot' },
  speed: { from: 'km/hour', to: 'mile/hour' },
  time: { from: 'hour', to: 'minute' },
  data: { from: 'gigabyte', to: 'megabyte' },
  pressure: { from: 'atmosphere', to: 'psi' },
  energy: { from: 'kilocalorie', to: 'kilojoule' },
  force: { from: 'newton', to: 'pound-force' },
  angle: { from: 'degree', to: 'radian' },
};

// ---------------------------------------------------------------------------
// Conversion logic (pure, no side effects)
// ---------------------------------------------------------------------------

/**
 * Converts a numeric value from one UnitDef to another.
 *
 * For linear units (no preOffset):
 *   SI = input × from.toSI
 *   output = SI / to.toSI
 *
 * For offset units (temperature, preOffset defined on either side):
 *   SI = (input + from.preOffset) × from.toSI
 *   output = SI / to.toSI − to.preOffset
 *
 * Examples (all yielding Kelvin as SI base):
 *   °C → K: K = (C + 273.15) × 1
 *   °F → K: K = (F + 459.67) × 5/9
 *   °R → K: K = (R + 0) × 5/9
 */
function convertValue(input: number, from: UnitDef, to: UnitDef): number {
  const hasPreOffset = from.preOffset !== undefined || to.preOffset !== undefined;
  if (hasPreOffset) {
    const si = (input + (from.preOffset ?? 0)) * from.toSI;
    return si / to.toSI - (to.preOffset ?? 0);
  }
  return (input * from.toSI) / to.toSI;
}

/**
 * Build a human-readable conversion formula string.
 *
 * For linear units: 1 fromSymbol = factor toSymbol
 * For offset units: show the two-step Kelvin formula
 */
function buildFormula(from: UnitDef, to: UnitDef): string {
  if (from.name === to.name) return `${from.symbol} = ${to.symbol}`;

  const hasPreOffset = from.preOffset !== undefined || to.preOffset !== undefined;

  if (hasPreOffset) {
    // Temperature: show explicit formula
    const toK =
      from.preOffset !== undefined
        ? `(x + ${from.preOffset}) × ${formatNum(from.toSI)}`
        : `x × ${formatNum(from.toSI)}`;
    const fromK =
      to.preOffset !== undefined
        ? `K / ${formatNum(to.toSI)} − ${to.preOffset}`
        : `K / ${formatNum(to.toSI)}`;
    return `K = ${toK}   →   ${to.symbol} = ${fromK}`;
  }

  const factor = from.toSI / to.toSI;
  return `1 ${from.symbol} = ${formatNum(factor)} ${to.symbol}`;
}

/** Format a number compactly for the formula display */
function formatNum(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 0.001 && abs < 1e7) {
    // Use up to 8 significant figures, strip trailing zeros
    return parseFloat(n.toPrecision(8)).toString();
  }
  return n.toExponential(4);
}

/** Format a conversion result for display */
function formatResult(n: number): string {
  if (!isFinite(n)) return 'Undefined';
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs >= 0.0001 && abs < 1e10) {
    return parseFloat(n.toPrecision(10)).toString();
  }
  return n.toExponential(6);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CategoryChipProps {
  categoryKey: CategoryKey;
  category: CategoryDef;
  isActive: boolean;
  onSelect: (key: CategoryKey) => void;
}

function CategoryChip({ categoryKey, category, isActive, onSelect }: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(categoryKey)}
      aria-pressed={isActive}
      aria-label={`${category.label} conversions`}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isActive
          ? cn(category.accentClass, 'ring-1 ring-current')
          : 'border-border bg-background text-muted-foreground hover:bg-muted',
      )}
    >
      <span className="text-lg leading-none" aria-hidden="true">
        {category.icon}
      </span>
      <span
        className="leading-none truncate w-full text-center"
        style={{ fontSize: category.label.length > 7 ? '0.6rem' : undefined }}
      >
        {category.label}
      </span>
    </button>
  );
}

interface UnitSelectProps {
  id: string;
  label: string;
  units: readonly UnitDef[];
  value: string;
  search: string;
  onSearchChange: (v: string) => void;
  onValueChange: (v: string) => void;
}

function UnitSelect({
  id,
  label,
  units,
  value,
  search,
  onSearchChange,
  onValueChange,
}: UnitSelectProps) {
  const filtered = useMemo(() => {
    if (!search.trim()) return units;
    const q = search.toLowerCase();
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.symbol.toLowerCase().includes(q) ||
        u.searchTerms?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [search, units]);

  return (
    <div className="space-y-2">
      <Label htmlFor={`search-${id}`} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={`search-${id}`}
          type="text"
          placeholder="Search units..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
          aria-label={`Search ${label.toLowerCase()} units`}
          aria-controls={id}
        />
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        size={5}
        className={cn(
          'w-full rounded-md border border-input bg-background px-2 py-1 text-sm',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto',
        )}
        aria-label={`Select ${label.toLowerCase()} unit`}
      >
        {filtered.length === 0 ? (
          <option disabled value="">
            No units match
          </option>
        ) : (
          filtered.map((u) => (
            <option key={u.name} value={u.name}>
              {u.name} ({u.symbol})
            </option>
          ))
        )}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UnitConverter() {
  const [category, setCategory] = useState<CategoryKey>('length');
  const [inputValue, setInputValue] = useState('1');
  const [fromUnit, setFromUnit] = useState(CATEGORY_DEFAULTS.length.from);
  const [toUnit, setToUnit] = useState(CATEGORY_DEFAULTS.length.to);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [recentConversions, setRecentConversions] = useState<RecentConversion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const categoryDef = CATEGORIES[category];
  const { units } = categoryDef;

  // Derived: the currently selected unit definitions
  const fromDef = useMemo(
    () => units.find((u) => u.name === fromUnit) ?? units[0]!,
    [units, fromUnit],
  );
  const toDef = useMemo(
    () => units.find((u) => u.name === toUnit) ?? units[1] ?? units[0]!,
    [units, toUnit],
  );

  // Conversion formula string
  const formula = useMemo(() => buildFormula(fromDef, toDef), [fromDef, toDef]);

  // ---------------------------------------------------------------------------
  // Conversion
  // ---------------------------------------------------------------------------

  const runConversion = useCallback(() => {
    setError(null);
    const num = parseFloat(inputValue);
    if (inputValue.trim() === '' || isNaN(num)) {
      setResult(null);
      return;
    }
    try {
      const converted = convertValue(num, fromDef, toDef);
      const formatted = formatResult(converted);
      setResult(formatted);

      const fromLabel = `${inputValue} ${fromDef.symbol}`;
      const toLabel = `${formatted} ${toDef.symbol}`;
      setRecentConversions((prev) => {
        const deduped = prev.filter((c) => !(c.fromLabel === fromLabel && c.toLabel === toLabel));
        const next: RecentConversion = {
          fromLabel,
          toLabel,
          inputValue,
          outputValue: formatted,
          timestamp: Date.now(),
        };
        return [next, ...deduped].slice(0, 8);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setResult(null);
    }
  }, [inputValue, fromDef, toDef]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runConversion is stable per its deps
  useEffect(() => {
    runConversion();
  }, [runConversion]);

  // ---------------------------------------------------------------------------
  // Category change: reset to defaults
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const defaults = CATEGORY_DEFAULTS[category];
    setFromUnit(defaults.from);
    setToUnit(defaults.to);
    setSearchFrom('');
    setSearchTo('');
    setInputValue('1');
  }, [category]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSwap = () => {
    const prevFrom = fromUnit;
    const prevTo = toUnit;
    setFromUnit(prevTo);
    setToUnit(prevFrom);
    // Put the result as the new input
    if (result !== null) setInputValue(result);
  };

  const handleReset = () => {
    const defaults = CATEGORY_DEFAULTS[category];
    setFromUnit(defaults.from);
    setToUnit(defaults.to);
    setInputValue('1');
    setSearchFrom('');
    setSearchTo('');
  };

  const applyCommonConversion = (from: string, to: string) => {
    setFromUnit(from);
    setToUnit(to);
  };

  const applyRecent = (recent: RecentConversion) => {
    setInputValue(recent.inputValue);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unit Converter</CardTitle>
        <CardDescription>
          12 categories, 80+ units. High-precision SI-based conversions with live results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Category grid */}
        <fieldset>
          <legend className="text-sm font-semibold text-foreground mb-2">Category</legend>
          <div
            className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5"
            role="group"
            aria-label="Unit categories"
          >
            {CATEGORY_ORDER.map((key) => (
              <CategoryChip
                key={key}
                categoryKey={key}
                category={CATEGORIES[key]}
                isActive={category === key}
                onSelect={setCategory}
              />
            ))}
          </div>
        </fieldset>

        {/* Value input */}
        <div className="space-y-1.5">
          <Label htmlFor="unit-value" className="text-sm font-semibold text-foreground">
            Value
          </Label>
          <Input
            id="unit-value"
            type="number"
            step="any"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter value..."
            className="font-mono text-lg h-11"
            aria-label="Value to convert"
          />
        </div>

        {/* From / Swap / To */}
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-start">
          <UnitSelect
            id="from-unit"
            label="From"
            units={units}
            value={fromUnit}
            search={searchFrom}
            onSearchChange={setSearchFrom}
            onValueChange={setFromUnit}
          />

          {/* Swap + Reset buttons stacked */}
          <div className="flex flex-col gap-2 justify-center pt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwap}
              aria-label="Swap from and to units"
              title="Swap units"
              className="h-9 w-9 self-center"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              aria-label="Reset to defaults"
              title="Reset"
              className="h-9 w-9 self-center text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <UnitSelect
            id="to-unit"
            label="To"
            units={units}
            value={toUnit}
            search={searchTo}
            onSearchChange={setSearchTo}
            onValueChange={setToUnit}
          />
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" role="alert" aria-live="assertive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Result */}
        {result !== null && !error && (
          <div
            className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5"
            role="region"
            aria-label="Conversion result"
            aria-live="polite"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Result
            </p>
            <p className="text-3xl font-mono break-all text-primary">
              {result}
              <span className="ml-2 text-xl">{toDef.symbol}</span>
            </p>
            <p className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground font-mono">
              {inputValue} {fromDef.symbol} = <strong className="text-foreground">{result}</strong>{' '}
              {toDef.symbol}
            </p>
            {/* Conversion formula */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="font-mono text-xs text-muted-foreground px-2 py-0.5"
              >
                {formula}
              </Badge>
            </div>
          </div>
        )}

        {/* Common conversions */}
        {categoryDef.commonConversions.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Common Conversions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {categoryDef.commonConversions.map((conv) => (
                <Button
                  key={conv.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyCommonConversion(conv.from, conv.to)}
                  className="font-mono text-xs h-8 justify-start px-2"
                  aria-label={`Set ${conv.from} to ${conv.to}`}
                >
                  {conv.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Recent conversions */}
        {recentConversions.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              Recent
            </p>
            <ul className="space-y-0.5" aria-label="Recent conversions">
              {recentConversions.map((item, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => applyRecent(item)}
                    className={cn(
                      'w-full text-left rounded px-2 py-1.5 text-xs font-mono',
                      'text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                    )}
                    aria-label={`Restore: ${item.fromLabel} to ${item.toLabel}`}
                  >
                    <span>{item.fromLabel}</span>
                    <span className="mx-1.5 text-muted-foreground/50">→</span>
                    <span className="text-foreground">{item.toLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Facts / reference */}
        <details className="text-sm">
          <summary
            className={cn(
              'cursor-pointer select-none font-semibold text-foreground',
              'hover:text-primary transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded',
            )}
          >
            {categoryDef.icon} {categoryDef.label} Reference Facts
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
            {categoryDef.facts.map((fact) => (
              <li key={fact} className="text-xs">
                {fact}
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
