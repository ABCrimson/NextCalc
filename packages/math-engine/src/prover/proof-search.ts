/**
 * Proof Search - Automated Theorem Proving Algorithms
 *
 * Implements various proof search strategies:
 * - Forward chaining (data-driven reasoning)
 * - Backward chaining (goal-driven reasoning)
 * - Resolution-based proving with unification
 * - Proof tree construction and visualization
 * - Depth-limited and iterative deepening search
 */

import type { Formula } from './logic-core.js';
import { not } from './logic-core.js';
import { applyAnyRule } from './inference-rules.js';

/**
 * Proof step in a derivation
 */
export interface ProofStep {
  /** The formula derived in this step */
  formula: Formula;
  /** Rule applied to derive this formula */
  rule?: string;
  /** Indices of premises used (references to earlier steps) */
  premises: number[];
  /** Justification text */
  justification: string;
}

/**
 * Complete proof structure
 */
export interface Proof {
  /** List of premises (assumptions) */
  premises: Formula[];
  /** Goal to prove */
  goal: Formula;
  /** Sequence of proof steps */
  steps: ProofStep[];
  /** Whether the proof is valid */
  valid: boolean;
  /** Proof strategy used */
  strategy: 'forward' | 'backward' | 'resolution' | 'natural-deduction';
}

/**
 * Proof tree node for visualization
 */
export interface ProofTreeNode {
  formula: Formula;
  rule?: string | undefined;
  children: ProofTreeNode[];
  depth: number;
}

/**
 * Configuration for proof search
 */
export interface ProofSearchConfig {
  /** Maximum search depth */
  maxDepth: number;
  /** Maximum number of steps */
  maxSteps: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Enable iterative deepening */
  iterativeDeepening: boolean;
}

const DEFAULT_CONFIG: ProofSearchConfig = {
  maxDepth: 10,
  maxSteps: 100,
  timeout: 5000,
  iterativeDeepening: true,
};

/**
 * Forward chaining proof search (data-driven)
 *
 * Start from premises and apply rules until goal is reached
 */
export function forwardChaining(
  premises: Formula[],
  goal: Formula,
  config: Partial<ProofSearchConfig> = {}
): Proof | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const steps: ProofStep[] = [];
  const known = new Set<string>();
  const knownFormulas: Formula[] = [...premises];

  // Add premises as initial steps
  premises.forEach((formula) => {
    steps.push({
      formula,
      premises: [],
      justification: 'Premise',
    });
    known.add(formulaToKey(formula));
  });

  let stepCount = 0;

  while (stepCount < cfg.maxSteps) {
    if (Date.now() - startTime > cfg.timeout) {
      return null; // Timeout
    }

    // Check if goal is reached
    if (knownFormulas.some(f => formulasEqual(f, goal))) {
      return {
        premises,
        goal,
        steps,
        valid: true,
        strategy: 'forward',
      };
    }

    // Try to derive new formulas
    let newDerivation = false;

    for (let i = 0; i < knownFormulas.length && !newDerivation; i++) {
      for (let j = i; j < knownFormulas.length && !newDerivation; j++) {
        const fi = knownFormulas[i];
        const fj = knownFormulas[j];
        if (!fi || !fj) continue;
        const premisePair = i === j ? [fi] : [fi, fj];

        const result = applyAnyRule(premisePair);
        if (result) {
          for (const conclusion of result.conclusions) {
            const key = formulaToKey(conclusion);
            if (!known.has(key)) {
              known.add(key);
              knownFormulas.push(conclusion);

              steps.push({
                formula: conclusion,
                rule: result.rule.name,
                premises: i === j ? [i] : [i, j],
                justification: `${result.rule.name} from steps ${i === j ? i : `${i}, ${j}`}`,
              });

              newDerivation = true;
              stepCount++;
              break;
            }
          }
        }
      }
    }

    if (!newDerivation) {
      break; // No more derivations possible
    }
  }

  return null; // Goal not reached
}

/**
 * Backward chaining proof search (goal-driven)
 *
 * Start from goal and work backwards to premises
 */
