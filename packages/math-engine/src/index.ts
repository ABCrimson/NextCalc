/**
 * @nextcalc/math-engine
 * High-performance mathematical computation engine with arbitrary precision
 *
 * NOTE: This root entry point re-exports from all submodules for convenience.
 * For optimal tree-shaking, consumers should import from subpath exports instead:
 *
 *   // Prefer this (only pulls in the parser module):
 *   import { parse } from '@nextcalc/math-engine/parser';
 *
 *   // Instead of this (pulls in everything):
 *   import { parse } from '@nextcalc/math-engine';
 *
 * Available subpath exports:
 *   @nextcalc/math-engine/parser
 *   @nextcalc/math-engine/wasm
 *   @nextcalc/math-engine/units
 *   @nextcalc/math-engine/symbolic
 *   @nextcalc/math-engine/matrix
 *   @nextcalc/math-engine/solver
 *   @nextcalc/math-engine/stats
 *   @nextcalc/math-engine/complex
 *   @nextcalc/math-engine/knowledge
 *   @nextcalc/math-engine/algorithms
 *   @nextcalc/math-engine/differential
 *   @nextcalc/math-engine/problems
 *   @nextcalc/math-engine/prover
 *   @nextcalc/math-engine/content
 *   @nextcalc/math-engine/cas
 *   @nextcalc/math-engine/calculus
 *   @nextcalc/math-engine/fourier
 *   @nextcalc/math-engine/graph-theory
 *   @nextcalc/math-engine/chaos/chaos-theory
 *   @nextcalc/math-engine/game-theory/game-theory
 */

// Abstract Algebra
// Re-export specific exports to avoid isPrimitiveRoot conflict
export {
  addPolynomials,
  createCyclicGroup,
  // Fields
  createFiniteField,
  createModularRing,
  createSymmetricGroup,
  derivativePolynomial,
  dividePolynomials,
  evaluatePolynomial,
  type Field,
  type FieldElement,
  type GaussianInteger,
  GaussianIntegerOps,
  type Group,
  type GroupElement,
  type GroupOperation,
  gaussian,
  gcdPolynomials,
  isIdeal,
  isRingHomomorphism,
  multiplyPolynomials,
  type Permutation,
  type Polynomial,
  polynomialToString,
  principalIdeal,
  type Ring,
  type RingElement,
  type RingHomomorphism,
  type RingOperation,
  verifyFieldAxioms,
  verifyGroupAxioms,
  // Rings
  verifyRingAxioms,
} from './algebra/index';
// Algorithms
// Re-export all from algorithms except duplicate LossFunction
export {
  type ActivationType,
  type AdamOptions,
  type AdamResult,
  // Optimization (Adam) - includes LossFunction
  adam,
  adamW,
  aStarSearch,
  batchGradientDescent,
  bellmanFord,
  createGraph,
  // Graph (Shortest Paths)
  dijkstra,
  findPeriod,
  floydWarshall,
  type GradientDescentOptions,
  type GradientDescentResult,
  type GraphEdge,
  type GroverResult,
  // Cryptography
  generateRSAKeyPair,
  // Quantum
  groverSearch,
  heapSort,
  isPerfectPower,
  type LayerConfig,
  type LossFunction,
  linearRegressionGD,
  logisticRegressionGD,
  type Matrix,
  mergeSort,
  // ML
  NeuralNetwork,
  nesterovAcceleratedGradient,
  type PageRankResult,
  type PathResult,
  // PageRank
  pageRank,
  personalizedPageRank,
  QuantumPeriodFinding,
  type QuantumState,
  // Sorting
  quickSort,
  type RSAKeyPair,
  radam,
  reconstructFloydWarshallPath,
  rsaDecrypt,
  rsaEncrypt,
  type ShorResult,
  type SortResult,
  shorAlgorithm,
  stochasticGradientDescent,
  type TrainingConfig,
  type TrainingData,
  topicSensitivePageRank,
  topKPages,
  type Vector,
} from './algorithms/index';
// Complex numbers module
export { abs, arg, Complex, conj, Im, Re } from './complex/index';
// Content Management System (selective exports to avoid conflicts)
export {
  autoRenderMath,
  type CodeBlock,
  createProblemSetIndex,
  extractCodeBlocks,
  extractEquationRefs,
  extractImages,
  extractLinks,
  generateTOC,
  type Image,
  type KaTeXOptions,
  type LaTeXEnvironment,
  type Link,
  // Problem sets (with aliases to avoid conflict)
  loadProblemSet,
  loadProblemSetsFromFiles,
  type MarkdownSection,
  type MathBlock,
  type ParsedMarkdown,
  type Problem as ContentProblem,
  type ProblemSet as ContentProblemSet,
  type ProblemSetIndex,
  parseLaTeXEnvironments,
  // Markdown
  parseMarkdown,
  // LaTeX
  renderLaTeX,
  renderMarkdown,
  type TOCEntry,
  validateProblemSet,
} from './content/index';
// Differential equations
export * from './differential/index';
// Fourier Analysis
export * from './fourier/index';
// Graph Theory Algorithms
export {
  type Graph,
  graphColoring,
  hasCycleDirected,
  hasCycleUndirected,
  isBipartite,
  kosarajuSCC,
  kruskal,
  type MaxFlowResult,
  type MST,
  maxFlow,
  prim,
  type SCCResult,
  type TSPResult,
  tarjanSCC,
  topologicalSort,
  topologicalSortKahn,
  tsp,
} from './graph-theory/index';

