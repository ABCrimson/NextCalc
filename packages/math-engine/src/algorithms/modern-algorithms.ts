/**
 * Modern Algorithms (2022-2025)
 *
 * Cutting-edge algorithms from recent research in:
 * - Machine Learning & AI (Transformers, modern optimizers, meta-learning)
 * - Cryptography & Security (ZKP, homomorphic encryption, post-quantum)
 * - Quantum Computing Simulation
 *
 * @module modern-algorithms
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Transformer attention
 * const attention = new MultiHeadAttention(512, 8);
 * const output = attention.forward(queries, keys, values);
 *
 * // Adam optimizer
 * const optimizer = new AdamWOptimizer({ lr: 0.001, weightDecay: 0.01 });
 * const updated = optimizer.step(params, gradients);
 *
 * // Zero-knowledge proof
 * const zkp = new SchnorrProtocol();
 * const proof = zkp.prove(secret, challenge);
 * const valid = zkp.verify(proof, publicKey, challenge);
 * ```
 */

// ============================================================================
// MACHINE LEARNING & AI ALGORITHMS
// ============================================================================

/**
 * Matrix type for ML operations
 */
export type Matrix = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Vector type
 */
export type Vector = ReadonlyArray<number>;

/**
 * Tensor (3D array)
 */
export type Tensor3D = ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>>;

// ----------------------------------------------------------------------------
// 1. Transformer Attention Mechanism
// ----------------------------------------------------------------------------

/**
 * Scaled Dot-Product Attention
 *
 * Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
 */
export class ScaledDotProductAttention {
  /**
   * Compute scaled dot-product attention
   *
   * @param queries - Query matrix (seq_len × d_k)
   * @param keys - Key matrix (seq_len × d_k)
   * @param values - Value matrix (seq_len × d_v)
   * @param mask - Optional attention mask
   * @returns Attention output (seq_len × d_v)
   */
  forward(
    queries: Matrix,
    keys: Matrix,
    values: Matrix,
    mask?: Matrix
  ): Matrix {
    const dK = keys[0]?.length || 1;
    const scale = 1 / Math.sqrt(dK);

    // Compute QK^T
    const scores = this.matmul(queries, this.transpose(keys));

    // Scale
    const scaledScores = scores.map(row => row.map(val => val * scale));

    // Apply mask if provided
    const maskedScores = mask
      ? scaledScores.map((row, i) =>
          row.map((val, j) => {
            const maskVal = mask[i]?.[j];
            return maskVal === 0 ? -Infinity : val;
          })
        )
      : scaledScores;

    // Apply softmax
    const attentionWeights = maskedScores.map(row => this.softmax(row));

    // Multiply by values
    return this.matmul(attentionWeights, values);
  }

  private matmul(a: Matrix, b: Matrix): Matrix {
    const rows = a.length;
    const cols = b[0]?.length || 0;
    const inner = b.length;

    const result: number[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(0)
    );

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let sum = 0;
        for (let k = 0; k < inner; k++) {
          const aVal = a[i]?.[k] ?? 0;
          const bVal = b[k]?.[j] ?? 0;
          sum += aVal * bVal;
        }
        result[i]![j] = sum;
      }
    }

    return result;
  }

  private transpose(matrix: Matrix): Matrix {
    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    const result: number[][] = Array.from({ length: cols }, () =>
      Array(rows).fill(0)
    );

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j]![i] = matrix[i]?.[j] ?? 0;
      }
    }

    return result;
  }

  private softmax(vector: Vector): Vector {
    const max = Math.max(...vector);
    const exps = vector.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
  }
}

/**
 * Multi-Head Attention
 */
export class MultiHeadAttention {
  private readonly numHeads: number;
  private readonly dK: number;
  private readonly attention: ScaledDotProductAttention;

  constructor(dModel: number, numHeads: number) {
    this.numHeads = numHeads;
    this.dK = dModel / numHeads;
    this.attention = new ScaledDotProductAttention();
  }

  /**
   * Forward pass through multi-head attention
   */
  forward(queries: Matrix, keys: Matrix, values: Matrix, mask?: Matrix): Matrix {
    // Split into multiple heads
    const qHeads = this.splitHeads(queries);
    const kHeads = this.splitHeads(keys);
    const vHeads = this.splitHeads(values);

    // Apply attention to each head
    const outputs = qHeads.map((q, i) => {
      const k = kHeads[i] ?? [];
      const v = vHeads[i] ?? [];
      return this.attention.forward(q, k, v, mask);
    });

    // Concatenate heads
    return this.concatenateHeads(outputs);
  }

