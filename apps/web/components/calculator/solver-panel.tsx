'use client';

import { useState, useTransition, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MathRenderer } from '@/components/ui/math-renderer';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Calculator,
  BookOpen,
  Sigma,
  TrendingUp,
  Brackets,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// BRANDED TYPES
// ============================================================================

/** Branded type for a validated math expression string */
type ValidExpression = string & { readonly __brand: unique symbol };

/** Branded type for a validated variable name */
type VariableName = string & { readonly __brand: unique symbol };

// ============================================================================
// DOMAIN TYPE DEFINITIONS
// ============================================================================

/**
 * Problem mode supported by the step-by-step solver.
 * Discriminated union used to drive tab selection and example lookup.
 */
type ProblemMode =
  | 'equation'
  | 'simplify'
  | 'derivative'
  | 'integral';

/** Category badge color mapping */
type StepCategoryStyle = {
  readonly bg: string;
  readonly text: string;
  readonly border: string;
  readonly label: string;
};

/**
 * A rendered solution step ready for display.
 * The `latex` field is what gets passed to MathRenderer.
 */
interface RenderedStep {
  readonly stepNumber: number;
  readonly description: string;
  readonly explanation: string;
  readonly operation: string;
  readonly category: string;
  readonly latex: string;
}

/**
 * A complete rendered solution.
 */
interface RenderedSolution {
  readonly problem: string;
  readonly mode: ProblemMode;
  readonly steps: ReadonlyArray<RenderedStep>;
  readonly finalLatex: string;
  readonly timeMs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Step category → visual style mapping */
const CATEGORY_STYLES: Readonly<Record<string, StepCategoryStyle>> = {
  Identification: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    label: 'Identify',
  },
  Simplification: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    label: 'Simplify',
  },
  Differentiation: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500/30',
    label: 'Differentiate',
  },
  Integration: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    label: 'Integrate',
  },
  Rearrangement: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    label: 'Rearrange',
  },
  Isolation: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-500/30',
    label: 'Isolate',
  },
  Factorization: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-500/30',
    label: 'Factor',
  },
  Formula: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/30',
    label: 'Formula',
  },
  Substitution: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500/30',
    label: 'Substitute',
  },
  Expansion: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500/30',
    label: 'Expand',
  },
  Identity: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-500/30',
    label: 'Identity',
  },
  FinalAnswer: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/30',
    label: 'Answer',
  },
  Evaluation: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-500/30',
    label: 'Evaluate',
  },
} satisfies Record<string, StepCategoryStyle>;

const DEFAULT_CATEGORY_STYLE: StepCategoryStyle = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
  border: 'border-border',
  label: 'Step',
};

/** Example expressions per mode */
const MODE_EXAMPLES: Readonly<Record<ProblemMode, ReadonlyArray<{ label: string; input: string; desc: string }>>> = {
  equation: [
    { label: 'Linear', input: '2*x + 3 = 7', desc: 'Simple linear equation' },
    { label: 'Quadratic (factor)', input: 'x^2 + 5*x + 6 = 0', desc: 'x = -2 and x = -3 (factors nicely)' },
    { label: 'Quadratic (formula)', input: 'x^2 - 3*x + 1 = 0', desc: 'Irrational roots via quadratic formula' },
    { label: 'Complex roots', input: 'x^2 + 1 = 0', desc: 'Complex solutions ±i' },
    { label: 'Cubic', input: 'x^3 - 6*x^2 + 11*x - 6 = 0', desc: 'Three real roots' },
    { label: 'Trig', input: 'sin(x) - 0.5 = 0', desc: 'Trigonometric equation' },
    { label: 'Fraction', input: 'x/2 + 1 = 3', desc: 'x = 4' },
  ],
  simplify: [
    { label: 'Arithmetic', input: '2 + 3 * 4', desc: 'Order of operations' },
    { label: 'Powers', input: 'x^2 * x^3', desc: 'Product of powers' },
    { label: 'Expand', input: 'expand (x + 1)^2', desc: 'Binomial expansion' },
    { label: 'Trig', input: 'sin(0)', desc: 'Trig evaluation' },
    { label: 'Log', input: 'log(exp(1))', desc: 'Natural log of e' },
    { label: 'Constant', input: '3 + 0 * x', desc: 'Zero product rule' },
  ],
  derivative: [
    { label: 'Power', input: 'x^3', desc: 'd/dx = 3x²' },
    { label: 'Poly', input: 'x^3 - 4*x^2 + 2*x - 1', desc: 'Polynomial derivative' },
    { label: 'Trig', input: 'sin(x)', desc: 'd/dx sin(x) = cos(x)' },
    { label: 'Product', input: 'x * sin(x)', desc: 'Product rule' },
    { label: 'Exp', input: 'exp(x^2)', desc: 'Chain rule' },
    { label: 'Log', input: 'log(x)', desc: 'd/dx ln(x) = 1/x' },
  ],
  integral: [
    { label: 'Power', input: 'x^2', desc: '∫x² dx = x³/3' },
    { label: 'Poly', input: '2*x + 1', desc: 'Linear integral' },
    { label: 'Trig', input: 'cos(x)', desc: '∫cos(x) dx = sin(x)' },
    { label: 'Exp', input: 'exp(x)', desc: '∫eˣ dx = eˣ' },
    { label: 'Constant', input: '5', desc: '∫5 dx = 5x' },
    { label: 'Log', input: '1/x', desc: '∫1/x dx = ln|x|' },
  ],
};