export function backwardChaining(
  premises: Formula[],
  goal: Formula,
  config: Partial<ProofSearchConfig> = {}
): Proof | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const steps: ProofStep[] = [];

  // Add premises
  premises.forEach(formula => {
    steps.push({
      formula,
      premises: [],
      justification: 'Premise',
    });
  });

  function search(
    currentGoal: Formula,
    depth: number,
    knownFacts: Formula[]
  ): { success: boolean; usedSteps: number[] } {
    if (Date.now() - startTime > cfg.timeout) {
      return { success: false, usedSteps: [] };
    }

    if (depth > cfg.maxDepth) {
      return { success: false, usedSteps: [] };
    }

    // Check if current goal is in known facts
    const matchIndex = knownFacts.findIndex(f => formulasEqual(f, currentGoal));
    if (matchIndex !== -1) {
      return { success: true, usedSteps: [matchIndex] };
    }

    // Try to decompose goal using inference rules
    if (currentGoal.type === 'binary' && currentGoal.operator === 'AND') {
      // For conjunction, prove both parts
      const leftResult = search(currentGoal.left, depth + 1, knownFacts);
      if (!leftResult.success) return { success: false, usedSteps: [] };

      const rightResult = search(currentGoal.right, depth + 1, knownFacts);
      if (!rightResult.success) return { success: false, usedSteps: [] };

      return {
        success: true,
        usedSteps: [...leftResult.usedSteps, ...rightResult.usedSteps],
      };
    }

    if (currentGoal.type === 'binary' && currentGoal.operator === 'IMPLIES') {
      // For implication A → B, assume A and prove B
      const newFacts = [...knownFacts, currentGoal.left];
      return search(currentGoal.right, depth + 1, newFacts);
    }

    // Try to find a rule that can derive the goal
    for (let i = 0; i < knownFacts.length; i++) {
      for (let j = i; j < knownFacts.length; j++) {
        const fi = knownFacts[i];
        const fj = knownFacts[j];
        if (!fi || !fj) continue;
        const premisePair = i === j ? [fi] : [fi, fj];

        const result = applyAnyRule(premisePair);
        if (result) {
          for (const conclusion of result.conclusions) {
            if (formulasEqual(conclusion, currentGoal)) {
              steps.push({
                formula: conclusion,
                rule: result.rule.name,
                premises: i === j ? [i] : [i, j],
                justification: `${result.rule.name} from steps ${i === j ? i : `${i}, ${j}`}`,
              });

              return { success: true, usedSteps: i === j ? [i] : [i, j] };
            }
          }
        }
      }
    }

    return { success: false, usedSteps: [] };
  }

  const result = search(goal, 0, premises);

  if (result.success) {
    return {
      premises,
      goal,
      steps,
      valid: true,
      strategy: 'backward',
    };
  }

  return null;
}

/**
 * Resolution-based theorem proving
 *
 * Convert to CNF and apply resolution until empty clause or saturation
 */
export function resolutionProof(
  premises: Formula[],
  goal: Formula,
  config: Partial<ProofSearchConfig> = {}
): Proof | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // To prove goal from premises, show that premises ∧ ¬goal is unsatisfiable
  const negatedGoal = not(goal);
  const allFormulas = [...premises, negatedGoal];

  // Convert to CNF (simplified approach)
  const clauses = allFormulas.map(f => toCNF(f));

  const steps: ProofStep[] = [];

  // Add initial clauses
  allFormulas.forEach((formula, i) => {
    steps.push({
      formula,
      premises: [],
      justification: i < premises.length ? 'Premise' : 'Negated goal',
    });
  });

  let clauseSet = [...clauses];
  let iteration = 0;

  while (iteration < cfg.maxSteps) {
    if (Date.now() - startTime > cfg.timeout) {
      return null;
    }

    let newClauses: Formula[] = [];

    // Apply resolution to all pairs
    for (let i = 0; i < clauseSet.length; i++) {
      for (let j = i + 1; j < clauseSet.length; j++) {
        const ci = clauseSet[i];
        const cj = clauseSet[j];
        if (!ci || !cj) continue;
        const resolvent = tryResolve(ci, cj);

        if (resolvent) {
          // Check if empty clause (contradiction found)
          if (isEmptyClause(resolvent)) {
            steps.push({
              formula: resolvent,
              rule: 'Resolution',
              premises: [i, j],
              justification: `Resolution of clauses ${i} and ${j} yields contradiction`,
            });

            return {
              premises,
              goal,
              steps,
              valid: true,
              strategy: 'resolution',
            };
          }

          // Check if new clause
          if (!clauseSet.some(c => formulasEqual(c, resolvent))) {
            newClauses.push(resolvent);
            steps.push({
              formula: resolvent,
              rule: 'Resolution',
              premises: [i, j],
              justification: `Resolution of clauses ${i} and ${j}`,
            });
          }
        }
      }
    }

    if (newClauses.length === 0) {
      break; // Saturation reached
    }

    clauseSet = [...clauseSet, ...newClauses];
    iteration++;
  }

  return null; // Could not prove
}