// Knowledge base (exports Theorem from knowledge module)
export * from './knowledge/index';
// Number Theory
// Re-export all except duplicates (modInverse, extendedGCD, modPow - already in algorithms)
export {
  crt,
  discreteLog,
  eulerPhi,
  extendedGCD,
  findAllPrimitiveRoots,
  hasPrimitiveRoot,
  isPrime,
  isPrimitiveRoot,
  isQuadraticResidue,
  jacobiSymbol,
  legendreSymbol,
  millerRabin,
  // Modular arithmetic (excluding modInverse, extendedGCD, modPow)
  modAdd,
  modInverse,
  modMul,
  modPow,
  modSqrt,
  modSub,
  multiplicativeOrder,
  nextPrime,
  type PrimeFactorization,
  primeFactorize,
  sieveOfEratosthenes,
  trialDivision,
  verifyEulerTheorem,
} from './number-theory/index';
// Re-export commonly used types and functions
export type {
  ConstantNode,
  ExpressionNode,
  FunctionNode,
  MathFunction,
  Operator,
  OperatorNode,
  SymbolNode,
} from './parser/ast';
export {
  type EvaluationContext,
  EvaluationError,
  type EvaluationResult,
  evaluate as evaluateExpression,
  simplify as evaluatorSimplify,
} from './parser/evaluator';
export * from './parser/index';
export {
  extractVariables,
  isValidExpression,
  ParseError,
  parse,
} from './parser/parser';
// Problem system (includes ProblemType and SolutionStep)
export * from './problems/index';
// Theorem Prover (ProverTheorem to avoid conflict with knowledge.Theorem)
export {
  type Assignment,
  type AtomicFormula,
  and,
  // Formula constructors
  atom,
  type BinaryFormula,
  backwardChaining,
  createTheorem,
  evaluate as evaluateFormula,
  exists,
  // Types
  type Formula,
  findApplicableRules,
  forall,
  formatNDProof,
  // Proof search
  forwardChaining,
  type InferenceRule,
  iff,
  implies,
  isSatisfiable,
  // Analysis
  isTautology,
  LogicalOperator,
  loadStandardTheorems,
  type NDLine,
  type NDProof,
  // Natural deduction
  NDProofBuilder,
  NDRuleType,
  type NotFormula,
  not,
  or,
  type Proof,
  type ProofStep,
  type QuantifiedFormula,
  resolutionProof,
  type Term,
  // Alias Theorem from prover as ProverTheorem to avoid conflict
  type Theorem as ProverTheorem,
  // Theorem database
  TheoremDatabase,
  theoremDB,
  validateNDProof,
  verifyProof,
} from './prover/index';
// Statistics module
export * from './stats/index';
// Symbolic mathematics module
// Re-export all from symbolic except ProblemType and SolutionStep (defined in problems)
export {
  analyzeExpression,
  astToLatex,
  CAS,
  computeBernoulliNumbers,
  createCAS,
  differentiate,
  type EnhancedExpression,
  type ExpressionType,
  expand,
  factor,
  getKnownSeries,
  getPolynomialDegree,
  getVariables,
  integrate,
  integrateAdaptiveSimpson,
  integrateAuto,
  integrateImproper,
  maclaurinSeries,
  quickSimplify,
  type SeriesConfig,
  type SeriesResult,
  simplify,
  simplifyDerivative,
  solveWithSteps,
  substitute,
  // Series & LaTeX
  taylorSeries,
} from './symbolic/index';