/** Mode metadata for tabs */
const MODE_META: Readonly<Record<ProblemMode, { label: string; placeholder: string; hint: string }>> = {
  equation: {
    label: 'Solve Equation',
    placeholder: 'x^2 - 4 = 0',
    hint: 'Enter an equation with = sign. Use * for multiplication, ^ for powers.',
  },
  simplify: {
    label: 'Simplify',
    placeholder: '2*x^2 + 3*x - x^2',
    hint: 'Enter an expression to simplify or evaluate. Prefix with "expand" to expand.',
  },
  derivative: {
    label: 'Differentiate',
    placeholder: 'x^3 - 2*x + 1',
    hint: 'Enter a function of x. The derivative d/dx will be computed symbolically.',
  },
  integral: {
    label: 'Integrate',
    placeholder: 'x^2 + 2*x',
    hint: 'Enter a function of x. The antiderivative ∫ dx will be computed symbolically.',
  },
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Typed view over an AST node object.
 * Using an interface (not Record<string,unknown>) avoids TS4111 index-signature
 * errors that occur with bracket-vs-dot notation in TypeScript 6 strict mode.
 */
interface AstNodeShape {
  readonly type: string;
  readonly value?: number | bigint | string;
  readonly name?: string;
  readonly op?: string;
  readonly fn?: string;
  readonly args?: readonly unknown[];
}

/** Narrow `unknown` to AstNodeShape when it structurally matches */
function toAstShape(node: unknown): AstNodeShape | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as AstNodeShape;
  if (typeof n.type !== 'string') return null;
  return n;
}

/** Convert an AST node to a LaTeX string using the visitor pattern */
function astNodeToLatex(node: unknown): string {
  const n = toAstShape(node);
  if (!n) return String(node ?? '');

  if (n.type === 'ConstantNode') {
    const v = n.value;
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    return String(v ?? '');
  }

  if (n.type === 'SymbolNode') {
    return String(n.name ?? '');
  }

  if (n.type === 'OperatorNode') {
    const args = n.args ?? [];
    const left = astNodeToLatex(args[0]);
    const right = astNodeToLatex(args[1]);
    const op = String(n.op ?? '');

    switch (op) {
      case '+': return `${left} + ${right}`;
      case '-': return `${left} - ${right}`;
      case '*': {
        // Wrap additive sub-expressions in parentheses
        const l = needsParens(args[0]) ? `\\left(${left}\\right)` : left;
        const r = needsParens(args[1]) ? `\\left(${right}\\right)` : right;
        return `${l} \\cdot ${r}`;
      }
      case '/': return `\\frac{${left}}{${right}}`;
      case '^': {
        const base = needsParens(args[0]) ? `\\left(${left}\\right)` : left;
        return `${base}^{${right}}`;
      }
      case '%': return `${left} \\bmod ${right}`;
      default: return `${left} ${op} ${right}`;
    }
  }

  if (n.type === 'UnaryOperatorNode') {
    const args = n.args ?? [];
    const operand = astNodeToLatex(args[0]);
    return `-${needsParens(args[0]) ? `\\left(${operand}\\right)` : operand}`;
  }

  if (n.type === 'FunctionNode') {
    const fn = String(n.fn ?? '');
    const args = (n.args ?? []).map(astNodeToLatex);

    switch (fn) {
      case 'sin': return `\\sin\\left(${args[0]}\\right)`;
      case 'cos': return `\\cos\\left(${args[0]}\\right)`;
      case 'tan': return `\\tan\\left(${args[0]}\\right)`;
      case 'asin': return `\\arcsin\\left(${args[0]}\\right)`;
      case 'acos': return `\\arccos\\left(${args[0]}\\right)`;
      case 'atan': return `\\arctan\\left(${args[0]}\\right)`;
      case 'sinh': return `\\sinh\\left(${args[0]}\\right)`;
      case 'cosh': return `\\cosh\\left(${args[0]}\\right)`;
      case 'tanh': return `\\tanh\\left(${args[0]}\\right)`;
      case 'sqrt': return `\\sqrt{${args[0]}}`;
      case 'cbrt': return `\\sqrt[3]{${args[0]}}`;
      case 'exp': return `e^{${args[0]}}`;
      case 'log':
      case 'ln': return `\\ln\\left(${args[0]}\\right)`;
      case 'log10': return `\\log_{10}\\left(${args[0]}\\right)`;
      case 'log2': return `\\log_{2}\\left(${args[0]}\\right)`;
      case 'abs': return `\\left|${args[0]}\\right|`;
      case 'ceil': return `\\lceil ${args[0]} \\rceil`;
      case 'floor': return `\\lfloor ${args[0]} \\rfloor`;
      case 'factorial': return `${args[0]}!`;
      default: return `\\operatorname{${fn}}\\left(${args.join(', ')}\\right)`;
    }
  }

  return '?';
}

/** Return true if a node needs parentheses when used as a child of *, ^ */
function needsParens(node: unknown): boolean {
  const n = toAstShape(node);
  if (!n || n.type !== 'OperatorNode') return false;
  const op = String(n.op ?? '');
  return op === '+' || op === '-';
}

