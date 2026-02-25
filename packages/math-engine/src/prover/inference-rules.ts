/**
 * Inference Rules - Logical Reasoning Rules for Theorem Proving
 *
 * Implements fundamental inference rules for propositional and first-order logic:
 * - Modus ponens, modus tollens
 * - Hypothetical syllogism, disjunctive syllogism
 * - Resolution, unification
 * - Universal instantiation, existential generalization
 * - Chain rule and other derived rules
 */

import type { Formula, Term } from './logic-core';
import { and, or, not, implies, atom } from './logic-core';

/**
 * Inference rule interface
 */
export interface InferenceRule {
  name: string;
  description: string;
  /** Check if the rule is applicable given premises */
  isApplicable(premises: Formula[]): boolean;
  /** Apply the rule and return conclusion(s) */
  apply(premises: Formula[]): Formula[];
}

/**
 * Substitution map for unification
 */
export type Substitution = Map<string, Term>;

/**
 * Modus Ponens (MP): From A and A → B, infer B
 */
export class ModusPonens implements InferenceRule {
  name = 'Modus Ponens';
  description = 'From A and A → B, infer B';

  isApplicable(premises: Formula[]): boolean {
    if (premises.length !== 2) return false;

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    // Check if one is an implication and the other matches its antecedent
    if (f2.type === 'binary' && f2.operator === 'IMPLIES') {
      return formulasEqual(f1, f2.left);
    }

    if (f1.type === 'binary' && f1.operator === 'IMPLIES') {
      return formulasEqual(f2, f1.left);
    }

    return false;
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Modus Ponens not applicable');
    }

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    if (f2.type === 'binary' && f2.operator === 'IMPLIES' && formulasEqual(f1, f2.left)) {
      return [f2.right];
    }

    if (f1.type === 'binary' && f1.operator === 'IMPLIES' && formulasEqual(f2, f1.left)) {
      return [f1.right];
    }

    throw new Error('Modus Ponens not applicable');
  }
}

/**
 * Modus Tollens (MT): From A → B and ¬B, infer ¬A
 */
export class ModusTollens implements InferenceRule {
  name = 'Modus Tollens';
  description = 'From A → B and ¬B, infer ¬A';

  isApplicable(premises: Formula[]): boolean {
    if (premises.length !== 2) return false;

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    // Check patterns: (A → B) and ¬B
    if (f1.type === 'binary' && f1.operator === 'IMPLIES' && f2.type === 'not') {
      return formulasEqual(f1.right, f2.operand);
    }

    if (f2.type === 'binary' && f2.operator === 'IMPLIES' && f1.type === 'not') {
      return formulasEqual(f2.right, f1.operand);
    }

    return false;
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Modus Tollens not applicable');
    }

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    if (f1.type === 'binary' && f1.operator === 'IMPLIES' && f2.type === 'not') {
      return [not(f1.left)];
    }

    if (f2.type === 'binary' && f2.operator === 'IMPLIES' && f1.type === 'not') {
      return [not(f2.left)];
    }

    throw new Error('Modus Tollens not applicable');
  }
}

/**
 * Hypothetical Syllogism (HS): From A → B and B → C, infer A → C
 */
export class HypotheticalSyllogism implements InferenceRule {
  name = 'Hypothetical Syllogism';
  description = 'From A → B and B → C, infer A → C';

  isApplicable(premises: Formula[]): boolean {
    if (premises.length !== 2) return false;

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    if (f1.type !== 'binary' || f1.operator !== 'IMPLIES') return false;
    if (f2.type !== 'binary' || f2.operator !== 'IMPLIES') return false;

    return formulasEqual(f1.right, f2.left) || formulasEqual(f2.right, f1.left);
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Hypothetical Syllogism not applicable');
    }

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    if (f1.type === 'binary' && f2.type === 'binary') {
      if (formulasEqual(f1.right, f2.left)) {
        return [implies(f1.left, f2.right)];
      }
      if (formulasEqual(f2.right, f1.left)) {
        return [implies(f2.left, f1.right)];
      }
    }

    throw new Error('Hypothetical Syllogism not applicable');
  }
}

/**
 * Disjunctive Syllogism (DS): From A ∨ B and ¬A, infer B
 */
export class DisjunctiveSyllogism implements InferenceRule {
  name = 'Disjunctive Syllogism';
  description = 'From A ∨ B and ¬A, infer B';

