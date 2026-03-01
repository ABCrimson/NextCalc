/**
 * Step-by-Step Problem Solver
 *
 * Generates detailed solution steps with explanations for:
 * - Algebraic simplification
 * - Equation solving (linear, quadratic, cubic, trigonometric)
 * - Differentiation
 * - Integration
 * - Limit computation
 *
 * Each step includes:
 * - Mathematical transformation
 * - Rule applied
 * - Natural language explanation
 * - LaTeX formatting
 */

import type { ExpressionNode } from '../parser/ast';
import {
  createConstantNode,
  createOperatorNode,
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isSymbolNode,
} from '../parser/ast';
import { evaluate } from '../parser/evaluator';
import { parse } from '../parser/parser';
import { Complex, type Solution, solve } from '../solver/solve';
import { differentiate } from './differentiate';
import { analyzeExpression } from './expression-tree';
import { astToString } from './integrate';
import { expand, simplify } from './simplify';

/**
 * Solution step
 */
export interface SolutionStep {
  /** Step number */
  readonly stepNumber: number;
  /** Expression before transformation */
  readonly from: ExpressionNode;
  /** Expression after transformation */
  readonly to: ExpressionNode;
  /** Rule or operation applied */
  readonly operation: string;
  /** Brief description */
  readonly description: string;
  /** Detailed explanation */
  readonly explanation: string;
  /** Category of step */
  readonly category: StepCategory;
  /** LaTeX representation of the step */
  readonly latex?: string;
}

/**
 * Step category — drives the badge colour in the UI
 */
export enum StepCategory {
  Identification = 'Identification',
  Simplification = 'Simplification',
  Expansion = 'Expansion',
  Factorization = 'Factorization',
  Substitution = 'Substitution',
  Rearrangement = 'Rearrangement',
  Isolation = 'Isolation',
  Differentiation = 'Differentiation',
  Integration = 'Integration',
  Evaluation = 'Evaluation',
  Identity = 'Identity',
  Formula = 'Formula',
  FinalAnswer = 'FinalAnswer',
}

/**
 * Complete solution with steps
 */
export interface StepSolution {
  /** Original problem */
  readonly problem: string;
  /** Problem type */
  readonly problemType: ProblemType;
  /** All solution steps */
  readonly steps: ReadonlyArray<SolutionStep>;
  /** Final answer */
  readonly answer: ExpressionNode | number | ReadonlyArray<Solution>;
  /** Total time (for performance tracking) */
  readonly timeMs?: number;
}

/**
 * Problem type classification
 */
export enum ProblemType {
  Simplification = 'Simplification',
  Equation = 'Equation',
  Derivative = 'Derivative',
  Integral = 'Integral',
  Limit = 'Limit',
  Expansion = 'Expansion',
  Factorization = 'Factorization',
}

// ============================================================================
// EQUATION TYPE DETECTION
// ============================================================================

type EquationType =
  | 'linear'
  | 'quadratic'
  | 'cubic'
  | 'higher-polynomial'
  | 'trigonometric'
  | 'exponential'
  | 'logarithmic'
  | 'transcendental';

/**
 * Detect the degree / family of a polynomial-like residual expression.
 * The `expr` here is the LHS after moving everything to the left (LHS − RHS).
 */
function detectEquationType(expr: ExpressionNode, variable: string): EquationType {
  // Check for transcendental functions first
  const exprStr = astToString(expr);
  if (/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh)\b/.test(exprStr)) {
    return 'trigonometric';
  }
  if (/\bexp\b/.test(exprStr)) {
    return 'exponential';
  }
  if (/\b(log|ln|log10|log2)\b/.test(exprStr)) {
    return 'logarithmic';
  }

  // Polynomial degree detection by sampling
  try {
    const c0 = evalAt(expr, variable, 0);
    const c1 = evalAt(expr, variable, 1);
    const c2 = evalAt(expr, variable, 2);
    const c3 = evalAt(expr, variable, 3);
    const c4 = evalAt(expr, variable, 4);

    if (c0 === null || c1 === null || c2 === null || c3 === null || c4 === null) {
      return 'transcendental';
    }

    // Finite differences to detect degree
    const d1 = c1 - c0;
    const d2 = c2 - c1;
    const d3 = c3 - c2;
    const d4 = c4 - c3;

    // Second differences (for quadratic: constant second diff)
    const dd1 = d2 - d1;
    const dd2 = d3 - d2;
    const dd3 = d4 - d3;

    // Third differences (for cubic: constant third diff)
    const ddd1 = dd2 - dd1;
    const ddd2 = dd3 - dd2;

    const EPS = 1e-8;

    if (Math.abs(d1) < EPS && Math.abs(d2) < EPS) return 'linear'; // constant
    if (Math.abs(dd1 - dd2) < EPS && Math.abs(dd1) > EPS) return 'quadratic';
    if (Math.abs(ddd1 - ddd2) < EPS && Math.abs(ddd1) > EPS) return 'cubic';
    if (Math.abs(ddd1) > EPS) return 'higher-polynomial';

    // Fall-through: try linear
    if (Math.abs(dd1) < EPS) return 'linear';

    return 'transcendental';
  } catch {
    return 'transcendental';
  }
}