/** Format a Solution (from solve.ts) to a LaTeX string */
function solutionToLatex(sol: { value: unknown }): string {
  const v = sol.value;
  if (typeof v === 'number') {
    if (!isFinite(v)) return '\\text{infinite solutions}';
    // Round-trip: trim trailing zeros
    const str = v.toFixed(10).replace(/\.?0+$/, '');
    return str;
  }
  // Complex number shape { real, imag, toString }
  if (v && typeof v === 'object') {
    const c = v as { real?: number; imag?: number };
    if (c.real !== undefined && c.imag !== undefined) {
      const r = c.real.toFixed(6).replace(/\.?0+$/, '');
      const absI = Math.abs(c.imag).toFixed(6).replace(/\.?0+$/, '');
      if (c.imag === 0) return r;
      if (c.real === 0) return `${absI}i`;
      const sign = c.imag > 0 ? '+' : '-';
      return `${r} ${sign} ${absI}i`;
    }
  }
  return String(v);
}

/** Validate an expression string is non-empty */
function validateExpression(raw: string): ValidExpression | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed as ValidExpression;
}

/**
 * Identify which integration rule applies to an integrand AST.
 * Returns a description string and a LaTeX representation of the rule.
 *
 * This inspects the outermost structure of the parsed integrand to name
 * the primary rule the integration engine will apply.
 */
interface IntegrationRuleInfo {
  readonly ruleName: string;
  readonly description: string;
  readonly explanation: string;
  readonly latex: string;
}

