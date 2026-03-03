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
export {
  adam,
  type AdamOptions,
  type AdamResult,
  adamW,
  type LossFunction,
  radam,
} from './optimization/adam';

// ============================================================================
// CRYPTOGRAPHY
// ============================================================================

// Differential Privacy (NEW)
export {
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
export {
  extendedGCD as rsaExtendedGCD,
  gcd as rsaGCD,
  generatePrime,
  generateRSAKeyPair,
  isProbablyPrime,
  modInverse as rsaModInverse,
  modPow as rsaModPow,
  rsaDecrypt,
  rsaDecryptString,
  rsaEncrypt,
  rsaEncryptString,
  type RSAKeyPair,
  rsaSign,
  rsaVerify,
} from './crypto/rsa';
// Zero-Knowledge Proofs (NEW)
export {
  PedersenCommitment,
  RangeProof,
  SchnorrProof,
  ZKSnarkSimulation,
} from './crypto/zero-knowledge-proofs';

// ============================================================================
// QUANTUM COMPUTING
// ============================================================================

// Grover's Algorithm
export {
  Complex as QuantumComplex,
  type GroverResult,
  groverSearch,
  groverSearchCustom,
  type OracleFunction,
  QuantumState,
} from './quantum/grover';

// Shor's Algorithm (NEW)
export {
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