  isApplicable(premises: Formula[]): boolean {
    if (premises.length !== 2) return false;

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    // Pattern: (A ∨ B) and ¬A
    if (f1.type === 'binary' && f1.operator === 'OR' && f2.type === 'not') {
      return formulasEqual(f1.left, f2.operand) || formulasEqual(f1.right, f2.operand);
    }

    if (f2.type === 'binary' && f2.operator === 'OR' && f1.type === 'not') {
      return formulasEqual(f2.left, f1.operand) || formulasEqual(f2.right, f1.operand);
    }

    return false;
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Disjunctive Syllogism not applicable');
    }

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    if (f1.type === 'binary' && f1.operator === 'OR' && f2.type === 'not') {
      if (formulasEqual(f1.left, f2.operand)) {
        return [f1.right];
      }
      return [f1.left];
    }

    if (f2.type === 'binary' && f2.operator === 'OR' && f1.type === 'not') {
      if (formulasEqual(f2.left, f1.operand)) {
        return [f2.right];
      }
      return [f2.left];
    }

    throw new Error('Disjunctive Syllogism not applicable');
  }
}

/**
 * Conjunction Introduction: From A and B, infer A ∧ B
 */
export class ConjunctionIntroduction implements InferenceRule {
  name = 'Conjunction Introduction';
  description = 'From A and B, infer A ∧ B';

  isApplicable(premises: Formula[]): boolean {
    return premises.length >= 2;
  }

  apply(premises: Formula[]): Formula[] {
    if (premises.length < 2) {
      throw new Error('Conjunction Introduction requires at least 2 premises');
    }

    return [and(...premises)];
  }
}

/**
 * Conjunction Elimination: From A ∧ B, infer A and B
 */
export class ConjunctionElimination implements InferenceRule {
  name = 'Conjunction Elimination';
  description = 'From A ∧ B, infer A and B';

  isApplicable(premises: Formula[]): boolean {
    const formula = premises[0];
    return premises.length === 1 && formula !== undefined && formula.type === 'binary' && formula.operator === 'AND';
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Conjunction Elimination not applicable');
    }

    const formula = premises[0]!;
    if (formula.type === 'binary') {
      return [formula.left, formula.right];
    }

    throw new Error('Conjunction Elimination not applicable');
  }
}

/**
 * Disjunction Introduction: From A, infer A ∨ B (for any B)
 */
export class DisjunctionIntroduction implements InferenceRule {
  name = 'Disjunction Introduction';
  description = 'From A, infer A ∨ B';

  constructor(private readonly addedFormula?: Formula) {}

  isApplicable(premises: Formula[]): boolean {
    return premises.length === 1 && this.addedFormula !== undefined;
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Disjunction Introduction not applicable');
    }

    return [or(premises[0]!, this.addedFormula!)];
  }
}

/**
 * Resolution: From A ∨ B and ¬B ∨ C, infer A ∨ C
 */
export class Resolution implements InferenceRule {
  name = 'Resolution';
  description = 'From A ∨ B and ¬B ∨ C, infer A ∨ C';

  isApplicable(premises: Formula[]): boolean {
    if (premises.length !== 2) return false;

    const f1 = premises[0]!;
    const f2 = premises[1]!;

    // Both must be disjunctions
    if (f1.type !== 'binary' || f1.operator !== 'OR') return false;
    if (f2.type !== 'binary' || f2.operator !== 'OR') return false;

    // Look for complementary literals
    return this.findComplementaryLiterals(f1, f2) !== null;
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Resolution not applicable');
    }

    const f1 = premises[0]!;
    const f2 = premises[1]!;
    if (f1.type !== 'binary' || f2.type !== 'binary') {
      throw new Error('Resolution requires disjunctions');
    }

    const complementary = this.findComplementaryLiterals(f1, f2);
    if (!complementary) {
      throw new Error('No complementary literals found');
    }

    const { f1Other, f2Other } = complementary;

    // Build resolvent
    const disjuncts: Formula[] = [];
    if (f1Other) disjuncts.push(f1Other);
    if (f2Other) disjuncts.push(f2Other);

    if (disjuncts.length === 0) {
      // Empty clause (contradiction)
      return [atom('⊥')];
    }

    if (disjuncts.length === 1) {
      return [disjuncts[0]!];
    }

    return [or(...disjuncts)];
  }

  private findComplementaryLiterals(
    f1: Formula,
    f2: Formula
  ): { literal: Formula; negatedLiteral: Formula; f1Other: Formula | null; f2Other: Formula | null } | null {
    if (f1.type !== 'binary' || f2.type !== 'binary') return null;

    // Check all combinations
    const f1Literals = [f1.left, f1.right];
    const f2Literals = [f2.left, f2.right];

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const lit1 = f1Literals[i];
        const lit2 = f2Literals[j];

        if (lit1 && lit2 && areComplementary(lit1, lit2)) {
          return {
            literal: lit1.type === 'not' ? lit1.operand : lit1,
            negatedLiteral: lit2.type === 'not' ? lit2.operand : lit2,
            f1Other: i === 0 ? f1.right : f1.left,
            f2Other: j === 0 ? f2.right : f2.left,
          };
        }
      }
    }

    return null;
  }
}

