/**
 * Algorithms Module
 *
 * Comprehensive collection of modern and classic algorithms:
 * - Machine Learning: Transformers, meta-learning, gradient descent, neural networks
 * - Cryptography: RSA, zero-knowledge proofs, differential privacy
 * - Quantum Computing: Grover's, Shor's algorithm
 * - Graph Algorithms: PageRank, Dijkstra
 * - Classic Algorithms: Sorting, searching, dynamic programming
 */

// ============================================================================
// MACHINE LEARNING
// ============================================================================

// Neural Networks
export {
  NeuralNetwork,
  type LayerConfig,
  type TrainingConfig,
  type TrainingData,
  type ActivationType,
  type Matrix,
  type Vector,
} from './ml/neural-network';

// Gradient Descent
export {
  batchGradientDescent,
  stochasticGradientDescent,
  nesterovAcceleratedGradient,
  linearRegressionGD,
  logisticRegressionGD,
  type GradientDescentOptions,
  type GradientDescentResult,
} from './ml/gradient-descent';

// Transformers (NEW)
export * from './ml/transformers/index';

// Meta-Learning (NEW)
export {
  maml,
  prototypicalNetworks,
  matchingNetworks,
  reptile,
  cosineSimilarity,
  type Task,
  type Parameters,
  type ModelFunction,
  type LossFunction as MetaLossFunction,
  type MAMLConfig,
} from './ml/meta-learning';

// Optimization (exports LossFunction for compatibility)
export * from './optimization/adam';

// ============================================================================
// CRYPTOGRAPHY
// ============================================================================

// RSA
export * from './crypto/rsa';

// Zero-Knowledge Proofs (NEW)
export {
  SchnorrProof,
  ZKSnarkSimulation,
  RangeProof,
  PedersenCommitment,
  demonstrateSchnorrProof,
} from './crypto/zero-knowledge-proofs';

// Differential Privacy (NEW)
export {
  laplaceMechanism,
  gaussianMechanism,
  exponentialMechanism,
  privateCount,
  privateSum,
  privateMean,
  privateHistogram,
  reportNoisyMax,
  PrivacyBudget,
  demonstrateDifferentialPrivacy,
} from './crypto/differential-privacy';

// ============================================================================
// QUANTUM COMPUTING
// ============================================================================

// Grover's Algorithm
export * from './quantum/grover';

// Shor's Algorithm (NEW)
export {
  shorAlgorithm,
  findPeriod,
  modPow,
  gcd,
  isPerfectPower,
  demonstrateShorAlgorithm,
  QuantumPeriodFinding,
  type ShorResult,
} from './quantum/shor';

// ============================================================================
// GRAPH ALGORITHMS
// ============================================================================

export * from './graph/index';

// PageRank (NEW)
export {
  pageRank,
  personalizedPageRank,
  topicSensitivePageRank,
  topKPages,
  demonstratePageRank,
  type Graph,
  type PageRankResult,
} from './graph/pagerank';

// ============================================================================
// CLASSIC ALGORITHMS
// ============================================================================

export * from './classic/sorting';