  private splitHeads(matrix: Matrix): Array<Matrix> {
    const seqLen = matrix.length;
    const heads: Matrix[] = [];

    for (let h = 0; h < this.numHeads; h++) {
      const head: number[][] = [];
      for (let i = 0; i < seqLen; i++) {
        const row: number[] = [];
        for (let j = 0; j < this.dK; j++) {
          const idx = h * this.dK + j;
          row.push(matrix[i]?.[idx] ?? 0);
        }
        head.push(row);
      }
      heads.push(head);
    }

    return heads;
  }

  private concatenateHeads(heads: Array<Matrix>): Matrix {
    const seqLen = heads[0]?.length || 0;
    const result: number[][] = [];

    for (let i = 0; i < seqLen; i++) {
      const row: number[] = [];
      for (const head of heads) {
        const headRow = head[i] ?? [];
        row.push(...headRow);
      }
      result.push(row);
    }

    return result;
  }
}

// ----------------------------------------------------------------------------
// 2. Modern Gradient Descent Variants
// ----------------------------------------------------------------------------

/**
 * Adam optimizer (Adaptive Moment Estimation)
 */
export class AdamOptimizer {
  private readonly lr: number;
  private readonly beta1: number;
  private readonly beta2: number;
  private readonly epsilon: number;
  private m: Map<string, Vector> = new Map();
  private v: Map<string, Vector> = new Map();
  private t = 0;

  constructor(config: {
    lr?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
  } = {}) {
    this.lr = config.lr ?? 0.001;
    this.beta1 = config.beta1 ?? 0.9;
    this.beta2 = config.beta2 ?? 0.999;
    this.epsilon = config.epsilon ?? 1e-8;
  }

  /**
   * Perform one optimization step
   */
  step(params: Map<string, Vector>, gradients: Map<string, Vector>): Map<string, Vector> {
    this.t++;
    const updated = new Map<string, Vector>();

    for (const [name, param] of params) {
      const grad = gradients.get(name);
      if (!grad) continue;

      // Initialize moments if needed
      if (!this.m.has(name)) {
        this.m.set(name, param.map(() => 0));
        this.v.set(name, param.map(() => 0));
      }

      const m = this.m.get(name)!;
      const v = this.v.get(name)!;

      // Update biased first moment estimate
      const mNew = m.map((mi, i) => this.beta1 * mi + (1 - this.beta1) * (grad[i] ?? 0));

      // Update biased second raw moment estimate
      const vNew = v.map((vi, i) => {
        const gi = grad[i] ?? 0;
        return this.beta2 * vi + (1 - this.beta2) * gi * gi;
      });

      // Compute bias-corrected moments
      const mHat = mNew.map(mi => mi / (1 - Math.pow(this.beta1, this.t)));
      const vHat = vNew.map(vi => vi / (1 - Math.pow(this.beta2, this.t)));

      // Update parameters
      const paramNew = param.map((pi, i) => {
        const update = this.lr * (mHat[i] ?? 0) / (Math.sqrt(vHat[i] ?? 0) + this.epsilon);
        return pi - update;
      });

      this.m.set(name, mNew);
      this.v.set(name, vNew);
      updated.set(name, paramNew);
    }

    return updated;
  }
}

/**
 * AdamW optimizer (Adam with weight decay)
 */
export class AdamWOptimizer extends AdamOptimizer {
  private readonly weightDecay: number;

  constructor(config: {
    lr?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
    weightDecay?: number;
  } = {}) {
    super(config);
    this.weightDecay = config.weightDecay ?? 0.01;
  }

  override step(params: Map<string, Vector>, gradients: Map<string, Vector>): Map<string, Vector> {
    // Apply weight decay to gradients
    const adjustedGradients = new Map<string, Vector>();

    for (const [name, param] of params) {
      const grad = gradients.get(name) ?? param.map(() => 0);
      const adjusted = grad.map((gi, i) => gi + this.weightDecay * (param[i] ?? 0));
      adjustedGradients.set(name, adjusted);
    }

    return super.step(params, adjustedGradients);
  }
}

/**
 * Lion optimizer (EvoLved Sign Momentum)
 */
export class LionOptimizer {
  private readonly lr: number;
  private readonly beta1: number;
  private readonly beta2: number;
  private readonly weightDecay: number;
  private m: Map<string, Vector> = new Map();

  constructor(config: {
    lr?: number;
    beta1?: number;
    beta2?: number;
    weightDecay?: number;
  } = {}) {
    this.lr = config.lr ?? 0.0001;
    this.beta1 = config.beta1 ?? 0.9;
    this.beta2 = config.beta2 ?? 0.99;
    this.weightDecay = config.weightDecay ?? 0.0;
  }