function evalAt(expr: ExpressionNode, variable: string, x: number): number | null {
  try {
    const result = evaluate(expr, { variables: { [variable]: x } });
    if (!result.success) return null;
    const v = Number(result.value);
    return isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// ============================================================================
// LATEX HELPERS
// ============================================================================

/** Convert a numeric root value to a LaTeX string (compact) */
function rootToLatex(value: number | { real: number; imag: number }, variable: string): string {
  if (typeof value === 'number') {
    // Trim trailing zeros
    const s = Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/\.?0+$/, '');
    return `${variable} = ${s}`;
  }
  const { real, imag } = value;
  const rStr = Number.isInteger(real) ? String(real) : real.toFixed(4).replace(/\.?0+$/, '');
  const iStr = Number.isInteger(Math.abs(imag))
    ? String(Math.abs(imag))
    : Math.abs(imag)
        .toFixed(4)
        .replace(/\.?0+$/, '');
  if (imag === 0) return `${variable} = ${rStr}`;
  if (real === 0) {
    return imag === 1
      ? `${variable} = i`
      : imag === -1
        ? `${variable} = -i`
        : `${variable} = ${imag > 0 ? '' : '-'}${iStr}i`;
  }
  return `${variable} = ${rStr} ${imag > 0 ? '+' : '-'} ${iStr}i`;
}

/** Format a set of solutions as a joined LaTeX string */
function solutionsToLatex(solutions: ReadonlyArray<Solution>, variable: string): string {
  if (solutions.length === 0) return '\\text{No real solutions}';
  return solutions
    .map((s) => rootToLatex(s.value as number | { real: number; imag: number }, variable))
    .join(' \\;,\\quad ');
}

/**
 * Convert an ExpressionNode to a reasonably readable LaTeX string.
 * Delegates to the astNodeToLatex visitor implemented in the UI layer —
 * but we need a self-contained version here for the engine layer.
 */
function nodeToLatex(node: ExpressionNode): string {
  if (isConstantNode(node)) {
    const v = node.value;
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    return String(v ?? '');
  }

  if (isSymbolNode(node)) return String(node.name);

  if (isOperatorNode(node)) {
    const left = nodeToLatex(node.args[0]);
    const right = nodeToLatex(node.args[1]);
    const lNode = node.args[0];
    const rNode = node.args[1];

    switch (node.op) {
      case '+':
        return `${left} + ${right}`;
      case '-':
        return `${left} - ${right}`;
      case '*': {
        const l = opNeedsParens(lNode) ? `\\left(${left}\\right)` : left;
        const r = opNeedsParens(rNode) ? `\\left(${right}\\right)` : right;
        return `${l} \\cdot ${r}`;
      }
      case '/':
        return `\\frac{${left}}{${right}}`;
      case '^': {
        const base = opNeedsParens(lNode) ? `\\left(${left}\\right)` : left;
        return `${base}^{${right}}`;
      }
      default:
        return `${left} ${node.op} ${right}`;
    }
  }

  if (isFunctionNode(node)) {
    const fn = String(node.fn ?? '');
    const args = node.args.map(nodeToLatex);
    switch (fn) {
      case 'sin':
        return `\\sin\\left(${args[0]}\\right)`;
      case 'cos':
        return `\\cos\\left(${args[0]}\\right)`;
      case 'tan':
        return `\\tan\\left(${args[0]}\\right)`;
      case 'asin':
        return `\\arcsin\\left(${args[0]}\\right)`;
      case 'acos':
        return `\\arccos\\left(${args[0]}\\right)`;
      case 'atan':
        return `\\arctan\\left(${args[0]}\\right)`;
      case 'sqrt':
        return `\\sqrt{${args[0]}}`;
      case 'exp':
        return `e^{${args[0]}}`;
      case 'log':
      case 'ln':
        return `\\ln\\left(${args[0]}\\right)`;
      case 'abs':
        return `\\left|${args[0]}\\right|`;
      // Special functions — use their standard upright notation
      case 'Si':
        return `\\operatorname{Si}\\left(${args[0]}\\right)`;
      case 'Ci':
        return `\\operatorname{Ci}\\left(${args[0]}\\right)`;
      case 'li':
        return `\\operatorname{li}\\left(${args[0]}\\right)`;
      case 'erf':
        return `\\operatorname{erf}\\left(${args[0]}\\right)`;
      default:
        return `\\operatorname{${fn}}\\left(${args.join(', ')}\\right)`;
    }
  }

  return '?';
}

function opNeedsParens(node: ExpressionNode): boolean {
  if (!isOperatorNode(node)) return false;
  return node.op === '+' || node.op === '-';
}

// ============================================================================
// MAIN SOLVER CLASS
// ============================================================================

/**
 * Step-by-step solver
 */
export class StepSolver {
  private stepCounter = 0;

  /**
   * Solve a problem with step-by-step explanation
   */
  solve(problem: string, problemType?: ProblemType): StepSolution {
    const startTime = performance.now();
    this.stepCounter = 0;

    const detectedType = problemType ?? this.detectProblemType(problem);

    let solution: StepSolution;

    switch (detectedType) {
      case ProblemType.Simplification:
        solution = this.solveSimplification(problem);
        break;
      case ProblemType.Equation:
        solution = this.solveEquation(problem);
        break;
      case ProblemType.Derivative:
        solution = this.solveDerivative(problem);
        break;
      case ProblemType.Expansion:
        solution = this.solveExpansion(problem);
        break;
      default:
        solution = this.solveSimplification(problem);
    }

    const endTime = performance.now();
    return { ...solution, timeMs: endTime - startTime };
  }

  // --------------------------------------------------------------------------
  // PROBLEM TYPE DETECTION
  // --------------------------------------------------------------------------

  private detectProblemType(problem: string): ProblemType {
    if (problem.includes('=') && !problem.includes('d/d')) {
      return ProblemType.Equation;
    }
    if (problem.includes('d/d') || problem.includes('derivative')) {
      return ProblemType.Derivative;
    }
    if (problem.includes('integrate') || problem.includes('∫')) {
      return ProblemType.Integral;
    }
    if (problem.includes('expand')) {
      return ProblemType.Expansion;
    }
    if (problem.includes('factor')) {
      return ProblemType.Factorization;
    }
    return ProblemType.Simplification;
  }

  // --------------------------------------------------------------------------
  // SIMPLIFICATION
  // --------------------------------------------------------------------------

  private solveSimplification(problem: string): StepSolution {
    const steps: SolutionStep[] = [];
    const expr = parse(problem);

    steps.push(
      this.createStep(
        expr,
        expr,
        'Start',
        'Original expression',
        'We begin with the given expression.',
        StepCategory.Simplification,
        nodeToLatex(expr),
      ),
    );

    const analysis = analyzeExpression(expr);
    steps.push(
      this.createStep(
        expr,
        expr,
        'Analyze',
        `Expression type: ${analysis.type}`,
        `This is a ${analysis.type.toLowerCase()} expression with ${analysis.variables.length} variable(s).`,
        StepCategory.Identification,
        nodeToLatex(expr),
      ),
    );

    const simplified = this.simplifyWithSteps(expr, steps);

    steps.push(
      this.createStep(
        simplified,
        simplified,
        'Final Answer',
        'Simplified form',
        'This is the most simplified form of the expression.',
        StepCategory.FinalAnswer,
        nodeToLatex(simplified),
      ),
    );

    return { problem, problemType: ProblemType.Simplification, steps, answer: simplified };
  }

  // --------------------------------------------------------------------------
  // EQUATION SOLVING  (the main enhancement)
  // --------------------------------------------------------------------------

  private solveEquation(problem: string): StepSolution {
    const steps: SolutionStep[] = [];
    const variable = 'x';

    // — Parse LHS and RHS —
    const eqParts = problem.split('=').map((s) => s.trim());
    if (eqParts.length !== 2) throw new Error('Invalid equation format');
    const lhsStr = eqParts[0] ?? '';
    const rhsStr = eqParts[1] ?? '';
    const lhs = parse(lhsStr);
    const rhs = parse(rhsStr);

    // Step 1: Present the equation
    steps.push(
      this.createStep(
        lhs,
        lhs,
        'Start',
        'Original equation',
        `We need to find all values of ${variable} that satisfy the equation.`,
        StepCategory.Identification,
        `${nodeToLatex(lhs)} = ${nodeToLatex(rhs)}`,
      ),
    );

    // Step 2: Move everything to the left side → LHS − RHS = 0
    const residual = createOperatorNode('-', 'subtract', [lhs, rhs] as const);
    const simplified = simplify(residual);

    const rhsIsZero = isConstantNode(rhs) && (rhs.value === 0 || rhs.value === 0n);
    if (!rhsIsZero) {
      steps.push(
        this.createStep(
          lhs,
          simplified,
          'Rearrange',
          'Move all terms to the left side',
          `Subtract ${nodeToLatex(rhs)} from both sides so the right side equals zero. ` +
            `This gives: ${nodeToLatex(simplified)} = 0.`,
          StepCategory.Rearrangement,
          `${nodeToLatex(simplified)} = 0`,
        ),
      );
    }

    // Step 3: Detect equation type and produce type-specific steps
    const eqType = detectEquationType(simplified, variable);

    steps.push(
      this.createStep(
        simplified,
        simplified,
        'Classify',
        this.equationTypeLabel(eqType),
        this.equationTypeExplanation(eqType, variable),
        StepCategory.Identification,
        `${nodeToLatex(simplified)} = 0`,
      ),
    );

    // Step 4+: Type-specific solving steps
    let solutions: ReadonlyArray<Solution>;

    switch (eqType) {
      case 'linear':
        solutions = this.solveLinearWithSteps(simplified, variable, steps, lhsStr, rhsStr);
        break;
      case 'quadratic':
        solutions = this.solveQuadraticWithSteps(simplified, variable, steps);
        break;
      case 'cubic':
        solutions = this.solveCubicWithSteps(simplified, variable, steps);
        break;
      case 'trigonometric':
        solutions = this.solveTrigWithSteps(simplified, variable, steps, problem);
        break;
      default:
        solutions = this.solveNumericalWithSteps(simplified, variable, steps, eqType);
        break;
    }

    // Final answer step
    const finalLatex = solutionsToLatex(solutions, variable);
    steps.push(
      this.createStep(
        simplified,
        simplified,
        'Final Answer',
        solutions.length === 0
          ? 'No real solutions'
          : solutions.length === 1
            ? '1 solution found'
            : `${solutions.length} solutions found`,
        solutions.length === 0
          ? 'This equation has no real solutions.'
          : `The solution${solutions.length > 1 ? 's are' : ' is'}: ${finalLatex}`,
        StepCategory.FinalAnswer,
        finalLatex,
      ),
    );

    return { problem, problemType: ProblemType.Equation, steps, answer: solutions };
  }

  // ---- Linear equation: ax + b = 0  →  x = -b/a ----

  private solveLinearWithSteps(
    expr: ExpressionNode,
    variable: string,
    steps: SolutionStep[],
    _lhsStr: string,
    _rhsStr: string,
  ): ReadonlyArray<Solution> {
    // Extract a, b by evaluation
    const b = evalAt(expr, variable, 0);
    const ab = evalAt(expr, variable, 1);
    if (b === null || ab === null) {
      return this.solveNumericalWithSteps(expr, variable, steps, 'linear');
    }
    const a = ab - b;

    // Step: identify coefficients
    steps.push(
      this.createStep(
        expr,
        expr,
        'Identify coefficients',
        'Extract the coefficient and constant term',
        `The equation is in the form ${variable}·a + b = 0. ` +
          `Here a = ${a} (coefficient of ${variable}) and b = ${b} (constant term).`,
        StepCategory.Identification,
        `${a} \\cdot ${variable} + \\left(${b}\\right) = 0`,
      ),
    );

    if (Math.abs(a) < 1e-10) {
      // Degenerate case
      const noSol = Math.abs(b) > 1e-10;
      steps.push(
        this.createStep(
          expr,
          expr,
          'Degenerate',
          noSol ? 'No solutions' : 'All real numbers are solutions',
          noSol
            ? `The coefficient of ${variable} is 0 and the constant ${b} ≠ 0, so there is no solution.`
            : 'Both coefficients are 0, so every value of ${variable} is a solution.',
          StepCategory.FinalAnswer,
          noSol ? '\\text{No solution}' : `${variable} \\in \\mathbb{R}`,
        ),
      );
      return solve(expr, variable);
    }

    // Step: isolate the variable term
    steps.push(
      this.createStep(
        expr,
        expr,
        'Isolate',
        `Isolate the ${variable} term`,
        `Subtract the constant term from both sides: ${a} ${variable} = ${-b}.`,
        StepCategory.Isolation,
        `${a} ${variable} = ${-b}`,
      ),
    );

    // Step: divide by coefficient
    const xVal = -b / a;
    const xLatex = Number.isInteger(xVal) ? String(xVal) : `\\frac{${-b}}{${a}}`;

    steps.push(
      this.createStep(
        expr,
        createConstantNode(xVal),
        'Divide',
        `Divide both sides by ${a}`,
        `Dividing both sides of the equation by the coefficient ${a} isolates ${variable}: ${variable} = ${xVal}.`,
        StepCategory.Isolation,
        `${variable} = ${xLatex}`,
      ),
    );

    return [{ value: xVal, multiplicity: 1 }];
  }

  // ---- Quadratic equation: ax² + bx + c = 0 ----

  private solveQuadraticWithSteps(
    expr: ExpressionNode,
    variable: string,
    steps: SolutionStep[],
  ): ReadonlyArray<Solution> {
    // Extract a, b, c by evaluation
    const c = evalAt(expr, variable, 0);
    const v1 = evalAt(expr, variable, 1);
    const v2 = evalAt(expr, variable, 2);
    if (c === null || v1 === null || v2 === null) {
      return this.solveNumericalWithSteps(expr, variable, steps, 'quadratic');
    }
    const a = (v2 + c - 2 * v1) / 2;
    const b = v1 - c - a;

    // Step: identify coefficients
    const aStr = formatCoeff(a);
    const bStr = formatCoeff(b);
    const cStr = formatCoeff(c);
    steps.push(
      this.createStep(
        expr,
        expr,
        'Identify coefficients',
        'Extract quadratic coefficients a, b, c',
        `The equation is in standard form a${variable}² + b${variable} + c = 0. ` +
          `Here a = ${a}, b = ${b}, c = ${c}.`,
        StepCategory.Identification,
        `${aStr}${variable}^{2} ${b >= 0 ? '+' : ''} ${bStr}${variable} ${c >= 0 ? '+' : ''} ${cStr} = 0`,
      ),
    );

    // Step: try factoring (integer roots only)
    const discriminant = b * b - 4 * a * c;
    const sqrtD = Math.sqrt(Math.max(0, discriminant));
    const root1 = (-b + sqrtD) / (2 * a);
    const root2 = (-b - sqrtD) / (2 * a);
    const canFactor =
      discriminant >= 0 &&
      Number.isInteger(Math.round(sqrtD * 1e6) / 1e6) &&
      Math.abs(sqrtD - Math.round(sqrtD)) < 1e-9;

    if (canFactor) {
      const r1 = Math.round(root1 * 1e9) / 1e9;
      const r2 = Math.round(root2 * 1e9) / 1e9;

      // Show factoring step
      const f1Latex = `\\left(${variable} ${r1 <= 0 ? '+' : '-'} ${Math.abs(r1)}\\right)`;
      const f2Latex =
        r1 === r2 ? `^{2}` : `\\left(${variable} ${r2 <= 0 ? '+' : '-'} ${Math.abs(r2)}\\right)`;
      const aPrefix = a !== 1 ? `${a} \\cdot ` : '';

      steps.push(
        this.createStep(
          expr,
          expr,
          'Factor',
          'Factor the quadratic expression',
          `Find two numbers whose product is a·c = ${a * c} and whose sum is b = ${b}. ` +
            `The expression factors as ${a !== 1 ? `${a}·` : ''}(${variable} ${r1 <= 0 ? '+' : '−'} ${Math.abs(r1)})(${variable} ${r2 <= 0 ? '+' : '−'} ${Math.abs(r2)}).`,
          StepCategory.Factorization,
          r1 === r2 ? `${aPrefix}${f1Latex}^{2} = 0` : `${aPrefix}${f1Latex}${f2Latex} = 0`,
        ),
      );

      // Zero-product property
      if (r1 !== r2) {
        steps.push(
          this.createStep(
            expr,
            expr,
            'Zero-Product Property',
            'Set each factor equal to zero',
            `By the zero-product property, if a product equals zero then at least one factor is zero. ` +
              `So either ${variable} ${r1 <= 0 ? '+' : '−'} ${Math.abs(r1)} = 0 or ${variable} ${r2 <= 0 ? '+' : '−'} ${Math.abs(r2)} = 0.`,
            StepCategory.Isolation,
            `${variable} ${r1 <= 0 ? '+' : '-'} ${Math.abs(r1)} = 0 \\quad \\text{or} \\quad ${variable} ${r2 <= 0 ? '+' : '-'} ${Math.abs(r2)} = 0`,
          ),
        );

        steps.push(
          this.createStep(
            expr,
            expr,
            'Solve each factor',
            'Isolate the variable in each factor',
            `Solving the first factor: ${variable} = ${r1}. Solving the second factor: ${variable} = ${r2}.`,
            StepCategory.Isolation,
            `${variable} = ${r1} \\quad \\text{or} \\quad ${variable} = ${r2}`,
          ),
        );
      } else {
        steps.push(
          this.createStep(
            expr,
            expr,
            'Repeated root',
            'The quadratic has a repeated root',
            `Since the discriminant is 0, both roots are equal: ${variable} = ${r1} (multiplicity 2).`,
            StepCategory.Isolation,
            `${variable} = ${r1} \\quad (\\text{multiplicity } 2)`,
          ),
        );
      }

      const solutions: Solution[] =
        r1 === r2
          ? [{ value: r1, multiplicity: 2 }]
          : [
              { value: r1, multiplicity: 1 },
              { value: r2, multiplicity: 1 },
            ];
      return solutions;
    }

    // Cannot factor nicely → use the quadratic formula
    steps.push(
      this.createStep(
        expr,
        expr,
        'Quadratic Formula',
        'Apply the quadratic formula',
        `Since the discriminant Δ = b² − 4ac = (${b})² − 4·(${a})·(${c}) = ${discriminant} ` +
          `${discriminant >= 0 ? 'is non-negative, the formula gives real solutions' : 'is negative, the solutions are complex'}.`,
        StepCategory.Formula,
        `${variable} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} = \\frac{${-b} \\pm \\sqrt{${discriminant}}}{${2 * a}}`,
      ),
    );

    if (discriminant >= 0) {
      const sqrtVal = Math.sqrt(discriminant);
      const r1exact = (-b + sqrtVal) / (2 * a);
      const r2exact = (-b - sqrtVal) / (2 * a);

      steps.push(
        this.createStep(
          expr,
          expr,
          'Evaluate',
          'Compute both roots',
          `Substituting the values and computing: ${variable}₁ = ${r1exact.toFixed(6).replace(/\.?0+$/, '')} ` +
            `and ${variable}₂ = ${r2exact.toFixed(6).replace(/\.?0+$/, '')}.`,
          StepCategory.Evaluation,
          `${variable}_1 = ${formatDecimal(r1exact)}, \\quad ${variable}_2 = ${formatDecimal(r2exact)}`,
        ),
      );

      if (Math.abs(r1exact - r2exact) < 1e-10) {
        return [{ value: r1exact, multiplicity: 2 }];
      }
      return [
        { value: r1exact, multiplicity: 1 },
        { value: r2exact, multiplicity: 1 },
      ];
    }

    // Complex roots
    const realPart = -b / (2 * a);
    const imagPart = Math.sqrt(-discriminant) / (2 * a);

    steps.push(
      this.createStep(
        expr,
        expr,
        'Complex roots',
        'The solutions involve imaginary numbers',
        `Since the discriminant Δ = ${discriminant} < 0, the square root is imaginary. ` +
          `The two complex conjugate solutions are ${variable} = ${formatDecimal(realPart)} ± ${formatDecimal(imagPart)}i.`,
        StepCategory.Evaluation,
        `${variable} = ${formatDecimal(realPart)} \\pm ${formatDecimal(imagPart)}i`,
      ),
    );

    return [
      { value: new Complex(realPart, imagPart), multiplicity: 1 },
      { value: new Complex(realPart, -imagPart), multiplicity: 1 },
    ];
  }

  // ---- Cubic equation  ----

  private solveCubicWithSteps(
    expr: ExpressionNode,
    variable: string,
    steps: SolutionStep[],
  ): ReadonlyArray<Solution> {
    // Extract coefficients a, b, c, d from ax³ + bx² + cx + d = 0
    const d = evalAt(expr, variable, 0);
    const v1 = evalAt(expr, variable, 1);
    const v2 = evalAt(expr, variable, 2);
    const v3 = evalAt(expr, variable, 3);

    if (d === null || v1 === null || v2 === null || v3 === null) {
      return this.solveNumericalWithSteps(expr, variable, steps, 'cubic');
    }

    const a = (v3 - 3 * v2 + 3 * v1 - d) / 6;
    const b = (v2 - 2 * v1 + d) / 2 - 3 * a;
    const c = v1 - d - a - b;

    steps.push(
      this.createStep(
        expr,
        expr,
        'Identify coefficients',
        'Extract cubic coefficients a, b, c, d',
        `The equation is in standard form a${variable}³ + b${variable}² + c${variable} + d = 0 ` +
          `with a = ${formatDecimal(a)}, b = ${formatDecimal(b)}, c = ${formatDecimal(c)}, d = ${formatDecimal(d)}.`,
        StepCategory.Identification,
        `${formatCoeff(a)}${variable}^{3} + ${formatCoeff(b)}${variable}^{2} + ${formatCoeff(c)}${variable} + ${formatDecimal(d)} = 0`,
      ),
    );

    // Depressed cubic via Tschirnhaus–Vieta substitution: t = x − b/(3a)
    const p = (3 * a * c - b * b) / (3 * a * a);
    const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);

    steps.push(
      this.createStep(
        expr,
        expr,
        'Depress the cubic',
        `Substitution: ${variable} = t − b/(3a) removes the quadratic term`,
        `Substituting ${variable} = t − (${formatDecimal(b / (3 * a))}) transforms the cubic into the depressed form ` +
          `t³ + pt + q = 0 where p = ${formatDecimal(p)} and q = ${formatDecimal(q)}.`,
        StepCategory.Substitution,
        `t^3 + ${formatDecimal(p)} \\cdot t + ${formatDecimal(q)} = 0`,
      ),
    );

    // Cardano's discriminant Δ = −4p³ − 27q²
    const delta = -4 * p * p * p - 27 * q * q;

    steps.push(
      this.createStep(
        expr,
        expr,
        'Discriminant',
        'Compute the cubic discriminant',
        `Δ = −4p³ − 27q² = ${formatDecimal(delta)}. ` +
          (delta > 0
            ? 'Since Δ > 0, the cubic has three distinct real roots.'
            : delta === 0
              ? 'Since Δ = 0, the cubic has a repeated root.'
              : 'Since Δ < 0, the cubic has one real root and two complex conjugate roots.'),
        StepCategory.Identification,
        `\\Delta = -4p^3 - 27q^2 = ${formatDecimal(delta)}`,
      ),
    );

    // Delegate numerical computation to the solver for exact values
    const solutions = solve(expr, variable);

    const solutionLatex = solutions
      .map(
        (s, i) =>
          `${variable}_{${i + 1}} = ${formatDecimal(typeof s.value === 'number' ? s.value : s.value.real)}`,
      )
      .join(', \\quad ');

    steps.push(
      this.createStep(
        expr,
        expr,
        'Compute roots',
        'Solve for the roots numerically',
        `Applying Cardano's formula and back-substituting gives the roots: ` +
          solutions
            .map(
              (s) =>
                `${variable} = ${formatDecimal(typeof s.value === 'number' ? s.value : s.value.real)}`,
            )
            .join(', ') +
          '.',
        StepCategory.Evaluation,
        solutionLatex,
      ),
    );

    return solutions;
  }

  // ---- Trigonometric equation ----

  private solveTrigWithSteps(
    expr: ExpressionNode,
    variable: string,
    steps: SolutionStep[],
    _originalProblem: string,
  ): ReadonlyArray<Solution> {
    const exprStr = astToString(expr);

    // Identify the primary trig function present
    const trigMatch = exprStr.match(/\b(sin|cos|tan)\b/);
    const trigFn = trigMatch ? trigMatch[1] : 'sin';

    steps.push(
      this.createStep(
        expr,
        expr,
        'Identify trig function',
        `Equation contains ${trigFn}(${variable})`,
        `This is a trigonometric equation involving ${trigFn}(${variable}). ` +
          `We isolate the trigonometric expression and then apply the inverse ${trigFn} function.`,
        StepCategory.Identification,
        `${nodeToLatex(expr)} = 0`,
      ),
    );

    // Isolate the trig expression (heuristic description)
    steps.push(
      this.createStep(
        expr,
        expr,
        'Isolate trig expression',
        `Isolate ${trigFn}(${variable})`,
        `Rearrange the equation so that ${trigFn}(${variable}) = k for some constant k. ` +
          `Remember the domain restriction: ${
            trigFn === 'sin' || trigFn === 'cos'
              ? '|k| ≤ 1 for real solutions'
              : 'k can be any real number'
          }.`,
        StepCategory.Isolation,
        `\\${trigFn}(${variable}) = k`,
      ),
    );

    steps.push(
      this.createStep(
        expr,
        expr,
        'Apply inverse',
        `Apply arc${trigFn}`,
        `Applying arc${trigFn} to both sides gives the principal value solution. ` +
          `For the general solution, add the appropriate period: ` +
          (trigFn === 'sin'
            ? `${variable} = arcsin(k) + 2πn  or  ${variable} = π − arcsin(k) + 2πn`
            : trigFn === 'cos'
              ? `${variable} = arccos(k) + 2πn  or  ${variable} = −arccos(k) + 2πn`
              : `${variable} = arctan(k) + πn`) +
          ` (n ∈ ℤ).`,
        StepCategory.Formula,
        trigFn === 'sin'
          ? `${variable} = \\arcsin(k) + 2\\pi n \\quad \\text{or} \\quad ${variable} = \\pi - \\arcsin(k) + 2\\pi n`
          : trigFn === 'cos'
            ? `${variable} = \\arccos(k) + 2\\pi n \\quad \\text{or} \\quad ${variable} = -\\arccos(k) + 2\\pi n`
            : `${variable} = \\arctan(k) + \\pi n`,
      ),
    );

    // Numerical principal solution
    const solutions = solve(expr, variable);

    const numLatex =
      solutions.length > 0
        ? solutions
            .map(
              (s) =>
                `${variable} = ${formatDecimal(typeof s.value === 'number' ? s.value : s.value.real)}`,
            )
            .join(', \\quad ')
        : '\\text{No principal solution in this range}';

    steps.push(
      this.createStep(
        expr,
        expr,
        'Principal value',
        'Compute the principal value solution',
        `The principal value (smallest non-negative solution) found numerically: ` +
          solutions
            .map(
              (s) =>
                `${variable} ≈ ${formatDecimal(typeof s.value === 'number' ? s.value : s.value.real)}`,
            )
            .join(', ') +
          '.',
        StepCategory.Evaluation,
        numLatex,
      ),
    );

    return solutions;
  }

  // ---- Numerical fallback ----

  private solveNumericalWithSteps(
    expr: ExpressionNode,
    variable: string,
    steps: SolutionStep[],
    eqType: string,
  ): ReadonlyArray<Solution> {
    steps.push(
      this.createStep(
        expr,
        expr,
        'Numerical method',
        'Apply Newton-Raphson iteration',
        `This ${eqType} equation does not have a closed-form algebraic solution that can be derived symbolically. ` +
          `We apply Newton-Raphson iteration: ${variable}_{n+1} = ${variable}_n − f(${variable}_n)/f'(${variable}_n) ` +
          `starting from an initial guess, until |${variable}_{n+1} − ${variable}_n| < 10⁻¹⁰.`,
        StepCategory.Formula,
        `${variable}_{n+1} = ${variable}_n - \\frac{f(${variable}_n)}{f'(${variable}_n)}`,
      ),
    );

    const solutions = solve(expr, variable);

    const numLatex =
      solutions.length > 0
        ? solutions
            .map(
              (s) =>
                `${variable} = ${formatDecimal(typeof s.value === 'number' ? s.value : s.value.real)}`,
            )
            .join(', \\quad ')
        : '\\text{No convergence}';

    steps.push(
      this.createStep(
        expr,
        expr,
        'Converged',
        'Newton-Raphson converged to a solution',
        solutions.length > 0
          ? `The iteration converged in under 100 steps. ` +
              `Solutions: ${solutions.map((s) => `${variable} = ${formatDecimal(typeof s.value === 'number' ? s.value : s.value.real)}`).join(', ')}.`
          : 'The Newton-Raphson iteration did not converge for the default initial guess.',
        StepCategory.Evaluation,
        numLatex,
      ),
    );

    return solutions;
  }

  // ---- Label helpers ----

  private equationTypeLabel(type: EquationType): string {
    const labels: Record<EquationType, string> = {
      linear: 'Linear equation (degree 1)',
      quadratic: 'Quadratic equation (degree 2)',
      cubic: 'Cubic equation (degree 3)',
      'higher-polynomial': 'Higher-degree polynomial',
      trigonometric: 'Trigonometric equation',
      exponential: 'Exponential equation',
      logarithmic: 'Logarithmic equation',
      transcendental: 'Transcendental equation',
    };
    return labels[type];
  }

  private equationTypeExplanation(type: EquationType, variable: string): string {
    const explanations: Record<EquationType, string> = {
      linear: `A linear equation has exactly one solution (unless degenerate). We solve it by isolating ${variable}.`,
      quadratic: `A quadratic equation can have 0, 1, or 2 real solutions. We try factoring first; if the discriminant is not a perfect square, we apply the quadratic formula.`,
      cubic: `A cubic equation has exactly 1 or 3 real solutions. We use the Tschirnhaus-Vieta substitution to convert it to a depressed cubic and apply Cardano's formula.`,
      'higher-polynomial': `Higher-degree polynomial equations are solved numerically using Newton-Raphson iteration.`,
      trigonometric: `Trigonometric equations are solved by isolating the trig function, computing the principal value using the inverse function, and then applying the appropriate periodicity formula.`,
      exponential: `Exponential equations are solved by taking the natural logarithm of both sides.`,
      logarithmic: `Logarithmic equations are solved by exponentiating both sides with the appropriate base.`,
      transcendental: `Transcendental equations (mixing polynomials and transcendental functions) are solved numerically using Newton-Raphson iteration.`,
    };
    return explanations[type];
  }

  // --------------------------------------------------------------------------
  // DERIVATIVE
  // --------------------------------------------------------------------------

  private solveDerivative(problem: string): StepSolution {
    const steps: SolutionStep[] = [];

    const exprStr = problem
      .replace(/d\/d[a-z]\s*/g, '')
      .replace(/derivative\s+of\s+/gi, '')
      .trim();
    const expr = parse(exprStr);

    steps.push(
      this.createStep(
        expr,
        expr,
        'Start',
        'Find derivative',
        `We need to find the derivative of: ${exprStr}`,
        StepCategory.Differentiation,
        `f(x) = ${nodeToLatex(expr)}`,
      ),
    );

    const derivative = this.differentiateWithSteps(expr, 'x', steps);
    const simplified = simplify(derivative);

    if (!astEquals(derivative, simplified)) {
      steps.push(
        this.createStep(
          derivative,
          simplified,
          'Simplify',
          'Simplify the derivative',
          'Apply algebraic simplification rules.',
          StepCategory.Simplification,
          nodeToLatex(simplified),
        ),
      );
    }

    steps.push(
      this.createStep(
        simplified,
        simplified,
        'Final Answer',
        'Final derivative',
        'This is the derivative of the original function.',
        StepCategory.FinalAnswer,
        `f'(x) = ${nodeToLatex(simplified)}`,
      ),
    );

    return { problem, problemType: ProblemType.Derivative, steps, answer: simplified };
  }

  // --------------------------------------------------------------------------
  // EXPANSION
  // --------------------------------------------------------------------------

  private solveExpansion(problem: string): StepSolution {
    const steps: SolutionStep[] = [];

    const exprStr = problem.replace(/expand\s+/gi, '').trim();
    const expr = parse(exprStr);

    steps.push(
      this.createStep(
        expr,
        expr,
        'Start',
        'Expand expression',
        `We need to expand: ${exprStr}`,
        StepCategory.Expansion,
        nodeToLatex(expr),
      ),
    );

    const expanded = expand(expr);
    steps.push(
      this.createStep(
        expr,
        expanded,
        'Expand',
        'Apply distributive property',
        'Multiply out all products and apply binomial expansion where applicable.',
        StepCategory.Expansion,
        nodeToLatex(expanded),
      ),
    );

    const simplified = simplify(expanded);
    if (!astEquals(expanded, simplified)) {
      steps.push(
        this.createStep(
          expanded,
          simplified,
          'Simplify',
          'Combine like terms',
          'Collect and combine like terms.',
          StepCategory.Simplification,
          nodeToLatex(simplified),
        ),
      );
    }

    steps.push(
      this.createStep(
        simplified,
        simplified,
        'Final Answer',
        'Expanded form',
        'This is the fully expanded form.',
        StepCategory.FinalAnswer,
        nodeToLatex(simplified),
      ),
    );

    return { problem, problemType: ProblemType.Expansion, steps, answer: simplified };
  }

  // --------------------------------------------------------------------------
  // SHARED HELPERS
  // --------------------------------------------------------------------------

  private simplifyWithSteps(expr: ExpressionNode, steps: SolutionStep[]): ExpressionNode {
    const simplified = simplify(expr);
    if (!astEquals(expr, simplified)) {
      steps.push(
        this.createStep(
          expr,
          simplified,
          'Simplify',
          'Apply simplification rules',
          'Apply algebraic identities and simplification rules.',
          StepCategory.Simplification,
          nodeToLatex(simplified),
        ),
      );
    }
    return simplified;
  }

  private differentiateWithSteps(
    expr: ExpressionNode,
    variable: string,
    steps: SolutionStep[],
  ): ExpressionNode {
    const rule = this.identifyDerivativeRule(expr);
    const derivative = differentiate(expr, variable);

    steps.push(
      this.createStep(
        expr,
        derivative,
        'Differentiate',
        `Apply ${rule}`,
        this.explainDerivativeRule(expr, rule),
        StepCategory.Differentiation,
        `\\frac{d}{dx}\\left[${nodeToLatex(expr)}\\right] = ${nodeToLatex(derivative)}`,
      ),
    );

    return derivative;
  }

  private identifyDerivativeRule(expr: ExpressionNode): string {
    if (isConstantNode(expr)) return 'constant rule';
    if (isSymbolNode(expr)) return 'power rule';
    if (isOperatorNode(expr)) {
      switch (expr.op) {
        case '+':
        case '-':
          return 'sum/difference rule';
        case '*':
          return 'product rule';
        case '/':
          return 'quotient rule';
        case '^':
          return 'power rule';
        default:
          return 'derivative rule';
      }
    }
    if (isFunctionNode(expr)) {
      return `${expr.fn} derivative rule`;
    }
    return 'chain rule';
  }

  private explainDerivativeRule(_expr: ExpressionNode, rule: string): string {
    const explanations: Record<string, string> = {
      'constant rule': 'The derivative of a constant is 0.',
      'power rule': 'Apply the power rule: d/dx[x^n] = n·x^(n-1).',
      'sum/difference rule':
        'The derivative of a sum/difference is the sum/difference of derivatives.',
      'product rule': "Apply the product rule: d/dx[f·g] = f'·g + f·g'.",
      'quotient rule': "Apply the quotient rule: d/dx[f/g] = (f'·g − f·g')/g².",
      'chain rule': "Apply the chain rule: d/dx[f(g(x))] = f'(g(x))·g'(x).",
      'sin derivative rule': 'The derivative of sin(x) is cos(x).',
      'cos derivative rule': 'The derivative of cos(x) is −sin(x).',
      'tan derivative rule':
        "The derivative of tan(u) is sec\u00B2(u) \u00B7 u', by the chain rule applied to sin(u)/cos(u).",
      'asin derivative rule':
        "The derivative of arcsin(u) is u'/\u221A(1 - u\u00B2), derived from implicit differentiation of y = arcsin(u).",
      'acos derivative rule':
        "The derivative of arccos(u) is -u'/\u221A(1 - u\u00B2), the negative of the arcsin derivative.",
      'atan derivative rule':
        "The derivative of arctan(u) is u'/(1 + u\u00B2), derived from implicit differentiation of y = arctan(u).",
      'sinh derivative rule':
        "The derivative of sinh(u) is cosh(u) \u00B7 u', since d/dx[sinh(x)] = cosh(x).",
      'cosh derivative rule':
        "The derivative of cosh(u) is sinh(u) \u00B7 u', since d/dx[cosh(x)] = sinh(x).",
      'tanh derivative rule':
        "The derivative of tanh(u) is sech\u00B2(u) \u00B7 u' = (1 - tanh\u00B2(u)) \u00B7 u'.",
      'exp derivative rule': 'The derivative of e^x is e^x.',
      'log derivative rule': 'The derivative of ln(x) is 1/x.',
      'ln derivative rule': 'The derivative of ln(x) is 1/x.',
    };
    return explanations[rule] ?? `Apply the ${rule}.`;
  }

  private createStep(
    from: ExpressionNode,
    to: ExpressionNode,
    operation: string,
    description: string,
    explanation: string,
    category: StepCategory,
    latex?: string,
  ): SolutionStep {
    return {
      stepNumber: ++this.stepCounter,
      from,
      to,
      operation,
      description,
      explanation,
      category,
      ...(latex ? { latex } : {}),
    };
  }
}

