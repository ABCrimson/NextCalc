/**
 * Theorem Prover - Automated Theorem Proving for Mathematical Logic
 *
 * This module provides a complete theorem proving system including:
 * - Propositional and first-order logic
 * - Multiple proof search strategies
 * - Natural deduction system
 * - Theorem database and management
 *
 * @example
 * ```typescript
 * import { atom, implies, forwardChaining } from '@nextcalc/math-engine/prover';
 *
 * // Define premises: P, P → Q
 * const P = atom('P');
 * const Q = atom('Q');
 * const premises = [P, implies(P, Q)];
 *
 * // Prove Q using forward chaining
 * const proof = forwardChaining(premises, Q);
 * console.log('Proof found:', proof !== null);
 * ```
 *
 * @module prover
 */

// Inference rules exports
export {
  applyAnyRule,
  ChainRule,
  ConjunctionElimination,
  ConjunctionIntroduction,
  DisjunctionIntroduction,
  DisjunctiveSyllogism,
  findApplicableRules,
  HypotheticalSyllogism,
  INFERENCE_RULES,
  type InferenceRule,
  ModusPonens,
  ModusTollens,
  Resolution,
  type Substitution,
} from './inference-rules';
// Logic core exports
export {
  type Assignment,
  type AtomicFormula,
  and,
  // Formula constructors
  atom,
  type BinaryFormula,
  type ConstantTerm,
  constant,
  evaluate,
  exists,
  // Types
  type Formula,
  type FunctionTerm,
  forall,
  func,
  generateTruthTable,
  // Analysis functions
  getAtoms,
  getFreeVariables,
  iff,
  implies,
  isContradiction,
  isEquivalent,
  isSatisfiable,
  isTautology,
  LogicalOperator,
  type NotFormula,
  not,
  or,
  parse,
  type QuantifiedFormula,
  type Term,
  type TruthTableRow,
  // Utilities
  toString,
  type VariableTerm,
  variable,
} from './logic-core';
// Natural deduction exports
export {
  formatNDProof,
  type NDLine,
  type NDProof,
  NDProofBuilder,
  NDRuleType,
  ndProofToLatex,
  validateNDProof,
} from './natural-deduction';
// Proof search exports
export {
  backwardChaining,
  buildProofTree,
  formulasEqual,
  forwardChaining,
  iterativeDeepeningProof,
  type Proof,
  type ProofSearchConfig,
  type ProofStep,
  type ProofTreeNode,
  resolutionProof,
  verifyProof,
} from './proof-search';
// Theorem database exports
export {
  createTheorem,
  loadStandardTheorems,
  type Theorem,
  TheoremDatabase,
  theoremDB,
} from './theorem-database';
