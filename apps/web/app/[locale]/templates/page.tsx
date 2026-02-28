'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FlaskConical,
  GraduationCap,
  type LucideIcon,
  Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/**
 * A single numeric input field for a template.
 */
interface TemplateField {
  /** Identifier used as `name` / `id` attribute */
  key: string;
  /** Human-readable label */
  label: string;
  /** Placeholder text, e.g. "e.g. 1000" */
  placeholder: string;
  /** Optional unit suffix shown after the input, e.g. "%" */
  unit?: string;
}

/**
 * Typed getter for pre-validated numeric field values.
 * Each call returns a finite `number` (never `undefined`) because the caller
 * in `handleCalculate` validates all fields before invoking `calculate`.
 * This type avoids `number | undefined` widening caused by
 * `noUncheckedIndexedAccess` when using `Record<string, number>` directly.
 */
type FieldGetter = (key: string) => number;

/**
 * A calculation template definition.
 */
interface Template {
  id: string;
  /** Display name */
  title: string;
  /** Short description of what it computes */
  description: string;
  /** The formula in symbolic notation, rendered as-is */
  formula: string;
  /** Input fields required by the template */
  fields: TemplateField[];
  /**
   * Pure calculation function. `get(key)` returns the pre-validated numeric
   * value for a field (always a finite number at call time). Throws an Error
   * with a human-readable message for domain-level invalid inputs.
   *
   * Using a getter callback rather than `Record<string, number>` avoids the
   * TypeScript 6 `exactOptionalPropertyTypes` narrowing issue where index
   * access on `Record<string, number>` returns `number | undefined`.
   */
  calculate: (get: FieldGetter) => number;
  /** How to format the output, e.g. "2" decimal places, or a custom formatter */
  formatResult?: (value: number) => string;
  /** Unit for the result */
  resultUnit?: string;
  /** Short name for the result quantity, e.g. "Total amount" */
  resultLabel: string;
}

type CategoryId = 'finance' | 'science' | 'engineering' | 'statistics' | 'education';

interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  /** Tailwind colour token applied to accent elements */
  accent: string;
  /** Tailwind gradient string for the card background */
  gradient: string;
  /** Tailwind border colour */
  border: string;
  /** Tailwind text colour for highlighted text */
  text: string;
  /** Tailwind icon background */
  iconBg: string;
  templates: Template[];
}