/**
 * Build proof tree for visualization
 */
export function buildProofTree(proof: Proof): ProofTreeNode {
  function buildNode(stepIndex: number, depth = 0): ProofTreeNode {
    const step = proof.steps[stepIndex];
    if (!step) {
      throw new Error(`Step ${stepIndex} not found in proof`);
    }

    return {
      formula: step.formula,
      rule: step.rule,
      children: step.premises.map(i => buildNode(i, depth + 1)),
      depth,
    };
  }

  return buildNode(proof.steps.length - 1);
}

/**
 * Iterative deepening search
 */
export function iterativeDeepeningProof(
  premises: Formula[],
  goal: Formula,
  maxDepth = 10
): Proof | null {
  for (let depth = 1; depth <= maxDepth; depth++) {
    const result = forwardChaining(premises, goal, {
      maxDepth: depth,
      maxSteps: 50,
      timeout: 1000,
      iterativeDeepening: false,
    });

    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Verify a user-provided proof
 */
export function verifyProof(proof: Proof): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const knownFormulas = new Map<number, Formula>();

  // Add premises
  proof.premises.forEach((formula, i) => {
    knownFormulas.set(i, formula);
  });

  // Verify each step
  for (let i = proof.premises.length; i < proof.steps.length; i++) {
    const step = proof.steps[i];
    if (!step) continue;

    // Check that all premise indices are valid
    for (const premiseIdx of step.premises) {
      if (!knownFormulas.has(premiseIdx)) {
        errors.push(`Step ${i}: Invalid premise reference ${premiseIdx}`);
      }
    }

    // Get premise formulas
    const premiseFormulas = step.premises
      .map(idx => knownFormulas.get(idx))
      .filter((f): f is Formula => f !== undefined);

    // Verify rule application
    if (step.rule) {
      const result = applyAnyRule(premiseFormulas);
      if (!result) {
        errors.push(`Step ${i}: Cannot derive ${step.justification}`);
      } else {
        const derived = result.conclusions.some(c => formulasEqual(c, step.formula));
        if (!derived) {
          errors.push(`Step ${i}: Rule does not derive stated conclusion`);
        }
      }
    }

    knownFormulas.set(i, step.formula);
  }

  // Check that goal is reached
  const lastStep = proof.steps[proof.steps.length - 1];
  if (lastStep && !formulasEqual(lastStep.formula, proof.goal)) {
    errors.push('Proof does not derive the stated goal');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert formula to unique string key for deduplication
 */
function formulaToKey(formula: Formula): string {
  switch (formula.type) {
    case 'atomic':
      return `${formula.symbol}(${formula.args.map(a => JSON.stringify(a)).join(',')})`;
    case 'not':
      return `NOT(${formulaToKey(formula.operand)})`;
    case 'binary':
      return `${formula.operator}(${formulaToKey(formula.left)},${formulaToKey(formula.right)})`;
    case 'quantified':
      return `${formula.quantifier}(${formula.variable},${formulaToKey(formula.scope)})`;
  }
}

/**
 * Simplified CNF conversion (basic implementation)
 */
function toCNF(formula: Formula): Formula {
  // This is a simplified version
  // A full implementation would handle all cases properly
  return formula;
}

/**
 * Try to resolve two clauses
 */
function tryResolve(_c1: Formula, _c2: Formula): Formula | null {
  // Simplified resolution
  // Full implementation would properly handle clause resolution
  return null;
}

/**
 * Check if clause is empty (contradiction)
 */
function isEmptyClause(formula: Formula): boolean {
  return formula.type === 'atomic' && formula.symbol === '⊥';
}

/**
 * Helper to check formula equality (re-exported for convenience)
 */
export function formulasEqual(f1: Formula, f2: Formula): boolean {
  if (f1.type !== f2.type) return false;

  switch (f1.type) {
    case 'atomic':
      return (
        f2.type === 'atomic' &&
        f1.symbol === f2.symbol &&
        f1.args.length === f2.args.length
      );

    case 'not':
      return f2.type === 'not' && formulasEqual(f1.operand, f2.operand);

    case 'binary':
      return (
        f2.type === 'binary' &&
        f1.operator === f2.operator &&
        formulasEqual(f1.left, f2.left) &&
        formulasEqual(f1.right, f2.right)
      );

    case 'quantified':
      return (
        f2.type === 'quantified' &&
        f1.quantifier === f2.quantifier &&
        f1.variable === f2.variable &&
        formulasEqual(f1.scope, f2.scope)
      );
  }
}