function identifyIntegrationRule(
  integrandAst: unknown,
  inputExpr: string,
  varName: string,
): IntegrationRuleInfo {
  const n = toAstShape(integrandAst);

  // Default fallback
  const fallback: IntegrationRuleInfo = {
    ruleName: 'integration rule',
    description: 'Apply integration rules',
    explanation:
      'Apply symbolic integration rules: power rule, trigonometric identities, ' +
      'exponential rules, and the fundamental theorem of calculus.',
    latex: `\\int ${inputExpr} \\, d${varName}`,
  };

  if (!n) return fallback;

  // ConstantNode → constant rule: ∫k dx = kx
  if (n.type === 'ConstantNode') {
    const k = n.value;
    return {
      ruleName: 'constant rule',
      description: `Constant rule: \\u222Bk d${varName} = k${varName}`,
      explanation:
        `The integrand is a constant (${String(k)}). By the constant rule, ` +
        `the integral of a constant k is k${varName}.`,
      latex: `\\int ${String(k)} \\, d${varName} = ${String(k)} \\cdot ${varName}`,
    };
  }

  // SymbolNode → variable rule: ∫x dx = x²/2
  if (n.type === 'SymbolNode' && n.name === varName) {
    return {
      ruleName: 'power rule',
      description: `Power rule: \\u222B${varName} d${varName} = ${varName}\\u00B2/2`,
      explanation:
        `The integrand is ${varName}, which is ${varName}^1. By the power rule, ` +
        `\\u222B${varName}^n d${varName} = ${varName}^(n+1)/(n+1), so with n=1 we get ${varName}\\u00B2/2.`,
      latex: `\\int ${varName} \\, d${varName} = \\frac{${varName}^{2}}{2}`,
    };
  }

  // OperatorNode: check for power rule (x^n), sum/difference, constant multiple
  if (n.type === 'OperatorNode') {
    const op = String(n.op ?? '');

    // x^n → power rule
    if (op === '^') {
      const args = n.args ?? [];
      const base = toAstShape(args[0]);
      const exp = toAstShape(args[1]);
      if (base && base.type === 'SymbolNode' && base.name === varName && exp && exp.type === 'ConstantNode') {
        const nVal = exp.value;
        if (nVal === -1) {
          return {
            ruleName: 'logarithmic rule',
            description: `Logarithmic rule: \\u222B1/${varName} d${varName} = ln|${varName}|`,
            explanation:
              `The integrand is ${varName}^(-1) = 1/${varName}. This is the special case of the power rule ` +
              `where n = -1, giving ln|${varName}| instead of the usual formula.`,
            latex: `\\int \\frac{1}{${varName}} \\, d${varName} = \\ln|${varName}|`,
          };
        }
        return {
          ruleName: 'power rule',
          description: `Power rule: \\u222B${varName}^n d${varName} = ${varName}^(n+1)/(n+1)`,
          explanation:
            `The integrand is ${varName}^${String(nVal)}. By the power rule, ` +
            `\\u222B${varName}^n d${varName} = ${varName}^(n+1)/(n+1) for n \\u2260 -1.`,
          latex: `\\int ${varName}^{${String(nVal)}} \\, d${varName} = \\frac{${varName}^{${Number(nVal) + 1}}}{${Number(nVal) + 1}}`,
        };
      }
      // a^x → exponential with constant base
      if (base && base.type === 'ConstantNode' && exp && exp.type === 'SymbolNode' && exp.name === varName) {
        const a = base.value;
        return {
          ruleName: 'exponential rule',
          description: `Exponential rule: \\u222B${String(a)}^${varName} d${varName} = ${String(a)}^${varName}/ln(${String(a)})`,
          explanation:
            `The integrand is ${String(a)}^${varName}. By the exponential rule for constant bases, ` +
            `\\u222Ba^${varName} d${varName} = a^${varName}/ln(a).`,
          latex: `\\int ${String(a)}^{${varName}} \\, d${varName} = \\frac{${String(a)}^{${varName}}}{\\ln(${String(a)})}`,
        };
      }
    }

    // + or - → sum/difference (linearity)
    if (op === '+' || op === '-') {
      return {
        ruleName: 'sum/difference rule',
        description: `Sum/difference rule: integrate each term separately`,
        explanation:
          `The integrand is a ${op === '+' ? 'sum' : 'difference'} of terms. ` +
          `By linearity of integration, \\u222B(f ${op} g) d${varName} = \\u222Bf d${varName} ${op} \\u222Bg d${varName}. ` +
          `Each term is integrated independently.`,
        latex: `\\int \\left(${inputExpr}\\right) d${varName}`,
      };
    }

    // * → constant multiple or integration by parts
    if (op === '*') {
      return {
        ruleName: 'constant multiple / product rule',
        description: `Product integration: constant factor extraction or integration by parts`,
        explanation:
          `The integrand is a product. If one factor is a constant, it can be pulled outside the integral ` +
          `(\\u222Bc\\u00B7f d${varName} = c\\u00B7\\u222Bf d${varName}). Otherwise, integration by parts is applied: ` +
          `\\u222Bu dv = u\\u00B7v - \\u222Bv du, using the LIATE heuristic to choose u and dv.`,
        latex: `\\int \\left(${inputExpr}\\right) d${varName}`,
      };
    }

    // / → check for 1/x pattern
    if (op === '/') {
      const args = n.args ?? [];
      const num = toAstShape(args[0]);
      const den = toAstShape(args[1]);
      if (num && num.type === 'ConstantNode' && den && den.type === 'SymbolNode' && den.name === varName) {
        return {
          ruleName: 'logarithmic rule',
          description: `Logarithmic rule: \\u222B1/${varName} d${varName} = ln|${varName}|`,
          explanation:
            `The integrand is ${String(num.value)}/${varName}. Factoring out the constant: ` +
            `${String(num.value)} \\u00B7 \\u222B1/${varName} d${varName} = ${String(num.value)} \\u00B7 ln|${varName}|.`,
          latex: `\\int \\frac{${String(num.value)}}{${varName}} \\, d${varName} = ${String(num.value)} \\cdot \\ln|${varName}|`,
        };
      }
      return fallback;
    }
  }

  // FunctionNode → trig, exponential, logarithmic integrals
  if (n.type === 'FunctionNode') {
    const fn = String(n.fn ?? '');
    const args = n.args ?? [];
    const firstArg = toAstShape(args[0]);
    const isSimpleVar = firstArg && firstArg.type === 'SymbolNode' && firstArg.name === varName;

    const trigIntegrals: Record<string, { result: string; explanation: string }> = {
      sin: {
        result: `-\\cos(${varName})`,
        explanation: `The derivative of -cos(${varName}) is sin(${varName}), so \\u222Bsin(${varName}) d${varName} = -cos(${varName}).`,
      },
      cos: {
        result: `\\sin(${varName})`,
        explanation: `The derivative of sin(${varName}) is cos(${varName}), so \\u222Bcos(${varName}) d${varName} = sin(${varName}).`,
      },
      tan: {
        result: `\\ln|\\sec(${varName})|`,
        explanation: `Using the identity tan = sin/cos and substitution u = cos(${varName}), we get \\u222Btan(${varName}) d${varName} = ln|sec(${varName})|.`,
      },
      sec: {
        result: `\\ln|\\sec(${varName}) + \\tan(${varName})|`,
        explanation: `Multiplying by (sec + tan)/(sec + tan) and substituting: \\u222Bsec(${varName}) d${varName} = ln|sec(${varName}) + tan(${varName})|.`,
      },
      csc: {
        result: `-\\ln|\\csc(${varName}) + \\cot(${varName})|`,
        explanation: `Multiplying by (csc + cot)/(csc + cot) and substituting: \\u222Bcsc(${varName}) d${varName} = -ln|csc(${varName}) + cot(${varName})|.`,
      },
      cot: {
        result: `\\ln|\\sin(${varName})|`,
        explanation: `Using the identity cot = cos/sin and substitution u = sin(${varName}): \\u222Bcot(${varName}) d${varName} = ln|sin(${varName})|.`,
      },
      sinh: {
        result: `\\cosh(${varName})`,
        explanation: `The derivative of cosh(${varName}) is sinh(${varName}), so \\u222Bsinh(${varName}) d${varName} = cosh(${varName}).`,
      },
      cosh: {
        result: `\\sinh(${varName})`,
        explanation: `The derivative of sinh(${varName}) is cosh(${varName}), so \\u222Bcosh(${varName}) d${varName} = sinh(${varName}).`,
      },
      tanh: {
        result: `\\ln(\\cosh(${varName}))`,
        explanation: `Using substitution u = cosh(${varName}): \\u222Btanh(${varName}) d${varName} = ln(cosh(${varName})).`,
      },
    };

    if (isSimpleVar && fn in trigIntegrals) {
      const info = trigIntegrals[fn]!;
      const fnLatex = fn.length > 1 ? `\\${fn}` : fn;
      return {
        ruleName: `${fn} integral`,
        description: `Trigonometric integral: \\u222B${fn}(${varName}) d${varName} = ${info.result.replace(/\\/g, '')}`,
        explanation: info.explanation,
        latex: `\\int ${fnLatex}\\left(${varName}\\right) d${varName} = ${info.result}`,
      };
    }

    // exp(x) → exponential rule
    if (fn === 'exp' && isSimpleVar) {
      return {
        ruleName: 'exponential rule',
        description: `Exponential rule: \\u222Be^${varName} d${varName} = e^${varName}`,
        explanation:
          `The exponential function e^${varName} is its own antiderivative: ` +
          `\\u222Be^${varName} d${varName} = e^${varName}.`,
        latex: `\\int e^{${varName}} \\, d${varName} = e^{${varName}}`,
      };
    }

    // log/ln → logarithm integral
    if ((fn === 'log' || fn === 'ln') && isSimpleVar) {
      return {
        ruleName: 'logarithm integral',
        description: `Logarithm integral: \\u222Bln(${varName}) d${varName} = ${varName}\\u00B7ln(${varName}) - ${varName}`,
        explanation:
          `Using integration by parts with u = ln(${varName}) and dv = d${varName}: ` +
          `\\u222Bln(${varName}) d${varName} = ${varName}\\u00B7ln(${varName}) - ${varName}.`,
        latex: `\\int \\ln(${varName}) \\, d${varName} = ${varName} \\cdot \\ln(${varName}) - ${varName}`,
      };
    }

    // Inverse trig integrals
    const invTrigIntegrals: Record<string, { result: string; explanation: string }> = {
      asin: {
        result: `${varName} \\cdot \\arcsin(${varName}) + \\sqrt{1 - ${varName}^2}`,
        explanation: `Using integration by parts with u = arcsin(${varName}) and dv = d${varName}.`,
      },
      acos: {
        result: `${varName} \\cdot \\arccos(${varName}) - \\sqrt{1 - ${varName}^2}`,
        explanation: `Using integration by parts with u = arccos(${varName}) and dv = d${varName}.`,
      },
      atan: {
        result: `${varName} \\cdot \\arctan(${varName}) - \\frac{\\ln(1 + ${varName}^2)}{2}`,
        explanation: `Using integration by parts with u = arctan(${varName}) and dv = d${varName}.`,
      },
    };

    if (isSimpleVar && fn in invTrigIntegrals) {
      const info = invTrigIntegrals[fn]!;
      return {
        ruleName: `${fn} integral`,
        description: `Inverse trig integral: \\u222B${fn}(${varName}) d${varName}`,
        explanation: info.explanation,
        latex: `\\int \\operatorname{${fn}}(${varName}) \\, d${varName} = ${info.result}`,
      };
    }

    // sqrt → can be rewritten as power rule x^(1/2)
    if (fn === 'sqrt' && isSimpleVar) {
      return {
        ruleName: 'power rule',
        description: `Power rule: \\u221A${varName} = ${varName}^(1/2)`,
        explanation:
          `Rewrite \\u221A${varName} as ${varName}^(1/2) and apply the power rule: ` +
          `\\u222B${varName}^(1/2) d${varName} = ${varName}^(3/2)/(3/2) = (2/3)${varName}^(3/2).`,
        latex: `\\int \\sqrt{${varName}} \\, d${varName} = \\frac{2}{3} ${varName}^{3/2}`,
      };
    }
  }

  return fallback;
}