// ---------------------------------------------------------------------------
// Helper: format a number with up to `dp` significant decimal places,
// stripping trailing zeros.
// ---------------------------------------------------------------------------
function fmt(value: number, dp = 4): string {
  if (!Number.isFinite(value)) return 'Undefined';
  if (Number.isNaN(value)) return 'Invalid';
  // Use exponential notation for very large / very small values
  if (Math.abs(value) >= 1e12 || (Math.abs(value) < 1e-4 && value !== 0)) {
    return value.toExponential(dp);
  }
  return parseFloat(value.toFixed(dp)).toString();
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const CATEGORIES: Category[] = [
  // ─── Finance ───────────────────────────────────────────────────────────────
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    accent: 'emerald',
    gradient: 'from-emerald-950/50 to-emerald-900/40',
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    text: 'text-emerald-300',
    iconBg: 'bg-emerald-500/10',
    templates: [
      {
        id: 'compound-interest',
        title: 'Compound Interest',
        description: 'Calculate the future value of an investment with compounding.',
        formula: 'A = P(1 + r/n)^(nt)',
        fields: [
          { key: 'P', label: 'Principal (P)', placeholder: '1000', unit: '$' },
          { key: 'r', label: 'Annual rate (r)', placeholder: '5', unit: '%' },
          { key: 'n', label: 'Compounds / year (n)', placeholder: '12' },
          { key: 't', label: 'Time in years (t)', placeholder: '10' },
        ],
        resultLabel: 'Future value',
        resultUnit: '$',
        calculate: (get) => {
          const P = get('P');
          const r = get('r');
          const n = get('n');
          const t = get('t');
          if (n <= 0) throw new Error('Compounds per year must be positive.');
          if (t < 0) throw new Error('Time must be non-negative.');
          return P * (1 + r / 100 / n) ** (n * t);
        },
        formatResult: (v) => v.toFixed(2),
      },
      {
        id: 'loan-payment',
        title: 'Monthly Loan Payment',
        description: 'Calculate the fixed monthly payment for a loan.',
        formula: 'M = P·r(1+r)^n / [(1+r)^n − 1]',
        fields: [
          { key: 'P', label: 'Loan amount (P)', placeholder: '200000', unit: '$' },
          { key: 'r', label: 'Annual rate (r)', placeholder: '6', unit: '%' },
          { key: 'n', label: 'Term in months (n)', placeholder: '360' },
        ],
        resultLabel: 'Monthly payment',
        resultUnit: '$',
        calculate: (get) => {
          const P = get('P');
          const r = get('r');
          const n = get('n');
          const monthly = r / 100 / 12;
          if (n <= 0) throw new Error('Term must be positive.');
          if (monthly === 0) return P / n;
          const top = monthly * (1 + monthly) ** n;
          const bot = (1 + monthly) ** n - 1;
          return P * (top / bot);
        },
        formatResult: (v) => v.toFixed(2),
      },
      {
        id: 'roi',
        title: 'Return on Investment',
        description: 'Measure the profitability of an investment.',
        formula: 'ROI = (gain − cost) / cost × 100',
        fields: [
          { key: 'gain', label: 'Final value (gain)', placeholder: '15000', unit: '$' },
          { key: 'cost', label: 'Initial cost', placeholder: '10000', unit: '$' },
        ],
        resultLabel: 'ROI',
        resultUnit: '%',
        calculate: (get) => {
          const gain = get('gain');
          const cost = get('cost');
          if (cost === 0) throw new Error('Cost cannot be zero.');
          return ((gain - cost) / cost) * 100;
        },
        formatResult: (v) => v.toFixed(2),
      },
      {
        id: 'present-value',
        title: 'Present Value',
        description: "Discount a future cash flow back to today's value.",
        formula: 'PV = FV / (1 + r)^n',
        fields: [
          { key: 'FV', label: 'Future value (FV)', placeholder: '5000', unit: '$' },
          { key: 'r', label: 'Discount rate (r)', placeholder: '8', unit: '%' },
          { key: 'n', label: 'Periods (n)', placeholder: '5' },
        ],
        resultLabel: 'Present value',
        resultUnit: '$',
        calculate: (get) => {
          const FV = get('FV');
          const r = get('r');
          const n = get('n');
          return FV / (1 + r / 100) ** n;
        },
        formatResult: (v) => v.toFixed(2),
      },
    ],
  },
  // ─── Science ────────────────────────────────────────────────────────────────
  {
    id: 'science',
    label: 'Science',
    icon: FlaskConical,
    accent: 'blue',
    gradient: 'from-blue-950/50 to-blue-900/40',
    border: 'border-blue-500/30 hover:border-blue-400/60',
    text: 'text-blue-300',
    iconBg: 'bg-blue-500/10',
    templates: [
      {
        id: 'ideal-gas',
        title: 'Ideal Gas Temperature',
        description: 'Solve for temperature using the ideal gas law.',
        formula: 'T = PV / (nR)',
        fields: [
          { key: 'P', label: 'Pressure (P)', placeholder: '101325', unit: 'Pa' },
          { key: 'V', label: 'Volume (V)', placeholder: '0.0224', unit: 'm³' },
          { key: 'n', label: 'Moles (n)', placeholder: '1' },
        ],
        resultLabel: 'Temperature',
        resultUnit: 'K',
        calculate: (get) => {
          const P = get('P');
          const V = get('V');
          const n = get('n');
          const R = 8.314; // J/(mol·K)
          if (n <= 0) throw new Error('Moles must be positive.');
          return (P * V) / (n * R);
        },
      },
      {
        id: 'kinetic-energy',
        title: 'Kinetic Energy',
        description: 'Energy possessed by an object due to its motion.',
        formula: 'KE = ½ mv²',
        fields: [
          { key: 'm', label: 'Mass (m)', placeholder: '10', unit: 'kg' },
          { key: 'v', label: 'Velocity (v)', placeholder: '5', unit: 'm/s' },
        ],
        resultLabel: 'Kinetic energy',
        resultUnit: 'J',
        calculate: (get) => {
          const m = get('m');
          const v = get('v');
          return 0.5 * m * v * v;
        },
      },
      {
        id: 'wavelength',
        title: 'Wave Wavelength',
        description: 'Compute the wavelength from frequency for any wave.',
        formula: 'λ = c / f',
        fields: [
          { key: 'c', label: 'Wave speed (c)', placeholder: '299792458', unit: 'm/s' },
          { key: 'f', label: 'Frequency (f)', placeholder: '6e14', unit: 'Hz' },
        ],
        resultLabel: 'Wavelength (λ)',
        resultUnit: 'm',
        calculate: (get) => {
          const c = get('c');
          const f = get('f');
          if (f <= 0) throw new Error('Frequency must be positive.');
          return c / f;
        },
      },
      {
        id: 'gravitational-force',
        title: 'Gravitational Force',
        description: "Newton's law of universal gravitation between two masses.",
        formula: 'F = G·m₁m₂ / r²',
        fields: [
          { key: 'm1', label: 'Mass 1 (m₁)', placeholder: '5.97e24', unit: 'kg' },
          { key: 'm2', label: 'Mass 2 (m₂)', placeholder: '7.34e22', unit: 'kg' },
          { key: 'r', label: 'Distance (r)', placeholder: '3.84e8', unit: 'm' },
        ],
        resultLabel: 'Gravitational force',
        resultUnit: 'N',
        calculate: (get) => {
          const m1 = get('m1');
          const m2 = get('m2');
          const r = get('r');
          const G = 6.674e-11;
          if (r <= 0) throw new Error('Distance must be positive.');
          return (G * m1 * m2) / (r * r);
        },
      },
    ],
  },
  // ─── Engineering ────────────────────────────────────────────────────────────
  {
    id: 'engineering',
    label: 'Engineering',
    icon: Wrench,
    accent: 'orange',
    gradient: 'from-orange-950/50 to-orange-900/40',
    border: 'border-orange-500/30 hover:border-orange-400/60',
    text: 'text-orange-300',
    iconBg: 'bg-orange-500/10',
    templates: [
      {
        id: 'ohms-law',
        title: "Ohm's Law – Resistance",
        description: 'Calculate resistance from voltage and current.',
        formula: 'R = V / I',
        fields: [
          { key: 'V', label: 'Voltage (V)', placeholder: '12', unit: 'V' },
          { key: 'I', label: 'Current (I)', placeholder: '2', unit: 'A' },
        ],
        resultLabel: 'Resistance',
        resultUnit: 'Ω',
        calculate: (get) => {
          const V = get('V');
          const I = get('I');
          if (I === 0) throw new Error('Current cannot be zero.');
          return V / I;
        },
      },
      {
        id: 'beam-deflection',
        title: 'Beam Deflection (Centre Load)',
        description: 'Maximum deflection of a simply-supported beam with centre point load.',
        formula: 'δ = PL³ / (48EI)',
        fields: [
          { key: 'P', label: 'Load (P)', placeholder: '5000', unit: 'N' },
          { key: 'L', label: 'Span (L)', placeholder: '3', unit: 'm' },
          { key: 'E', label: "Young's modulus (E)", placeholder: '200e9', unit: 'Pa' },
          { key: 'I', label: 'Second moment (I)', placeholder: '8.33e-6', unit: 'm⁴' },
        ],
        resultLabel: 'Max deflection (δ)',
        resultUnit: 'm',
        calculate: (get) => {
          const P = get('P');
          const L = get('L');
          const E = get('E');
          const I = get('I');
          if (E <= 0 || I <= 0) throw new Error('E and I must be positive.');
          return (P * L ** 3) / (48 * E * I);
        },
      },
      {
        id: 'thermal-expansion',
        title: 'Thermal Expansion',
        description: 'Change in length due to temperature variation.',
        formula: 'ΔL = L₀ · α · ΔT',
        fields: [
          { key: 'L0', label: 'Initial length (L₀)', placeholder: '1', unit: 'm' },
          { key: 'alpha', label: 'Coeff. of expansion (α)', placeholder: '12e-6', unit: '/°C' },
          { key: 'dT', label: 'Temp. change (ΔT)', placeholder: '100', unit: '°C' },
        ],
        resultLabel: 'Length change (ΔL)',
        resultUnit: 'm',
        calculate: (get) => {
          const L0 = get('L0');
          const alpha = get('alpha');
          const dT = get('dT');
          return L0 * alpha * dT;
        },
      },
      {
        id: 'power-electrical',
        title: 'Electrical Power',
        description: 'Power delivered to a load given voltage and current.',
        formula: 'P = V · I',
        fields: [
          { key: 'V', label: 'Voltage (V)', placeholder: '230', unit: 'V' },
          { key: 'I', label: 'Current (I)', placeholder: '10', unit: 'A' },
        ],
        resultLabel: 'Power',
        resultUnit: 'W',
        calculate: (get) => {
          const V = get('V');
          const I = get('I');
          return V * I;
        },
      },
    ],
  },
  // ─── Statistics ─────────────────────────────────────────────────────────────
  {
    id: 'statistics',
    label: 'Statistics',
    icon: BarChart2,
    accent: 'purple',
    gradient: 'from-purple-950/50 to-purple-900/40',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    text: 'text-purple-300',
    iconBg: 'bg-purple-500/10',
    templates: [
      {
        id: 'z-score',
        title: 'Z-Score',
        description: 'How many standard deviations a data point is from the mean.',
        formula: 'z = (x − μ) / σ',
        fields: [
          { key: 'x', label: 'Observation (x)', placeholder: '75' },
          { key: 'mu', label: 'Population mean (μ)', placeholder: '70' },
          { key: 'sigma', label: 'Std deviation (σ)', placeholder: '5' },
        ],
        resultLabel: 'Z-score',
        calculate: (get) => {
          const x = get('x');
          const mu = get('mu');
          const sigma = get('sigma');
          if (sigma <= 0) throw new Error('Standard deviation must be positive.');
          return (x - mu) / sigma;
        },
      },
      {
        id: 'sample-size',
        title: 'Sample Size',
        description: 'Minimum sample size for a given margin of error.',
        formula: 'n = z²p(1−p) / E²',
        fields: [
          { key: 'z', label: 'Z-value (z)', placeholder: '1.96' },
          { key: 'p', label: 'Proportion (p)', placeholder: '0.5' },
          { key: 'E', label: 'Margin of error (E)', placeholder: '0.05' },
        ],
        resultLabel: 'Sample size (n)',
        calculate: (get) => {
          const z = get('z');
          const p = get('p');
          const E = get('E');
          if (E <= 0) throw new Error('Margin of error must be positive.');
          if (p <= 0 || p >= 1) throw new Error('Proportion must be between 0 and 1.');
          return (z * z * p * (1 - p)) / (E * E);
        },
        formatResult: (v) => Math.ceil(v).toString(),
      },
      {
        id: 'confidence-interval',
        title: 'Confidence Interval (half-width)',
        description: 'Margin of error for a population mean.',
        formula: 'E = z · σ / √n',
        fields: [
          { key: 'z', label: 'Z-value (z)', placeholder: '1.96' },
          { key: 'sigma', label: 'Std deviation (σ)', placeholder: '15' },
          { key: 'n', label: 'Sample size (n)', placeholder: '100' },
        ],
        resultLabel: 'Margin of error (E)',
        calculate: (get) => {
          const z = get('z');
          const sigma = get('sigma');
          const n = get('n');
          if (n <= 0) throw new Error('Sample size must be positive.');
          if (sigma < 0) throw new Error('Standard deviation must be non-negative.');
          return z * (sigma / Math.sqrt(n));
        },
      },
      {
        id: 'pearson-correlation',
        title: 'Pooled Std Deviation',
        description: 'Combined standard deviation of two independent groups.',
        formula: 'sp = √[(n₁−1)s₁² + (n₂−1)s₂²] / (n₁+n₂−2)',
        fields: [
          { key: 's1', label: 'Std dev group 1 (s₁)', placeholder: '5' },
          { key: 'n1', label: 'Size group 1 (n₁)', placeholder: '30' },
          { key: 's2', label: 'Std dev group 2 (s₂)', placeholder: '7' },
          { key: 'n2', label: 'Size group 2 (n₂)', placeholder: '25' },
        ],
        resultLabel: 'Pooled std dev',
        calculate: (get) => {
          const s1 = get('s1');
          const n1 = get('n1');
          const s2 = get('s2');
          const n2 = get('n2');
          if (n1 < 1 || n2 < 1) throw new Error('Group sizes must be at least 1.');
          const num = (n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2;
          return Math.sqrt(num / (n1 + n2 - 2));
        },
      },
    ],
  },
  // ─── Education ─────────────────────────────────────────────────────────────
  {
    id: 'education',
    label: 'Education',
    icon: GraduationCap,
    accent: 'rose',
    gradient: 'from-rose-950/50 to-rose-900/40',
    border: 'border-rose-500/30 hover:border-rose-400/60',
    text: 'text-rose-300',
    iconBg: 'bg-rose-500/10',
    templates: [
      {
        id: 'quadratic',
        title: 'Quadratic Formula',
        description: 'Solve ax² + bx + c = 0 for its real roots.',
        formula: 'x = (−b ± √(b²−4ac)) / 2a',
        fields: [
          { key: 'a', label: 'Coefficient a', placeholder: '1' },
          { key: 'b', label: 'Coefficient b', placeholder: '-3' },
          { key: 'c', label: 'Coefficient c', placeholder: '2' },
        ],
        resultLabel: 'Roots (x₁, x₂)',
        calculate: (get) => {
          const a = get('a');
          const b = get('b');
          const c = get('c');
          if (a === 0) throw new Error('Coefficient a cannot be zero.');
          const disc = b * b - 4 * a * c;
          if (disc < 0) throw new Error('No real roots (discriminant < 0).');
          return disc; // raw discriminant; renderResult re-derives both roots
        },
        formatResult: (_disc) => {
          // _disc is not used here; the render block re-reads from state
          // We keep the signature for type compatibility.
          return '';
        },
      },
      {
        id: 'distance',
        title: 'Distance Formula',
        description: 'Euclidean distance between two points in the plane.',
        formula: 'd = √((x₂−x₁)² + (y₂−y₁)²)',
        fields: [
          { key: 'x1', label: 'x₁', placeholder: '0' },
          { key: 'y1', label: 'y₁', placeholder: '0' },
          { key: 'x2', label: 'x₂', placeholder: '3' },
          { key: 'y2', label: 'y₂', placeholder: '4' },
        ],
        resultLabel: 'Distance (d)',
        calculate: (get) => {
          const x1 = get('x1');
          const y1 = get('y1');
          const x2 = get('x2');
          const y2 = get('y2');
          return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        },
      },
      {
        id: 'pythagorean',
        title: 'Pythagorean Theorem',
        description: 'Find the hypotenuse of a right triangle.',
        formula: 'c = √(a² + b²)',
        fields: [
          { key: 'a', label: 'Side a', placeholder: '3', unit: 'units' },
          { key: 'b', label: 'Side b', placeholder: '4', unit: 'units' },
        ],
        resultLabel: 'Hypotenuse (c)',
        resultUnit: 'units',
        calculate: (get) => {
          const a = get('a');
          const b = get('b');
          if (a <= 0 || b <= 0) throw new Error('Sides must be positive.');
          return Math.sqrt(a * a + b * b);
        },
      },
      {
        id: 'slope-intercept',
        title: 'Slope Between Two Points',
        description: 'Gradient of a line through two coordinate pairs.',
        formula: 'm = (y₂ − y₁) / (x₂ − x₁)',
        fields: [
          { key: 'x1', label: 'x₁', placeholder: '1' },
          { key: 'y1', label: 'y₁', placeholder: '2' },
          { key: 'x2', label: 'x₂', placeholder: '4' },
          { key: 'y2', label: 'y₂', placeholder: '8' },
        ],
        resultLabel: 'Slope (m)',
        calculate: (get) => {
          const x1 = get('x1');
          const y1 = get('y1');
          const x2 = get('x2');
          const y2 = get('y2');
          if (x2 === x1) throw new Error('Vertical line — slope is undefined.');
          return (y2 - y1) / (x2 - x1);
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// TemplateCard component — interactive per-template card
// ---------------------------------------------------------------------------

interface TemplateCardState {
  inputs: Record<string, string>;
  result: number | null;
  error: string | null;
  computed: boolean;
}

interface TemplateCardProps {
  template: Template;
  accent: string;
  text: string;
  iconBg: string;
  animationDelay: number;
}

function TemplateCard({ template, accent, text, iconBg, animationDelay }: TemplateCardProps) {
  const baseId = useId();
  const [state, setState] = useState<TemplateCardState>({
    inputs: {},
    result: null,
    error: null,
    computed: false,
  });

  const handleChange = useCallback((key: string, raw: string) => {
    setState((prev) => ({
      ...prev,
      inputs: { ...prev.inputs, [key]: raw },
      // Reset result when inputs change
      result: null,
      error: null,
      computed: false,
    }));
  }, []);

  const handleCalculate = useCallback(() => {
    // Parse all fields into a Map (typed getter avoids TS6 exactOptionalPropertyTypes widening)
    const parsed = new Map<string, number>();
    for (const field of template.fields) {
      const raw = state.inputs[field.key] ?? '';
      const num = parseFloat(raw);
      if (raw.trim() === '' || Number.isNaN(num)) {
        setState((prev) => ({
          ...prev,
          error: `"${field.label}" is required and must be a number.`,
          result: null,
          computed: false,
        }));
        return;
      }
      parsed.set(field.key, num);
    }

    // Build a typed getter. Every key is guaranteed present because we
    // iterated template.fields above — the throw is just a safety net.
    const get = (key: string): number => {
      const val = parsed.get(key);
      if (val === undefined) throw new Error(`Internal: unknown field "${key}".`);
      return val;
    };

    try {
      const value = template.calculate(get);
      setState((prev) => ({ ...prev, result: value, error: null, computed: true }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Calculation error.';
      setState((prev) => ({ ...prev, error: msg, result: null, computed: false }));
    }
  }, [state.inputs, template]);

  const handleReset = useCallback(() => {
    setState({ inputs: {}, result: null, error: null, computed: false });
  }, []);

  // Special rendering for quadratic (two roots)
  const renderResult = (): string => {
    if (state.result === null) return '';
    if (template.id === 'quadratic') {
      // re-derive roots from stored inputs
      // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
      const a = parseFloat(state.inputs['a'] ?? '0');
      // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
      const b = parseFloat(state.inputs['b'] ?? '0');
      // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
      const c = parseFloat(state.inputs['c'] ?? '0');
      const disc = b * b - 4 * a * c;
      const x1 = (-b + Math.sqrt(disc)) / (2 * a);
      const x2 = (-b - Math.sqrt(disc)) / (2 * a);
      if (Math.abs(x1 - x2) < 1e-12) return fmt(x1, 6);
      return `${fmt(x1, 6)}, ${fmt(x2, 6)}`;
    }
    if (template.formatResult) {
      const custom = template.formatResult(state.result);
      // formatResult for quadratic returns '' and we handle above; for others return custom
      if (custom !== '') return custom;
    }
    return fmt(state.result, 6);
  };

  const resultStr = renderResult();

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: animationDelay, ease: 'easeOut' }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
      aria-label={`${template.title} calculator`}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconBg} shrink-0`} aria-hidden="true">
            <Calculator className={`h-4 w-4 ${text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${text} leading-tight`}>{template.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {template.description}
            </p>
          </div>
        </div>

        {/* Formula chip */}
        <div className="mt-3">
          <code className="text-xs font-mono px-2.5 py-1 rounded-md bg-muted/60 text-foreground/80 inline-block break-all">
            {template.formula}
          </code>
        </div>
      </div>

      {/* Input fields */}
      <div className="px-5 py-4 space-y-3">
        <div
          className="grid gap-2.5"
          style={{
            gridTemplateColumns:
              template.fields.length === 2
                ? 'repeat(2, minmax(0, 1fr))'
                : template.fields.length >= 4
                  ? 'repeat(2, minmax(0, 1fr))'
                  : '1fr',
          }}
        >
          {template.fields.map((field) => {
            const fieldId = `${baseId}-${field.key}`;
            return (
              <div key={field.key} className="flex flex-col gap-1">
                <label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </label>
                <div className="relative flex items-center">
                  <input
                    id={fieldId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={state.inputs[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCalculate();
                    }}
                    className={[
                      'w-full rounded-md border border-border bg-background',
                      'px-2.5 py-1.5 text-sm text-foreground',
                      'placeholder:text-muted-foreground/50',
                      'transition-colors duration-150',
                      'hover:border-border/80',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      field.unit ? 'pr-10' : '',
                    ].join(' ')}
                    aria-label={`${field.label}${field.unit ? ` in ${field.unit}` : ''}`}
                  />
                  {field.unit && (
                    <span
                      className="absolute right-2.5 text-xs text-muted-foreground/70 pointer-events-none select-none"
                      aria-hidden="true"
                    >
                      {field.unit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleCalculate}
            className={[
              'flex-1 flex items-center justify-center gap-1.5',
              'px-3 py-2 rounded-md text-sm font-medium',
              `bg-${accent}-500/15 ${text} border border-${accent}-500/30`,
              `hover:bg-${accent}-500/25 hover:border-${accent}-500/50`,
              'transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            ].join(' ')}
            aria-label={`Calculate ${template.title}`}
          >
            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
            Calculate
          </button>
          {state.computed && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Reset inputs"
            >
              Reset
            </button>
          )}
        </div>

        {/* Result / Error display */}
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle
                className="h-4 w-4 text-destructive shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs text-destructive leading-snug">{state.error}</p>
            </motion.div>
          )}

          {state.computed && state.result !== null && !state.error && (
            <motion.div
              key="result"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg bg-${accent}-500/10 border border-${accent}-500/25`}
              role="status"
              aria-live="polite"
              aria-label={`Result: ${template.resultLabel} = ${resultStr}${template.resultUnit ? ` ${template.resultUnit}` : ''}`}
            >
              <CheckCircle2 className={`h-4 w-4 ${text} shrink-0`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">{template.resultLabel}: </span>
                <span className={`text-sm font-semibold font-mono ${text}`}>{resultStr}</span>
                {template.resultUnit && (
                  <span className="text-xs text-muted-foreground ml-1">{template.resultUnit}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// CategorySection — renders heading + template grid for one category
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  category: Category;
  baseDelay: number;
}

function CategorySection({ category, baseDelay }: CategorySectionProps) {
  const Icon = category.icon;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      aria-labelledby={`cat-heading-${category.id}`}
    >
      {/* Category heading row */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`p-2.5 rounded-xl bg-gradient-to-br ${category.gradient} border ${category.border.split(' ')[0]}`}
          aria-hidden="true"
        >
          <Icon className={`h-5 w-5 ${category.text}`} />
        </div>
        <h2 id={`cat-heading-${category.id}`} className={`text-xl font-bold ${category.text}`}>
          {category.label}
        </h2>
        <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
          {category.templates.length} templates
        </span>
      </div>

      {/* Template cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {category.templates.map((template, idx) => (
          <TemplateCard
            key={template.id}
            template={template}
            accent={category.accent}
            text={category.text}
            iconBg={category.iconBg}
            animationDelay={baseDelay + idx * 0.06}
          />
        ))}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// CategoryTab — pill button in the sticky filter bar
// ---------------------------------------------------------------------------

interface CategoryTabProps {
  category: Category;
  isSelected: boolean;
  onClick: () => void;
}

function CategoryTab({ category, isSelected, onClick }: CategoryTabProps) {
  const Icon = category.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium',
        'border transition-all duration-200 whitespace-nowrap',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isSelected
          ? `${category.text} border-${category.accent}-500/50 bg-${category.accent}-500/15`
          : 'text-muted-foreground border-border bg-transparent hover:text-foreground hover:border-border/80 hover:bg-muted/30',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {category.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Calculation Templates Page
 *
 * A curated library of 20+ interactive calculation templates across five
 * domains: Finance, Science, Engineering, Statistics, and Education.
 *
 * Each template card is fully self-contained with labeled inputs, an inline
 * calculate button, and an accessible result display.
 *
 * Accessibility:
 * - Semantic HTML5 landmarks (main, section, article, header)
 * - All inputs have associated <label> elements via htmlFor
 * - Result panels use role="status" / aria-live for screen reader announcements
 * - Error panels use role="alert" / aria-live="assertive"
 * - Keyboard: Tab navigation + Enter to calculate from any field
 * - Category filter buttons use aria-pressed
 * - Respects prefers-reduced-motion via Framer Motion
 *
 * Keyboard shortcuts:
 * - Tab / Shift-Tab: move between fields
 * - Enter (while in any field): trigger calculation
 */
export default function TemplatesPage() {
  const t = useTranslations('templates');
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(new Set());

  const toggleCategory = useCallback((id: CategoryId) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setActiveCategories(new Set()), []);

  // If no category filter is active, show all; otherwise show only selected
  const showAll = activeCategories.size === 0;
  const totalTemplates = CATEGORIES.reduce((n, c) => n + c.templates.length, 0);

  return (
    <div className="min-h-screen">
      {/* ── Skip link ──────────────────────────────────────────────────────── */}
      <a
        href="#templates-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        {t('skipToContent')}
      </a>

      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: [
            'radial-gradient(at 10% 20%, oklch(0.62 0.18 155 / 0.06) 0%, transparent 50%)',
            'radial-gradient(at 90% 80%, oklch(0.60 0.20 264 / 0.06) 0%, transparent 50%)',
            'radial-gradient(at 50% 50%, oklch(0.55 0.15 300 / 0.04) 0%, transparent 60%)',
          ].join(', '),
        }}
        aria-hidden="true"
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6 text-sm font-medium">
              <Calculator className="h-4 w-4" aria-hidden="true" />
              {t('badge')}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t('heroTitle')}
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
              {t('heroDescription')}
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.id} className="flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${cat.text}`} aria-hidden="true" />
                    <span>{cat.label}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{totalTemplates} templates</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Sticky category filter bar ─────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border py-3 px-4"
        aria-label="Filter templates by category"
      >
        <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">
            {t('filterLabel')}
          </span>
          {CATEGORIES.map((cat) => (
            <CategoryTab
              key={cat.id}
              category={cat}
              isSelected={activeCategories.has(cat.id)}
              onClick={() => toggleCategory(cat.id)}
            />
          ))}
          {!showAll && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
            >
              {t('clearFilters')}
            </motion.button>
          )}
        </div>
      </nav>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main
        id="templates-main"
        className="max-w-5xl mx-auto px-4 py-10"
        aria-label="Calculation templates"
      >
        {CATEGORIES.map((category, catIdx) => {
          const isVisible = showAll || activeCategories.has(category.id);
          if (!isVisible) return null;
          return (
            <CategorySection key={category.id} category={category} baseDelay={catIdx * 0.05} />
          );
        })}

        {/* Empty state — only shown when all filtered categories are deselected */}
        {!showAll && CATEGORIES.every((c) => !activeCategories.has(c.id)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
            role="status"
          >
            <p className="text-muted-foreground">{t('noResults')}</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t('clearFilters')}
            </button>
          </motion.div>
        )}
      </main>

      {/* ── How to use callout ────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-16" aria-labelledby="how-to-heading">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0" aria-hidden="true">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="how-to-heading" className="text-base font-semibold mb-1">
                {t('howToTitle')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('howToDescription')}
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
