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

export * from './parser/index';

// Re-export commonly used types and functions
export type {
  ExpressionNode,
  ConstantNode,
  SymbolNode,
  OperatorNode,
  FunctionNode,
  Operator,
  MathFunction,
} from './parser/ast';

export {
  parse,
  isValidExpression,
  extractVariables,
  ParseError,
} from './parser/parser';

export {
  evaluate as evaluateExpression,
  simplify as evaluatorSimplify,
  EvaluationError,
  type EvaluationContext,
  type EvaluationResult,
} from './parser/evaluator';

// Statistics module
export * from './stats/index';

// Complex numbers module
export { Complex, Re, Im, abs, arg, conj } from './complex/index';

// Symbolic mathematics module
// Re-export all from symbolic except ProblemType and SolutionStep (defined in problems)
export {
  differentiate,
  simplifyDerivative,
  integrate,
  simplify,
  expand,
  factor,
  substitute,
  integrateAdaptiveSimpson,
  integrateImproper,
  integrateAuto,
  CAS,
  createCAS,
  quickSimplify,
  analyzeExpression,
  getVariables,
  getPolynomialDegree,
  solveWithSteps,
  // Series & LaTeX
  taylorSeries,
  maclaurinSeries,
  getKnownSeries,
  computeBernoulliNumbers,
  astToLatex,
  type SeriesConfig,
  type SeriesResult,
  type EnhancedExpression,
  type ExpressionType,
} from './symbolic/index';

// Knowledge base (exports Theorem from knowledge module)
export * from './knowledge/index';

// Algorithms
// Re-export all from algorithms except duplicate LossFunction
export {
  // ML
  NeuralNetwork,
  type LayerConfig,
  type TrainingConfig,
  type TrainingData,
  type ActivationType,
  type Matrix,
  type Vector,
  batchGradientDescent,
  stochasticGradientDescent,
  nesterovAcceleratedGradient,
  linearRegressionGD,
  logisticRegressionGD,
  type GradientDescentOptions,
  type GradientDescentResult,
  // Optimization (Adam) - includes LossFunction
  adam,
  adamW,
  radam,
  trainNeuralNetworkAdam,
  type AdamResult,
  type AdamOptions,
  type LossFunction,
  // Cryptography
  generateRSAKeyPair,
  rsaEncrypt,
  rsaDecrypt,
  type RSAKeyPair,
  // Quantum
  groverSearch,
  type QuantumState,
  type GroverResult,
  shorAlgorithm,
  findPeriod,
  isPerfectPower,
  demonstrateShorAlgorithm,
  QuantumPeriodFinding,
  type ShorResult,
  // Sorting
  quickSort,
  mergeSort,
  heapSort,
  type SortResult,
  // Graph (Shortest Paths)
  dijkstra,
  aStarSearch,
  bellmanFord,
  floydWarshall,
  reconstructFloydWarshallPath,
  createGraph,
  type GraphEdge,
  type PathResult,
  // PageRank
  pageRank,
  personalizedPageRank,
  topicSensitivePageRank,
  topKPages,
  demonstratePageRank,
  type PageRankResult,
} from './algorithms/index';

// Fourier Analysis
export * from './fourier/index';

// Graph Theory Algorithms
export {
  kruskal,
  prim,
  topologicalSort,
  topologicalSortKahn,
  tarjanSCC,
  kosarajuSCC,
  graphColoring,
  isBipartite,
  maxFlow,
  tsp,
  hasCycleDirected,
  hasCycleUndirected,
  type Graph,
  type MST,
  type SCCResult,
  type MaxFlowResult,
  type TSPResult,
} from './graph-theory/index';

// Differential equations
export * from './differential/index';

// Problem system (includes ProblemType and SolutionStep)
export * from './problems/index';

// Theorem Prover (ProverTheorem to avoid conflict with knowledge.Theorem)
export {
  // Types
  type Formula,
  type AtomicFormula,
  type NotFormula,
  type BinaryFormula,
  type QuantifiedFormula,
  type Term,
  type Assignment,
  type InferenceRule,
  type Proof,
  type ProofStep,
  type NDProof,
  type NDLine,
  LogicalOperator,
  NDRuleType,
  // Formula constructors
  atom,
  not,
  and,
  or,
  implies,
  iff,
  forall,
  exists,
  // Analysis
  isTautology,
  isSatisfiable,
  evaluate as evaluateFormula,
  // Proof search
  forwardChaining,
  backwardChaining,
  resolutionProof,
  verifyProof,
  findApplicableRules,
  // Natural deduction
  NDProofBuilder,
  validateNDProof,
  formatNDProof,
  // Theorem database
  TheoremDatabase,
  theoremDB,
  createTheorem,
  loadStandardTheorems,
  // Alias Theorem from prover as ProverTheorem to avoid conflict
  type Theorem as ProverTheorem,
} from './prover/index';

// Content Management System (selective exports to avoid conflicts)
export {
  // LaTeX
  renderLaTeX,
  autoRenderMath,
  parseLaTeXEnvironments,
  extractEquationRefs,
  type KaTeXOptions,
  type LaTeXEnvironment,
  // Markdown
  parseMarkdown,
  generateTOC,
  extractCodeBlocks,
  extractLinks,
  extractImages,
  renderMarkdown,
  type ParsedMarkdown,
  type MarkdownSection,
  type MathBlock,
  type TOCEntry,
  type CodeBlock,
  type Link,
  type Image,
  // Problem sets (with aliases to avoid conflict)
  loadProblemSet,
  loadProblemSetsFromFiles,
  createProblemSetIndex,
  validateProblemSet,
  type ProblemSet as ContentProblemSet,
  type Problem as ContentProblem,
  type ProblemSetIndex,
} from './content/index';

// Abstract Algebra
// Re-export specific exports to avoid isPrimitiveRoot conflict
export {
  createCyclicGroup,
  createSymmetricGroup,
  verifyGroupAxioms,
  type Group,
  type GroupElement,
  type GroupOperation,
  type Permutation,
  // Rings
  verifyRingAxioms,
  createModularRing,
  gaussian,
  GaussianIntegerOps,
  addPolynomials,
  multiplyPolynomials,
  dividePolynomials,
  evaluatePolynomial,
  derivativePolynomial,
  gcdPolynomials,
  polynomialToString,
  isIdeal,
  principalIdeal,
  isRingHomomorphism,
  type Ring,
  type RingElement,
  type RingOperation,
  type GaussianInteger,
  type Polynomial,
  type RingHomomorphism,
  // Fields
  createFiniteField,
  verifyFieldAxioms,
  type Field,
  type FieldElement,
} from './algebra/index';

// Number Theory
// Re-export all except duplicates (modInverse, extendedGCD, modPow - already in algorithms)
export {
  trialDivision,
  isPrime,
  millerRabin,
  sieveOfEratosthenes,
  nextPrime,
  primeFactorize,
  type PrimeFactorization,
  // Modular arithmetic (excluding modInverse, extendedGCD, modPow)
  modAdd,
  modSub,
  modMul,
  modPow,
  extendedGCD,
  modInverse,
  crt,
  eulerPhi,
  verifyEulerTheorem,
  multiplicativeOrder,
  isPrimitiveRoot,
  findAllPrimitiveRoots,
  hasPrimitiveRoot,
  isQuadraticResidue,
  legendreSymbol,
  jacobiSymbol,
  modSqrt,
  discreteLog,
} from './number-theory/index';