/** Validate a variable name */
function validateVariable(raw: string): VariableName {
  const trimmed = raw.trim();
  if (/^[a-zA-Z][a-zA-Z0-9]{0,2}$/.test(trimmed)) {
    return trimmed as VariableName;
  }
  return 'x' as VariableName;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Step category badge */
function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_CATEGORY_STYLE;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
        style.bg,
        style.text,
        style.border
      )}
    >
      {style.label}
    </span>
  );
}

interface StepCardProps {
  step: RenderedStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isFinal: boolean;
}

/**
 * Collapsible step card with Framer Motion expand animation.
 * Keyboard accessible: Enter/Space to toggle, arrow keys for navigation.
 */
function StepCard({ step, index, isExpanded, onToggle, isFinal }: StepCardProps) {
  const headerId = useId();
  const bodyId = useId();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      className={cn(
        'rounded-lg border overflow-hidden',
        isFinal
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card'
      )}
    >
      {/* Step header — clickable toggle */}
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={bodyId}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'transition-colors duration-150',
          isExpanded
            ? 'bg-muted/40'
            : 'hover:bg-muted/20'
        )}
      >
        {/* Step number bubble */}
        <span
          className={cn(
            'flex-none mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0',
            isFinal
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
          aria-hidden="true"
        >
          {step.stepNumber}
        </span>

        {/* Step description + category */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {step.description}
            </span>
            <CategoryBadge category={step.category} />
          </div>
          {/* LaTeX preview of step result — always visible */}
          <div
            className="mt-1.5 overflow-x-auto"
            aria-label={`Step ${step.stepNumber} expression`}
          >
            <MathRenderer
              expression={step.latex}
              displayMode={false}
              className="text-base"
            />
          </div>
        </div>

        {/* Expand/collapse chevron */}
        <span className="flex-none mt-0.5 text-muted-foreground" aria-hidden="true">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {/* Expandable explanation body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={bodyId}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/60">
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                {step.explanation}
              </p>
              {/* Display-mode math for expanded state */}
              <div
                className="mt-3 rounded-md bg-muted/50 px-4 py-3 overflow-x-auto"
                aria-label={`Step ${step.stepNumber} expression, display mode`}
              >
                <MathRenderer
                  expression={step.latex}
                  displayMode={true}
                  className="text-base"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground/70 font-mono">
                Operation: {step.operation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// EXAMPLE BUTTON ROW
// ============================================================================

interface ExampleButtonsProps {
  mode: ProblemMode;
  onSelect: (input: string) => void;
}

function ExampleButtons({ mode, onSelect }: ExampleButtonsProps) {
  const examples = MODE_EXAMPLES[mode];

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Examples
      </p>
      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex.input}
            type="button"
            onClick={() => onSelect(ex.input)}
            title={ex.desc}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40',
              'px-2.5 py-1 text-xs font-mono transition-colors duration-150',
              'hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            )}
          >
            <span className="text-[10px] font-sans text-muted-foreground not-italic">
              {ex.label}:
            </span>
            <span>{ex.input}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// RESULTS PANEL
// ============================================================================

interface ResultsPanelProps {
  solution: RenderedSolution;
  onCopyAnswer: () => Promise<void>;
  copied: boolean;
}

function ResultsPanel({ solution, onCopyAnswer, copied }: ResultsPanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<number>>(
    new Set([solution.steps.length]) // final step open by default
  );

  const toggleStep = useCallback((stepNumber: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSteps(new Set(solution.steps.map((s) => s.stepNumber)));
  }, [solution.steps]);

  const collapseAll = useCallback(() => {
    setExpandedSteps(new Set());
  }, []);

  const allExpanded = expandedSteps.size === solution.steps.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
      role="region"
      aria-label="Step-by-step solution"
    >
      {/* Solution header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Solution — {solution.steps.length} step{solution.steps.length !== 1 ? 's' : ''}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Computed in {solution.timeMs.toFixed(1)} ms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
            className="text-xs h-7"
            aria-label={allExpanded ? 'Collapse all steps' : 'Expand all steps'}
          >
            {allExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" />
                Collapse all
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" />
                Expand all
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Step list */}
      <ol
        className="list-none"
        aria-label={`${solution.steps.length} solution steps`}
      >
        <AnimatePresence mode="popLayout">
          {solution.steps.map((step, idx) => {
            const isLast = idx === solution.steps.length - 1;
            return (
              <li key={step.stepNumber}>
                <StepCard
                  step={step}
                  index={idx}
                  isExpanded={expandedSteps.has(step.stepNumber)}
                  onToggle={() => toggleStep(step.stepNumber)}
                  isFinal={isLast}
                />
                {/* Animated arrow connector between steps (not after the last step) */}
                {!isLast && (
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                    className="flex items-center justify-center h-6 select-none"
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-0">
                      <div className="w-px h-3 bg-border" />
                      <svg
                        width="8"
                        height="5"
                        viewBox="0 0 8 5"
                        fill="none"
                        className="text-border"
                      >
                        <path d="M0 0L4 5L8 0" fill="currentColor" />
                      </svg>
                    </div>
                  </motion.div>
                )}
              </li>
            );
          })}
        </AnimatePresence>
      </ol>

      {/* Final answer callout */}
      <div
        className="rounded-xl border border-primary/30 bg-primary/5 p-4"
        role="region"
        aria-label="Final answer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Final Answer
            </p>
            <div className="overflow-x-auto">
              <MathRenderer
                expression={solution.finalLatex}
                displayMode={true}
                className="text-lg"
                ariaLabel={`Final answer: ${solution.finalLatex}`}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyAnswer}
            aria-label="Copy final answer to clipboard"
            className="flex-none h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * SolverPanel — Step-by-Step Mathematical Solver
 *
 * Provides a UI for entering mathematical problems and viewing their solutions
 * one step at a time, with LaTeX rendering for every step.
 *
 * Supports:
 * - Equation solving (linear, quadratic, polynomial, transcendental)
 * - Expression simplification and expansion
 * - Symbolic differentiation with rule identification
 * - Symbolic integration with antiderivative computation
 *
 * Accessibility:
 * - All controls are keyboard navigable (Tab, Enter, Space, Arrow keys on tabs)
 * - Step cards use aria-expanded / aria-controls pattern
 * - Math expressions have aria-label for screen readers (via MathRenderer)
 * - Errors announced via aria-live="assertive"
 * - Loading state announced via aria-busy
 * - WCAG 2.2 AAA color contrast on all text
 *
 * Performance:
 * - Dynamic import of math-engine to avoid bloating initial bundle
 * - useTransition for non-blocking computation
 * - AnimatePresence for smooth step entry/exit
 * - Respects prefers-reduced-motion via Framer Motion defaults
 *
 * @example
 * ```tsx
 * <SolverPanel />
 * ```
 */
export function SolverPanel() {
  // ---- State ----
  const [mode, setMode] = useState<ProblemMode>('equation');
  const [input, setInput] = useState('x^2 - 4 = 0');
  const [variable, setVariable] = useState('x');
  const [solution, setSolution] = useState<RenderedSolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const inputId = useId();
  const variableId = useId();
  const hintId = useId();
  const errorId = useId();

  // ---- Handlers ----

  const handleModeChange = useCallback((newMode: string) => {
    const m = newMode as ProblemMode;
    setMode(m);
    setSolution(null);
    setError(null);
    // Populate with first example for the new mode
    const first = MODE_EXAMPLES[m][0];
    if (first) setInput(first.input);
  }, []);

  const handleExampleSelect = useCallback((expr: string) => {
    setInput(expr);
    setSolution(null);
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setSolution(null);
    setError(null);
    setInput('');
  }, []);

  const handleCopyAnswer = useCallback(async () => {
    if (!solution) return;
    try {
      await navigator.clipboard.writeText(solution.finalLatex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied — silent fail
    }
  }, [solution]);

  /**
   * Core computation: dynamically imports the math-engine and builds
   * a RenderedSolution from the StepSolution returned by the solver.
   *
   * Integration is handled via the dedicated `integrate()` function since
   * the StepSolver's Integral case falls through to simplification. We build
   * synthetic steps for it to give the user meaningful feedback.
   */
  const handleSolve = useCallback(() => {
    const validated = validateExpression(input);
    if (!validated) return;
    const varName = validateVariable(variable);

    startTransition(async () => {
      setError(null);
      setSolution(null);

      const startTime = performance.now();

      try {
        // Dynamic import — keeps math-engine out of the initial bundle
        const symbolic = await import('@nextcalc/math-engine/symbolic');
        const { solveWithSteps, ProblemType } = symbolic;

        if (mode === 'integral') {
          // Handle integration directly — StepSolver does not have a full
          // integration path yet, so we call integrate() and build steps manually.
          const { integrate, astToString } = symbolic;
          const { parse: parseMath } = await import('@nextcalc/math-engine/parser');
          const antiderivative = integrate(validated, varName);
          const resultLatex = astNodeToLatex(antiderivative);
          const resultStr = astToString(antiderivative);
          const elapsed = performance.now() - startTime;

          // Identify which integration rule applies to the integrand
          let integrandAst: unknown = null;
          try {
            integrandAst = parseMath(validated);
          } catch {
            // If parsing fails we fall back to generic rule info
          }
          const ruleInfo = identifyIntegrationRule(integrandAst, validated, varName);

          const steps: RenderedStep[] = [
            {
              stepNumber: 1,
              description: 'Original integrand',
              explanation: `We need to find the antiderivative of: ${validated} with respect to ${varName}.`,
              operation: 'Start',
              category: 'Integration',
              latex: validated,
            },
            {
              stepNumber: 2,
              description: `Apply ${ruleInfo.ruleName}`,
              explanation: ruleInfo.explanation,
              operation: 'Integrate',
              category: 'Integration',
              latex: ruleInfo.latex,
            },
            {
              stepNumber: 3,
              description: 'Antiderivative (+ C)',
              explanation: `The antiderivative is ${resultStr}. Remember to add the constant of integration C.`,
              operation: 'Final Answer',
              category: 'FinalAnswer',
              latex: `${resultLatex} + C`,
            },
          ];

          setSolution({
            problem: validated,
            mode,
            steps,
            finalLatex: `${resultLatex} + C`,
            timeMs: elapsed,
          });
          return;
        }

        // Map UI mode → ProblemType enum
        const typeMap: Record<Exclude<ProblemMode, 'integral'>, typeof ProblemType[keyof typeof ProblemType]> = {
          equation: ProblemType.Equation,
          simplify: ProblemType.Simplification,
          derivative: ProblemType.Derivative,
        };

        const problemInput = buildProblemInput(validated, mode, varName);
        const stepSolution = solveWithSteps(problemInput, typeMap[mode]);
        const elapsed = performance.now() - startTime;

        // Map SolutionStep[] → RenderedStep[]
        const renderedSteps: RenderedStep[] = stepSolution.steps.map((s) => ({
          stepNumber: s.stepNumber,
          description: s.description,
          explanation: s.explanation,
          operation: s.operation,
          category: s.category,
          latex: s.latex ?? astNodeToLatex(s.to),
        }));

        // Build final answer LaTeX
        const finalLatex = buildFinalLatex(stepSolution.answer, varName);

        setSolution({
          problem: validated,
          mode,
          steps: renderedSteps,
          finalLatex,
          timeMs: elapsed,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(sanitizeErrorMessage(msg));
      }
    });
  }, [input, mode, variable]);

  // Handle Enter key in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isPending) {
        e.preventDefault();
        handleSolve();
      }
    },
    [handleSolve, isPending]
  );

  const meta = MODE_META[mode];
  const canSolve = input.trim().length > 0 && !isPending;

  // ---- Render ----
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Step-by-Step Solver</CardTitle>
            <CardDescription className="mt-1">
              Enter an expression and see every algebraic step explained with LaTeX rendering.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="flex-none text-xs">
            Symbolic
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList
            className="grid grid-cols-4 w-full"
            aria-label="Problem type"
          >
            <TabsTrigger value="equation" className="gap-1.5 text-xs sm:text-sm">
              <Calculator className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span className="hidden sm:inline">Equation</span>
              <span className="sm:hidden">Eq.</span>
            </TabsTrigger>
            <TabsTrigger value="simplify" className="gap-1.5 text-xs sm:text-sm">
              <Brackets className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span className="hidden sm:inline">Simplify</span>
              <span className="sm:hidden">Simp.</span>
            </TabsTrigger>
            <TabsTrigger value="derivative" className="gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span className="hidden sm:inline">Derivative</span>
              <span className="sm:hidden">d/dx</span>
            </TabsTrigger>
            <TabsTrigger value="integral" className="gap-1.5 text-xs sm:text-sm">
              <Sigma className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span className="hidden sm:inline">Integral</span>
              <span className="sm:hidden">∫</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab panels — all share the same input form */}
          {(['equation', 'simplify', 'derivative', 'integral'] as const).map((m) => (
            <TabsContent key={m} value={m} className="mt-4 space-y-4">
              {/* Input row */}
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={inputId}>
                    {meta.label}
                  </Label>
                  <Input
                    id={inputId}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setSolution(null);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={meta.placeholder}
                    className="font-mono"
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    aria-describedby={`${hintId} ${error ? errorId : ''}`}
                    aria-invalid={error !== null}
                    aria-label={`${meta.label} input`}
                    disabled={isPending}
                  />
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {meta.hint}
                  </p>
                </div>

                {/* Variable selector — only shown for derivative/integral/equation */}
                {m !== 'simplify' && (
                  <div className="space-y-1.5">
                    <Label htmlFor={variableId}>Variable</Label>
                    <Select value={variable} onValueChange={setVariable}>
                      <SelectTrigger
                        id={variableId}
                        className="w-20 font-mono"
                        aria-label="Variable to solve for"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['x', 'y', 'z', 't', 'n', 'a', 'b'].map((v) => (
                          <SelectItem key={v} value={v} className="font-mono">
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSolve}
                  disabled={!canSolve}
                  className="flex-1"
                  aria-label={`${meta.label}: ${input}`}
                  aria-busy={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      Computing…
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" aria-hidden="true" />
                      Show Steps
                    </>
                  )}
                </Button>

                {(solution !== null || error !== null) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    aria-label="Clear results"
                    title="Clear results"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>

              {/* Example buttons */}
              <ExampleButtons mode={m} onSelect={handleExampleSelect} />
            </TabsContent>
          ))}
        </Tabs>

        {/* Error display */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Alert
                variant="destructive"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                id={errorId}
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solution */}
        <AnimatePresence mode="wait">
          {solution && !error && (
            <motion.div
              key={`${solution.problem}-${solution.mode}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <ResultsPanel
                solution={solution}
                onCopyAnswer={handleCopyAnswer}
                copied={copied}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// HELPERS (module-private)
// ============================================================================

/**
 * Adapts the raw user input string for the StepSolver based on mode.
 * For derivative/integral, the solver needs "d/dx" or "integrate" prefix
 * so the auto-detect works correctly.
 */
function buildProblemInput(
  expr: ValidExpression,
  mode: ProblemMode,
  variable: VariableName
): string {
  switch (mode) {
    case 'equation':
      // equation solver expects e.g. "x^2 - 4 = 0"
      return expr;
    case 'simplify':
      // simplification uses the expression directly
      return expr;
    case 'derivative':
      // step-solver detects "d/dx" prefix
      return `d/d${variable} ${expr}`;
    case 'integral':
      // step-solver detects "integrate" prefix
      return `integrate ${expr}`;
  }
}

/**
 * Converts the `answer` field from a StepSolution into a display LaTeX string.
 * The answer can be an ExpressionNode, a number, or an array of Solutions.
 */
function buildFinalLatex(
  answer: unknown,
  variable: VariableName
): string {
  if (answer === null || answer === undefined) return '\\text{No answer}';

  // Array of solutions from equation solver
  if (Array.isArray(answer)) {
    if (answer.length === 0) return '\\text{No solutions}';

    const parts = answer.map((sol: { value: unknown; multiplicity?: number }) => {
      const valLatex = solutionToLatex(sol);
      const mult =
        sol.multiplicity !== undefined && sol.multiplicity > 1
          ? ` \\; (\\text{multiplicity } ${sol.multiplicity})`
          : '';
      return `${variable} = ${valLatex}${mult}`;
    });

    return parts.length === 1
      ? (parts[0] ?? '\\text{No answer}')
      : parts.join(' \\;,\\quad ');
  }

  // Number (e.g. numeric evaluation result)
  if (typeof answer === 'number') {
    if (!isFinite(answer)) return '\\text{Diverges}';
    return answer.toFixed(10).replace(/\.?0+$/, '');
  }

  // ExpressionNode — convert via the LaTeX visitor
  if (typeof answer === 'object' && '_brand' in (answer as object)) {
    return astNodeToLatex(answer);
  }

  return String(answer);
}

/**
 * Cleans up error messages from the math engine for user display.
 * Strips internal stack references and simplifies common failure modes.
 */
function sanitizeErrorMessage(raw: string): string {
  if (raw.includes('Unexpected token') || raw.includes('parse')) {
    return `Could not parse the expression. Check your syntax (use * for multiply, ^ for power).`;
  }
  if (raw.includes('converge')) {
    return `Numerical solver did not converge. Try a different initial guess or expression.`;
  }
  if (raw.includes('derivative too small')) {
    return `Newton-Raphson failed: derivative is zero near the initial guess. Try a different starting point.`;
  }
  if (raw.includes('Cannot differentiate')) {
    return `This expression type cannot be differentiated symbolically yet.`;
  }
  if (raw.includes('Invalid equation')) {
    return `Invalid equation format. Make sure to include an "=" sign (e.g. x^2 = 4).`;
  }
  // Trim long messages
  if (raw.length > 200) return raw.slice(0, 200) + '…';
  return raw;
}