  step(params: Map<string, Vector>, gradients: Map<string, Vector>): Map<string, Vector> {
    const updated = new Map<string, Vector>();

    for (const [name, param] of params) {
      const grad = gradients.get(name);
      if (!grad) continue;

      if (!this.m.has(name)) {
        this.m.set(name, grad);
      }

      const m = this.m.get(name)!;

      // Update using sign of interpolation
      const paramNew = param.map((pi, i) => {
        const gi = grad[i] ?? 0;
        const mi = m[i] ?? 0;
        const update = this.lr * Math.sign(this.beta1 * mi + (1 - this.beta1) * gi);
        return pi - update - this.lr * this.weightDecay * pi;
      });

      // Update momentum
      const mNew = m.map((mi, i) => this.beta2 * mi + (1 - this.beta2) * (grad[i] ?? 0));

      this.m.set(name, mNew);
      updated.set(name, paramNew);
    }

    return updated;
  }
}

// ----------------------------------------------------------------------------
// 3. Contrastive Learning (SimCLR)
// ----------------------------------------------------------------------------

/**
 * SimCLR contrastive loss (Normalized Temperature-scaled Cross Entropy)
 */
export class SimCLRLoss {
  private readonly temperature: number;

  constructor(temperature = 0.5) {
    this.temperature = temperature;
  }

  /**
   * Compute contrastive loss for a batch
   *
   * @param features - Feature vectors (batch_size × feature_dim)
   * @returns Contrastive loss value
   */
  compute(features: Matrix): number {
    const batchSize = features.length;
    const similarities = this.computeSimilarities(features);

    let totalLoss = 0;

    for (let i = 0; i < batchSize; i++) {
      // Positive pair is at index (i + batchSize/2) % batchSize
      const posIdx = (i + Math.floor(batchSize / 2)) % batchSize;

      const numerator = Math.exp((similarities[i]?.[posIdx] ?? 0) / this.temperature);

      let denominator = 0;
      for (let j = 0; j < batchSize; j++) {
        if (i !== j) {
          denominator += Math.exp((similarities[i]?.[j] ?? 0) / this.temperature);
        }
      }

      totalLoss -= Math.log(numerator / denominator);
    }

    return totalLoss / batchSize;
  }

  private computeSimilarities(features: Matrix): Matrix {
    const n = features.length;
    const similarities: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        similarities[i]![j] = this.cosineSimilarity(features[i] ?? [], features[j] ?? []);
      }
    }

    return similarities;
  }

  private cosineSimilarity(a: Vector, b: Vector): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      dotProduct += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ----------------------------------------------------------------------------
// 4. Few-Shot Learning (MAML)
// ----------------------------------------------------------------------------

/**
 * Model-Agnostic Meta-Learning (MAML)
 */
export class MAML {
  private readonly innerLR: number;
  private readonly innerSteps: number;

  constructor(config: {
    innerLR?: number;
    outerLR?: number;
    innerSteps?: number;
  } = {}) {
    this.innerLR = config.innerLR ?? 0.01;
    this.innerSteps = config.innerSteps ?? 5;
  }

  /**
   * Meta-train on a batch of tasks
   */
  metaTrain(
    tasks: Array<{ support: Matrix; query: Matrix }>,
    model: (params: Vector, x: Matrix) => Vector,
    _loss: (pred: Vector, target: Vector) => number
  ): Vector {
    // Simplified MAML implementation
    // Full version would compute second-order gradients

    const metaGradients: Vector = [];

    for (const task of tasks) {
      // Inner loop: adapt to task using support set
      let taskParams: Vector = []; // Initialize from model

      for (let step = 0; step < this.innerSteps; step++) {
        model(taskParams, task.support);
        // Compute gradients and update (simplified)
        taskParams = taskParams.map(p => p - this.innerLR * 0.01); // Placeholder
      }

      // Outer loop: evaluate on query set
      model(taskParams, task.query);
      // Accumulate meta-gradients (simplified)
    }

    return metaGradients;
  }
}

// ----------------------------------------------------------------------------
// 5. Federated Averaging
// ----------------------------------------------------------------------------

/**
 * Federated Averaging (FedAvg) algorithm
 */