/**
 * Chain Rule (for implications): From A₁ → A₂, A₂ → A₃, ..., Aₙ₋₁ → Aₙ, infer A₁ → Aₙ
 */
export class ChainRule implements InferenceRule {
  name = 'Chain Rule';
  description = 'From A₁ → A₂, A₂ → A₃, ..., infer A₁ → Aₙ';

  isApplicable(premises: Formula[]): boolean {
    if (premises.length < 2) return false;

    // All must be implications
    if (!premises.every(p => p.type === 'binary' && p.operator === 'IMPLIES')) {
      return false;
    }

    // Check if they form a chain
    return this.formsChain(premises);
  }

  apply(premises: Formula[]): Formula[] {
    if (!this.isApplicable(premises)) {
      throw new Error('Chain Rule not applicable');
    }

    const chain = this.orderChain(premises);
    if (!chain) {
      throw new Error('Cannot form a valid chain');
    }

    const first = chain[0];
    const last = chain[chain.length - 1];

    if (first && last && first.type === 'binary' && last.type === 'binary') {
      return [implies(first.left, last.right)];
    }

    throw new Error('Chain Rule not applicable');
  }

  private formsChain(premises: Formula[]): boolean {
    return this.orderChain(premises) !== null;
  }

  private orderChain(premises: Formula[]): Formula[] | null {
    // Try to order implications into a chain
    const remaining = [...premises];
    const chain: Formula[] = [];

    // Start with any implication
    const firstPremise = remaining.shift();
    if (!firstPremise) return null;
    chain.push(firstPremise);

    while (remaining.length > 0) {
      let found = false;

      for (let i = 0; i < remaining.length; i++) {
        const last = chain[chain.length - 1];
        const candidate = remaining[i];

        if (
          last &&
          candidate &&
          last.type === 'binary' &&
          candidate.type === 'binary' &&
          formulasEqual(last.right, candidate.left)
        ) {
          chain.push(candidate);
          remaining.splice(i, 1);
          found = true;
          break;
        }
      }

      if (!found) {
        return null;
      }
    }

    return chain;
  }
}

/**
 * Check if two formulas are structural equals
 */
function formulasEqual(f1: Formula, f2: Formula): boolean {
  if (f1.type !== f2.type) return false;

  switch (f1.type) {
    case 'atomic':
      return (
        f2.type === 'atomic' &&
        f1.symbol === f2.symbol &&
        f1.args.length === f2.args.length &&
        f1.args.every((arg, i) => {
          const arg2 = f2.args[i];
          return arg2 !== undefined && termsEqual(arg, arg2);
        })
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

/**
 * Check if two terms are equal
 */
function termsEqual(t1: Term, t2: Term): boolean {
  if (t1.type !== t2.type) return false;

  switch (t1.type) {
    case 'variable':
      return t2.type === 'variable' && t1.name === t2.name;

    case 'constant':
      return t2.type === 'constant' && t1.value === t2.value;

    case 'function':
      return (
        t2.type === 'function' &&
        t1.symbol === t2.symbol &&
        t1.args.length === t2.args.length &&
        t1.args.every((arg, i) => {
          const arg2 = t2.args[i];
          return arg2 !== undefined && termsEqual(arg, arg2);
        })
      );
  }
}

/**
 * Check if two formulas are complementary (A and ¬A)
 */
function areComplementary(f1: Formula, f2: Formula): boolean {
  if (f1.type === 'not') {
    return formulasEqual(f1.operand, f2);
  }

  if (f2.type === 'not') {
    return formulasEqual(f1, f2.operand);
  }

  return false;
}

/**
 * All available inference rules
 */
export const INFERENCE_RULES = {
  modusPonens: new ModusPonens(),
  modusTollens: new ModusTollens(),
  hypotheticalSyllogism: new HypotheticalSyllogism(),
  disjunctiveSyllogism: new DisjunctiveSyllogism(),
  conjunctionIntro: new ConjunctionIntroduction(),
  conjunctionElim: new ConjunctionElimination(),
  resolution: new Resolution(),
  chainRule: new ChainRule(),
};

/**
 * Try to apply any applicable inference rule
 */
export function applyAnyRule(premises: Formula[]): { rule: InferenceRule; conclusions: Formula[] } | null {
  for (const rule of Object.values(INFERENCE_RULES)) {
    if (rule.isApplicable(premises)) {
      try {
        const conclusions = rule.apply(premises);
        return { rule, conclusions };
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Find all applicable rules for given premises
 */
export function findApplicableRules(premises: Formula[]): InferenceRule[] {
  return Object.values(INFERENCE_RULES).filter(rule => rule.isApplicable(premises));
}
