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

// Gradient Descent
export {
  batchGradientDescent,
  type GradientDescentOptions,
  type GradientDescentResult,
  linearRegressionGD,
  logisticRegressionGD,
  nesterovAcceleratedGradient,
  stochasticGradientDescent,
} from './ml/gradient-descent';
// Meta-Learning (NEW)
export {
  cosineSimilarity,
  type LossFunction as MetaLossFunction,
  type MAMLConfig,
  type ModelFunction,
  maml,
  matchingNetworks,
  type Parameters,
  prototypicalNetworks,
  reptile,
  type Task,
} from './ml/meta-learning';
// Neural Networks
export {
  type ActivationType,
  type LayerConfig,
  type Matrix,
  NeuralNetwork,
  type TrainingConfig,
  type TrainingData,
  type Vector,
} from './ml/neural-network';
// Transformers (NEW)
export * from './ml/transformers/index';

// Optimization (exports LossFunction for compatibility)
export * from './optimization/adam';

// ============================================================================
// CRYPTOGRAPHY
// ============================================================================

// Differential Privacy (NEW)
export {
  demonstrateDifferentialPrivacy,
  exponentialMechanism,
  gaussianMechanism,
  laplaceMechanism,
  PrivacyBudget,
  privateCount,
  privateHistogram,
  privateMean,
  privateSum,
  reportNoisyMax,
} from './crypto/differential-privacy';
// RSA
export * from './crypto/rsa';
// Zero-Knowledge Proofs (NEW)
export {
  demonstrateSchnorrProof,
  PedersenCommitment,
  RangeProof,
  SchnorrProof,
  ZKSnarkSimulation,
} from './crypto/zero-knowledge-proofs';

// ============================================================================
// QUANTUM COMPUTING
// ============================================================================

// Grover's Algorithm
export * from './quantum/grover';

// Shor's Algorithm (NEW)
export {
  demonstrateShorAlgorithm,
  findPeriod,
  gcd,
  isPerfectPower,
  modPow,
  QuantumPeriodFinding,
  type ShorResult,
  shorAlgorithm,
} from './quantum/shor';

// ============================================================================
// GRAPH ALGORITHMS
// ============================================================================

export * from './graph/index';

// PageRank (NEW)
export {
  demonstratePageRank,
  type Graph,
  type PageRankResult,
  pageRank,
  personalizedPageRank,
  topicSensitivePageRank,
  topKPages,
} from './graph/pagerank';

// ============================================================================
// CLASSIC ALGORITHMS
// ============================================================================

export * from './classic/sorting';