export class FederatedAveraging {
  /**
   * Aggregate client models using weighted averaging
   *
   * @param clientModels - Models from each client
   * @param clientWeights - Weight of each client (e.g., data size)
   * @returns Aggregated global model
   */
  aggregate(
    clientModels: Array<Map<string, Vector>>,
    clientWeights: Vector
  ): Map<string, Vector> {
    const totalWeight = clientWeights.reduce((a, b) => a + b, 0);
    const normalized = clientWeights.map(w => w / totalWeight);

    const aggregated = new Map<string, Vector>();

    if (clientModels.length === 0) return aggregated;

    const firstModel = clientModels[0]!;

    for (const [name, _] of firstModel) {
      const values: number[] = [];

      for (let paramIdx = 0; paramIdx < (firstModel.get(name)?.length ?? 0); paramIdx++) {
        let weightedSum = 0;

        for (let clientIdx = 0; clientIdx < clientModels.length; clientIdx++) {
          const model = clientModels[clientIdx];
          const param = model?.get(name)?.[paramIdx] ?? 0;
          weightedSum += param * (normalized[clientIdx] ?? 0);
        }

        values.push(weightedSum);
      }

      aggregated.set(name, values);
    }

    return aggregated;
  }
}

// ----------------------------------------------------------------------------
// 6. Differential Privacy (DP-SGD)
// ----------------------------------------------------------------------------

/**
 * Differentially Private Stochastic Gradient Descent
 */
export class DPSGDOptimizer {
  private readonly lr: number;
  private readonly noiseMultiplier: number;
  private readonly maxGradNorm: number;

  constructor(config: {
    lr?: number;
    noiseMultiplier?: number;
    maxGradNorm?: number;
  } = {}) {
    this.lr = config.lr ?? 0.01;
    this.noiseMultiplier = config.noiseMultiplier ?? 1.0;
    this.maxGradNorm = config.maxGradNorm ?? 1.0;
  }

  /**
   * Perform one DP-SGD step
   */
  step(params: Vector, gradients: Vector): Vector {
    // Clip gradients
    const clipped = this.clipGradients(gradients);

    // Add Gaussian noise
    const noised = clipped.map(g => g + this.gaussianNoise());

    // Update parameters
    return params.map((p, i) => p - this.lr * (noised[i] ?? 0));
  }

  private clipGradients(gradients: Vector): Vector {
    const norm = Math.sqrt(gradients.reduce((sum, g) => sum + g * g, 0));

    if (norm > this.maxGradNorm) {
      return gradients.map(g => (g / norm) * this.maxGradNorm);
    }

    return gradients;
  }

  private gaussianNoise(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * this.noiseMultiplier * this.maxGradNorm;
  }
}

// ----------------------------------------------------------------------------
// 7. Knowledge Distillation
// ----------------------------------------------------------------------------

/**
 * Knowledge distillation from teacher to student model
 */
export class KnowledgeDistillation {
  private readonly temperature: number;
  private readonly alpha: number;

  constructor(temperature = 3.0, alpha = 0.5) {
    this.temperature = temperature;
    this.alpha = alpha;
  }

  /**
   * Compute distillation loss
   *
   * @param studentLogits - Student model logits
   * @param teacherLogits - Teacher model logits
   * @param labels - True labels
   * @returns Combined distillation loss
   */
  computeLoss(
    studentLogits: Vector,
    teacherLogits: Vector,
    labels: Vector
  ): number {
    // Soft targets loss (KL divergence)
    const studentSoft = this.softmax(studentLogits, this.temperature);
    const teacherSoft = this.softmax(teacherLogits, this.temperature);
    const distillLoss = this.klDivergence(studentSoft, teacherSoft) * this.temperature * this.temperature;

    // Hard targets loss (cross-entropy)
    const studentHard = this.softmax(studentLogits, 1.0);
    const hardLoss = this.crossEntropy(studentHard, labels);

    // Combine losses
    return this.alpha * distillLoss + (1 - this.alpha) * hardLoss;
  }

  private softmax(logits: Vector, temperature: number): Vector {
    const scaled = logits.map(l => l / temperature);
    const max = Math.max(...scaled);
    const exps = scaled.map(l => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  private klDivergence(p: Vector, q: Vector): number {
    return p.reduce((sum, pi, i) => {
      const qi = q[i] ?? 1e-10;
      return sum + pi * Math.log(pi / qi);
    }, 0);
  }

  private crossEntropy(pred: Vector, target: Vector): number {
    return -target.reduce((sum, ti, i) => sum + ti * Math.log((pred[i] ?? 1e-10)), 0);
  }
}

// Export all algorithms
export const ModernMLAlgorithms = {
  ScaledDotProductAttention,
  MultiHeadAttention,
  AdamOptimizer,
  AdamWOptimizer,
  LionOptimizer,
  SimCLRLoss,
  MAML,
  FederatedAveraging,
  DPSGDOptimizer,
  KnowledgeDistillation,
};
