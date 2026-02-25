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

// Logic core exports
export {
  // Types
  type Formula,
  type AtomicFormula,
  type NotFormula,
  type BinaryFormula,
  type QuantifiedFormula,
  type Term,
  type VariableTerm,
  type ConstantTerm,
  type FunctionTerm,
  type Assignment,
  type TruthTableRow,
  LogicalOperator,

  // Formula constructors
  atom,
  variable,
  constant,
  func,
  not,
  and,
  or,
  implies,
  iff,
  forall,
  exists,

  // Analysis functions
  getAtoms,
  getFreeVariables,
  evaluate,
  generateTruthTable,
  isTautology,
  isContradiction,
  isSatisfiable,
  isEquivalent,

  // Utilities
  toString,
  parse,
} from './logic-core';

// Inference rules exports
export {
  type InferenceRule,
  type Substitution,
  ModusPonens,
  ModusTollens,
  HypotheticalSyllogism,
  DisjunctiveSyllogism,
  ConjunctionIntroduction,
  ConjunctionElimination,
  DisjunctionIntroduction,
  Resolution,
  ChainRule,
  INFERENCE_RULES,
  applyAnyRule,
  findApplicableRules,
} from './inference-rules';

// Proof search exports
export {
  type ProofStep,
  type Proof,
  type ProofTreeNode,
  type ProofSearchConfig,
  forwardChaining,
  backwardChaining,
  resolutionProof,
  buildProofTree,
  iterativeDeepeningProof,
  verifyProof,
  formulasEqual,
} from './proof-search';

// Theorem database exports
export {
  type Theorem,
  TheoremDatabase,
  createTheorem,
  theoremDB,
  loadStandardTheorems,
} from './theorem-database';

// Natural deduction exports
export {
  type NDLine,
  type NDProof,
  NDRuleType,
  NDProofBuilder,
  formatNDProof,
  validateNDProof,
  ndProofToLatex,
} from './natural-deduction';