// ============================================================================
// PRIVATE UTILITY FUNCTIONS
// ============================================================================

function astEquals(a: ExpressionNode, b: ExpressionNode): boolean {
  if (a.type !== b.type) return false;
  if (isConstantNode(a) && isConstantNode(b)) return a.value === b.value;
  if (isSymbolNode(a) && isSymbolNode(b)) return a.name === b.name;
  if (isOperatorNode(a) && isOperatorNode(b)) {
    return a.op === b.op && astEquals(a.args[0], b.args[0]) && astEquals(a.args[1], b.args[1]);
  }
  if (isFunctionNode(a) && isFunctionNode(b)) {
    if (a.fn !== b.fn || a.args.length !== b.args.length) return false;
    return a.args.every((arg, i) => {
      const bArg = b.args[i];
      return bArg !== undefined && astEquals(arg, bArg);
    });
  }
  return false;
}

/** Format a coefficient for LaTeX: omit 1, show −1 as − */
function formatCoeff(n: number): string {
  if (n === 1) return '';
  if (n === -1) return '-';
  return formatDecimal(n);
}

/** Compact decimal formatting — no trailing zeros */
function formatDecimal(n: number): string {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6).replace(/\.?0+$/, '');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a step solver instance
 */
export function createStepSolver(): StepSolver {
  return new StepSolver();
}

/**
 * Quick solve with steps
 */
export function solveWithSteps(problem: string, type?: ProblemType): StepSolution {
  const solver = createStepSolver();
  return solver.solve(problem, type);
}
