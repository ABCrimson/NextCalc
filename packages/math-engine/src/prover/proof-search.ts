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

import { applyAnyRule } from './inference-rules';
import type { Formula } from './logic-core';
import { LogicalOperator, not } from './logic-core';

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
  config: Partial<ProofSearchConfig> = {},
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

  /**
   * Helper: register a newly derived formula if it is not already known.
   * Returns true if the formula was new.
   */
  function addDerived(formula: Formula, ruleName: string, premiseIndices: number[]): boolean {
    const key = formulaToKey(formula);
    if (known.has(key)) return false;
    known.add(key);
    knownFormulas.push(formula);
    steps.push({
      formula,
      rule: ruleName,
      premises: premiseIndices,
      justification: `${ruleName} from steps ${premiseIndices.join(', ')}`,
    });
    return true;
  }

  let stepCount = 0;

  while (stepCount < cfg.maxSteps) {
    if (Date.now() - startTime > cfg.timeout) {
      return null; // Timeout
    }

    // Check if goal is reached
    if (knownFormulas.some((f) => formulasEqual(f, goal))) {
      return {
        premises,
        goal,
        steps,
        valid: true,
        strategy: 'forward',
      };
    }

    // Try to derive new formulas — exhaustively scan all pairs in this round
    let newDerivation = false;
    const currentLen = knownFormulas.length;

    for (let i = 0; i < currentLen && stepCount < cfg.maxSteps; i++) {
      for (let j = i; j < currentLen && stepCount < cfg.maxSteps; j++) {
        if (Date.now() - startTime > cfg.timeout) return null;

        const fi = knownFormulas[i];
        const fj = knownFormulas[j];
        if (!fi || !fj) continue;

        // --- Standard inference rule application (both orderings) ---
        const pairs: Array<{ pair: Formula[]; indices: number[] }> = [
          { pair: i === j ? [fi] : [fi, fj], indices: i === j ? [i] : [i, j] },
        ];
        // Also try reversed order so rules like Modus Ponens that care about
        // argument position can fire in either direction.
        if (i !== j) {
          pairs.push({ pair: [fj, fi], indices: [j, i] });
        }

        for (const { pair, indices } of pairs) {
          const result = applyAnyRule(pair);
          if (result) {
            for (const conclusion of result.conclusions) {
              if (addDerived(conclusion, result.rule.name, indices)) {
                newDerivation = true;
                stepCount++;
              }
            }
          }
        }

        // --- Double-negation elimination: ¬¬A → A ---
        if (i === j && fi.type === 'not' && fi.operand.type === 'not') {
          if (addDerived(fi.operand.operand, 'Double Negation Elimination', [i])) {
            newDerivation = true;
            stepCount++;
          }
        }

        // --- Modus Tollens with explicit detection ---
        // We already have it in inference rules, but also try contrapositive
        // derivation: from A → B derive ¬B → ¬A
        if (i === j && fi.type === 'binary' && fi.operator === LogicalOperator.IMPLIES) {
          const contrapositive: Formula = {
            type: 'binary',
            operator: LogicalOperator.IMPLIES,
            left: not(fi.right),
            right: not(fi.left),
          };
          if (addDerived(contrapositive, 'Contrapositive', [i])) {
            newDerivation = true;
            stepCount++;
          }
        }

        // --- Biconditional elimination: A ↔ B → (A → B) and (B → A) ---
        if (i === j && fi.type === 'binary' && fi.operator === LogicalOperator.IFF) {
          const lr: Formula = {
            type: 'binary',
            operator: LogicalOperator.IMPLIES,
            left: fi.left,
            right: fi.right,
          };
          const rl: Formula = {
            type: 'binary',
            operator: LogicalOperator.IMPLIES,
            left: fi.right,
            right: fi.left,
          };
          if (addDerived(lr, 'Biconditional Elimination', [i])) {
            newDerivation = true;
            stepCount++;
          }
          if (addDerived(rl, 'Biconditional Elimination', [i])) {
            newDerivation = true;
            stepCount++;
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
  config: Partial<ProofSearchConfig> = {},
): Proof | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const steps: ProofStep[] = [];

  // Add premises
  premises.forEach((formula) => {
    steps.push({
      formula,
      premises: [],
      justification: 'Premise',
    });
  });

  /** Track formulas already being pursued to avoid infinite loops. */
  const pursuing = new Set<string>();

  function search(
    currentGoal: Formula,
    depth: number,
    knownFacts: Formula[],
  ): { success: boolean; usedSteps: number[] } {
    if (Date.now() - startTime > cfg.timeout) {
      return { success: false, usedSteps: [] };
    }

    if (depth > cfg.maxDepth) {
      return { success: false, usedSteps: [] };
    }

    // Avoid re-entering on the same goal (prevents cycles)
    const goalKey = formulaToKey(currentGoal);
    if (pursuing.has(goalKey)) {
      return { success: false, usedSteps: [] };
    }
    pursuing.add(goalKey);

    try {
      return searchInner(currentGoal, depth, knownFacts);
    } finally {
      pursuing.delete(goalKey);
    }
  }

  function searchInner(
    currentGoal: Formula,
    depth: number,
    knownFacts: Formula[],
  ): { success: boolean; usedSteps: number[] } {
    // Check if current goal is in known facts
    const matchIndex = knownFacts.findIndex((f) => formulasEqual(f, currentGoal));
    if (matchIndex !== -1) {
      return { success: true, usedSteps: [matchIndex] };
    }

    // --- Decompose goal based on its structure ---

    // AND: prove both conjuncts independently
    if (currentGoal.type === 'binary' && currentGoal.operator === LogicalOperator.AND) {
      const leftResult = search(currentGoal.left, depth + 1, knownFacts);
      if (!leftResult.success) return { success: false, usedSteps: [] };

      const rightResult = search(currentGoal.right, depth + 1, knownFacts);
      if (!rightResult.success) return { success: false, usedSteps: [] };

      return {
        success: true,
        usedSteps: [...leftResult.usedSteps, ...rightResult.usedSteps],
      };
    }

    // IMPLIES: assume antecedent and prove consequent
    if (currentGoal.type === 'binary' && currentGoal.operator === LogicalOperator.IMPLIES) {
      const newFacts = [...knownFacts, currentGoal.left];
      return search(currentGoal.right, depth + 1, newFacts);
    }

    // OR: try to prove either disjunct
    if (currentGoal.type === 'binary' && currentGoal.operator === LogicalOperator.OR) {
      const leftResult = search(currentGoal.left, depth + 1, knownFacts);
      if (leftResult.success) return leftResult;

      const rightResult = search(currentGoal.right, depth + 1, knownFacts);
      if (rightResult.success) return rightResult;
    }

    // IFF: decompose into two implications and prove both
    if (currentGoal.type === 'binary' && currentGoal.operator === LogicalOperator.IFF) {
      const lr: Formula = {
        type: 'binary',
        operator: LogicalOperator.IMPLIES,
        left: currentGoal.left,
        right: currentGoal.right,
      };
      const rl: Formula = {
        type: 'binary',
        operator: LogicalOperator.IMPLIES,
        left: currentGoal.right,
        right: currentGoal.left,
      };
      const lrResult = search(lr, depth + 1, knownFacts);
      if (lrResult.success) {
        const rlResult = search(rl, depth + 1, knownFacts);
        if (rlResult.success) {
          return {
            success: true,
            usedSteps: [...lrResult.usedSteps, ...rlResult.usedSteps],
          };
        }
      }
    }

    // NOT-NOT: to prove ¬¬A, prove A (double negation introduction)
    if (currentGoal.type === 'not' && currentGoal.operand.type === 'not') {
      return search(currentGoal.operand.operand, depth + 1, knownFacts);
    }

    // --- Try modus ponens backward: to prove B, find A → B and then prove A ---
    for (let i = 0; i < knownFacts.length; i++) {
      const fi = knownFacts[i];
      if (!fi) continue;

      if (fi.type === 'binary' && fi.operator === LogicalOperator.IMPLIES) {
        if (formulasEqual(fi.right, currentGoal)) {
          const antecedentResult = search(fi.left, depth + 1, knownFacts);
          if (antecedentResult.success) {
            steps.push({
              formula: currentGoal,
              rule: 'Modus Ponens (backward)',
              premises: [...antecedentResult.usedSteps, i],
              justification: `Modus Ponens (backward) from steps ${[...antecedentResult.usedSteps, i].join(', ')}`,
            });
            return { success: true, usedSteps: [...antecedentResult.usedSteps, i] };
          }
        }
      }
    }

    // --- Conjunction elimination: if goal is part of a known conjunction ---
    for (let i = 0; i < knownFacts.length; i++) {
      const fi = knownFacts[i];
      if (!fi || fi.type !== 'binary' || fi.operator !== LogicalOperator.AND) continue;

      if (formulasEqual(fi.left, currentGoal) || formulasEqual(fi.right, currentGoal)) {
        steps.push({
          formula: currentGoal,
          rule: 'Conjunction Elimination',
          premises: [i],
          justification: `Conjunction Elimination from step ${i}`,
        });
        return { success: true, usedSteps: [i] };
      }
    }

    // --- Double negation elimination on known facts ---
    for (let i = 0; i < knownFacts.length; i++) {
      const fi = knownFacts[i];
      if (!fi) continue;

      if (fi.type === 'not' && fi.operand.type === 'not') {
        if (formulasEqual(fi.operand.operand, currentGoal)) {
          steps.push({
            formula: currentGoal,
            rule: 'Double Negation Elimination',
            premises: [i],
            justification: `Double Negation Elimination from step ${i}`,
          });
          return { success: true, usedSteps: [i] };
        }
      }
    }

    // --- Try to find a rule that can derive the goal from known facts ---
    for (let i = 0; i < knownFacts.length; i++) {
      for (let j = i; j < knownFacts.length; j++) {
        const fi = knownFacts[i];
        const fj = knownFacts[j];
        if (!fi || !fj) continue;

        // Try both orderings so position-sensitive rules fire
        const pairs: Array<{ pair: Formula[]; indices: number[] }> = [
          { pair: i === j ? [fi] : [fi, fj], indices: i === j ? [i] : [i, j] },
        ];
        if (i !== j) {
          pairs.push({ pair: [fj, fi], indices: [j, i] });
        }

        for (const { pair, indices } of pairs) {
          const result = applyAnyRule(pair);
          if (result) {
            for (const conclusion of result.conclusions) {
              if (formulasEqual(conclusion, currentGoal)) {
                steps.push({
                  formula: conclusion,
                  rule: result.rule.name,
                  premises: indices,
                  justification: `${result.rule.name} from steps ${indices.join(', ')}`,
                });
                return { success: true, usedSteps: indices };
              }
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
  config: Partial<ProofSearchConfig> = {},
): Proof | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // To prove goal from premises, show that premises ∧ ¬goal is unsatisfiable
  const negatedGoal = not(goal);
  const allFormulas = [...premises, negatedGoal];

  // Convert each formula to CNF, then flatten top-level AND conjunctions into
  // individual clauses.  A CNF formula is a conjunction of disjunctive clauses;
  // resolution operates on individual clauses, not on the whole conjunction.
  const clauses = allFormulas.flatMap((f) => flattenCNF(toCNF(f)));

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

    const newClauses: Formula[] = [];

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
          if (!clauseSet.some((c) => formulasEqual(c, resolvent))) {
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
      children: step.premises.map((i) => buildNode(i, depth + 1)),
      depth,
    };
  }

  return buildNode(proof.steps.length - 1);
}

/**
 * Iterative deepening search
 *
 * Tries both forward chaining (data-driven) and backward chaining (goal-driven)
 * at each depth level.  Backward chaining is often more efficient for goal-directed
 * proofs, while forward chaining can discover useful intermediate lemmas.
 */
export function iterativeDeepeningProof(
  premises: Formula[],
  goal: Formula,
  maxDepth = 10,
): Proof | null {
  for (let depth = 1; depth <= maxDepth; depth++) {
    // Try backward chaining first (goal-driven is usually more efficient)
    const backResult = backwardChaining(premises, goal, {
      maxDepth: depth,
      maxSteps: 50,
      timeout: 1000,
      iterativeDeepening: false,
    });
    if (backResult) return backResult;

    // Then try forward chaining
    const fwdResult = forwardChaining(premises, goal, {
      maxDepth: depth,
      maxSteps: 50,
      timeout: 1000,
      iterativeDeepening: false,
    });
    if (fwdResult) return fwdResult;
  }

  // Final attempt: resolution (which is refutation-complete for propositional logic)
  const resResult = resolutionProof(premises, goal, {
    maxSteps: 200,
    timeout: 3000,
  });
  if (resResult) return resResult;

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
      .map((idx) => knownFormulas.get(idx))
      .filter((f): f is Formula => f !== undefined);

    // Verify rule application
    if (step.rule) {
      const result = applyAnyRule(premiseFormulas);
      if (!result) {
        errors.push(`Step ${i}: Cannot derive ${step.justification}`);
      } else {
        const derived = result.conclusions.some((c) => formulasEqual(c, step.formula));
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
      return `${formula.symbol}(${formula.args.map((a) => JSON.stringify(a)).join(',')})`;
    case 'not':
      return `NOT(${formulaToKey(formula.operand)})`;
    case 'binary':
      return `${formula.operator}(${formulaToKey(formula.left)},${formulaToKey(formula.right)})`;
    case 'quantified':
      return `${formula.quantifier}(${formula.variable},${formulaToKey(formula.scope)})`;
  }
}

/**
 * Convert an arbitrary propositional formula to Conjunctive Normal Form (CNF).
 *
 * The transformation proceeds through five standard stages:
 *   1. Eliminate biconditionals  (A ↔ B  →  (A → B) ∧ (B → A))
 *   2. Eliminate implications    (A → B  →  ¬A ∨ B)
 *   3. Push negations inward     (De Morgan's laws + double-negation elimination)
 *   4. Distribute OR over AND    (A ∨ (B ∧ C)  →  (A ∨ B) ∧ (A ∨ C))
 *
 * Quantified sub-formulas are treated as opaque atoms (first-order CNF
 * would require Skolemisation, which is out of scope here).
 */
function toCNF(formula: Formula): Formula {
  return distribute(pushNegations(eliminateImplications(eliminateBiconditionals(formula))));
}

/**
 * Stage 1 – eliminate biconditionals.
 * A ↔ B  →  (A → B) ∧ (B → A)
 */
function eliminateBiconditionals(f: Formula): Formula {
  switch (f.type) {
    case 'atomic':
      return f;

    case 'not':
      return { type: 'not', operand: eliminateBiconditionals(f.operand) };

    case 'binary': {
      const left = eliminateBiconditionals(f.left);
      const right = eliminateBiconditionals(f.right);

      if (f.operator === LogicalOperator.IFF) {
        // (A ↔ B)  →  (A → B) ∧ (B → A)
        return {
          type: 'binary',
          operator: LogicalOperator.AND,
          left: { type: 'binary', operator: LogicalOperator.IMPLIES, left, right },
          right: { type: 'binary', operator: LogicalOperator.IMPLIES, left: right, right: left },
        };
      }

      return { type: 'binary', operator: f.operator, left, right };
    }

    case 'quantified':
      // Treat quantified sub-formulas as atoms for propositional CNF.
      return f;
  }
}

/**
 * Stage 2 – eliminate implications.
 * A → B  →  ¬A ∨ B
 * Must be called after eliminateBiconditionals (no IFF nodes remain).
 */
function eliminateImplications(f: Formula): Formula {
  switch (f.type) {
    case 'atomic':
      return f;

    case 'not':
      return { type: 'not', operand: eliminateImplications(f.operand) };

    case 'binary': {
      const left = eliminateImplications(f.left);
      const right = eliminateImplications(f.right);

      if (f.operator === LogicalOperator.IMPLIES) {
        // A → B  →  ¬A ∨ B
        return {
          type: 'binary',
          operator: LogicalOperator.OR,
          left: { type: 'not', operand: left },
          right,
        };
      }

      return { type: 'binary', operator: f.operator, left, right };
    }

    case 'quantified':
      return f;
  }
}

/**
 * Stage 3 – push negations inward (NNF).
 * Applies De Morgan's laws and eliminates double negations.
 * Must be called after eliminateImplications (no IMPLIES / IFF nodes remain).
 */
function pushNegations(f: Formula): Formula {
  switch (f.type) {
    case 'atomic':
      return f;

    case 'not': {
      const inner = f.operand;

      switch (inner.type) {
        case 'not':
          // ¬¬A  →  A
          return pushNegations(inner.operand);

        case 'binary': {
          if (inner.operator === LogicalOperator.AND) {
            // ¬(A ∧ B)  →  ¬A ∨ ¬B
            return pushNegations({
              type: 'binary',
              operator: LogicalOperator.OR,
              left: { type: 'not', operand: inner.left },
              right: { type: 'not', operand: inner.right },
            });
          }

          if (inner.operator === LogicalOperator.OR) {
            // ¬(A ∨ B)  →  ¬A ∧ ¬B
            return pushNegations({
              type: 'binary',
              operator: LogicalOperator.AND,
              left: { type: 'not', operand: inner.left },
              right: { type: 'not', operand: inner.right },
            });
          }

          // IMPLIES / IFF should have been eliminated already; fall through
          // and keep negation on the surface for safety.
          return { type: 'not', operand: pushNegations(inner) };
        }

        case 'atomic':
        case 'quantified':
          // ¬atom or ¬quantified — already a literal, nothing to push
          return { type: 'not', operand: inner };
      }
    }

    case 'binary': {
      const left = pushNegations(f.left);
      const right = pushNegations(f.right);
      return { type: 'binary', operator: f.operator, left, right };
    }

    case 'quantified':
      return f;
  }
}

/**
 * Stage 4 – distribute OR over AND.
 * Converts a formula already in NNF to CNF by applying:
 *   A ∨ (B ∧ C)  →  (A ∨ B) ∧ (A ∨ C)
 *   (A ∧ B) ∨ C  →  (A ∨ C) ∧ (B ∨ C)
 */
function distribute(f: Formula): Formula {
  switch (f.type) {
    case 'atomic':
    case 'not':
    case 'quantified':
      return f;

    case 'binary': {
      if (f.operator === LogicalOperator.AND) {
        // AND: recursively distribute children, AND is already a CNF connective
        return {
          type: 'binary',
          operator: LogicalOperator.AND,
          left: distribute(f.left),
          right: distribute(f.right),
        };
      }

      if (f.operator === LogicalOperator.OR) {
        const left = distribute(f.left);
        const right = distribute(f.right);

        // left is a conjunction — distribute OR into it
        if (left.type === 'binary' && left.operator === LogicalOperator.AND) {
          return distribute({
            type: 'binary',
            operator: LogicalOperator.AND,
            left: { type: 'binary', operator: LogicalOperator.OR, left: left.left, right },
            right: { type: 'binary', operator: LogicalOperator.OR, left: left.right, right },
          });
        }

        // right is a conjunction — distribute OR into it
        if (right.type === 'binary' && right.operator === LogicalOperator.AND) {
          return distribute({
            type: 'binary',
            operator: LogicalOperator.AND,
            left: { type: 'binary', operator: LogicalOperator.OR, left, right: right.left },
            right: { type: 'binary', operator: LogicalOperator.OR, left, right: right.right },
          });
        }

        // Neither side is a conjunction — already in clause form
        return { type: 'binary', operator: LogicalOperator.OR, left, right };
      }

      // IMPLIES / IFF should not be present after earlier stages; preserve
      return {
        type: 'binary',
        operator: f.operator,
        left: distribute(f.left),
        right: distribute(f.right),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a CNF formula (a conjunction of clauses) into an array of individual
 * clauses.  AND nodes at the top level are recursively split; anything that is
 * not an AND node is treated as a single clause.
 *
 * @example
 *   flattenCNF((A ∨ B) ∧ (¬A ∨ C))  →  [A ∨ B, ¬A ∨ C]
 *   flattenCNF(A)                    →  [A]
 */
function flattenCNF(f: Formula): Formula[] {
  if (f.type === 'binary' && f.operator === LogicalOperator.AND) {
    return [...flattenCNF(f.left), ...flattenCNF(f.right)];
  }
  return [f];
}

/**
 * Flatten a right-associative OR tree into an ordered list of literals.
 * E.g. (A ∨ (B ∨ C)) → [A, B, C]
 */
function clauseToLiterals(clause: Formula): Formula[] {
  if (clause.type === 'binary' && clause.operator === LogicalOperator.OR) {
    return [...clauseToLiterals(clause.left), ...clauseToLiterals(clause.right)];
  }
  return [clause];
}

/**
 * Rebuild a disjunction from a list of literals.
 * Returns the bottom literal for a unit clause, or atom('⊥') for an empty clause.
 */
function literalsToClause(literals: Formula[]): Formula {
  if (literals.length === 0) {
    return { type: 'atomic', symbol: '⊥', args: [] };
  }

  let result = literals[0]!;
  for (let i = 1; i < literals.length; i++) {
    result = { type: 'binary', operator: LogicalOperator.OR, left: result, right: literals[i]! };
  }
  return result;
}

/**
 * Return true iff the two literals are complementary (L and ¬L).
 */
function areComplementaryLiterals(a: Formula, b: Formula): boolean {
  if (a.type === 'not') {
    return formulasEqual(a.operand, b);
  }
  if (b.type === 'not') {
    return formulasEqual(a, b.operand);
  }
  return false;
}

/**
 * Deduplicate a list of literals using structural equality.
 */
function deduplicateLiterals(literals: Formula[]): Formula[] {
  const unique: Formula[] = [];
  for (const lit of literals) {
    if (!unique.some((u) => formulasEqual(u, lit))) {
      unique.push(lit);
    }
  }
  return unique;
}

/**
 * Resolution rule for CNF clauses.
 *
 * Given two clauses (disjunctions of literals), if one contains a literal L
 * and the other contains its complement ¬L, the resolvent is the disjunction
 * of all remaining literals (with duplicates removed).
 *
 * Returns null when no complementary pair exists (no resolution is possible).
 * Returns atom('⊥') when the resolvent is the empty clause (contradiction).
 *
 * @example
 *   tryResolve(A ∨ B, ¬A ∨ C)  →  B ∨ C
 *   tryResolve(A, ¬A)           →  ⊥  (empty clause)
 *   tryResolve(A ∨ B, C ∨ D)   →  null
 */
function tryResolve(c1: Formula, c2: Formula): Formula | null {
  const lits1 = clauseToLiterals(c1);
  const lits2 = clauseToLiterals(c2);

  for (let i = 0; i < lits1.length; i++) {
    for (let j = 0; j < lits2.length; j++) {
      const l1 = lits1[i]!;
      const l2 = lits2[j]!;

      if (areComplementaryLiterals(l1, l2)) {
        // Remove the resolved literals and combine the rests
        const remaining1 = lits1.filter((_, idx) => idx !== i);
        const remaining2 = lits2.filter((_, idx) => idx !== j);
        const combined = deduplicateLiterals([...remaining1, ...remaining2]);
        return literalsToClause(combined);
      }
    }
  }

  return null; // No complementary pair found
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
      return f2.type === 'atomic' && f1.symbol === f2.symbol && f1.args.length === f2.args.length;

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
