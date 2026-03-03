/**
 * Meta-Learning Algorithms
 *
 * "Learning to Learn" - algorithms that learn how to learn new tasks quickly
 * from limited data.
 *
 * Implements:
 * - MAML (Model-Agnostic Meta-Learning)
 * - Prototypical Networks
 * - Matching Networks
 *
 * Time Complexity: Varies by algorithm
 * Space Complexity: O(model_parameters)
 */

/**
 * Task for meta-learning
 */
export interface Task {
  /** Support set (training examples for this task) */
  readonly support: {
    readonly inputs: ReadonlyArray<ReadonlyArray<number>>;
    readonly labels: ReadonlyArray<number>;
  };
  /** Query set (test examples for this task) */
  readonly query: {
    readonly inputs: ReadonlyArray<ReadonlyArray<number>>;
    readonly labels: ReadonlyArray<number>;
  };
}

/**
 * Model parameters (weights)
 */
export type Parameters = ReadonlyArray<number>;

/**
 * Model function type
 */
export type ModelFunction = (
  input: ReadonlyArray<number>,
  params: Parameters,
) => ReadonlyArray<number>;

/**
 * Loss function type
 */
export type LossFunction = (prediction: ReadonlyArray<number>, label: number) => number;

/**
 * MAML Configuration
 */
export interface MAMLConfig {
  /** Inner loop learning rate (task-specific adaptation) */
  readonly innerLR: number;
  /** Outer loop learning rate (meta-update) */
  readonly outerLR: number;
  /** Number of inner loop steps */
  readonly innerSteps: number;
  /** Number of outer loop steps (epochs) */
  readonly outerSteps: number;
  /**
   * Optional callback invoked every 10 epochs with the current epoch index
   * and average loss. Use this instead of console.log for progress reporting.
   */
  readonly onProgress?: (epoch: number, avgLoss: number) => void;
}

/**
 * MAML (Model-Agnostic Meta-Learning)
 *
 * Algorithm by Finn et al., 2017
 * https://arxiv.org/abs/1703.03400
 *
 * Key idea: Find initialization that can quickly adapt to new tasks
 * with just a few gradient steps.
 *
 * Algorithm:
 * 1. Sample batch of tasks
 * 2. For each task:
 *    a. Adapt parameters with k gradient steps (inner loop)
 *    b. Compute loss on query set with adapted parameters
 * 3. Update initial parameters based on meta-gradient (outer loop)
 *
 * @param tasks - Collection of tasks for meta-training
 * @param initialParams - Initial model parameters
 * @param model - Model function
 * @param loss - Loss function
 * @param config - MAML configuration
 * @returns Meta-learned parameters
 */
export function maml(
  tasks: ReadonlyArray<Task>,
  initialParams: Parameters,
  model: ModelFunction,
  loss: LossFunction,
  config: MAMLConfig,
): Parameters {
  const { innerLR, outerLR, innerSteps, outerSteps } = config;

  const metaParams = [...initialParams];

  // Outer loop (meta-training)
  for (let epoch = 0; epoch < outerSteps; epoch++) {
    const metaGradient = new Array(metaParams.length).fill(0);

    // Sample batch of tasks
    for (const task of tasks) {
      // Inner loop: adapt to this specific task
      let taskParams = [...metaParams];

      for (let step = 0; step < innerSteps; step++) {
        // Compute gradient on support set
        const gradient = computeGradient(
          taskParams,
          task.support.inputs,
          task.support.labels,
          model,
          loss,
        );

        // Update task-specific parameters
        taskParams = taskParams.map((p, i) => p - innerLR * gradient[i]!);
      }

      // Compute meta-gradient on query set with adapted parameters
      const queryGradient = computeGradient(
        taskParams,
        task.query.inputs,
        task.query.labels,
        model,
        loss,
      );

      // Accumulate meta-gradient
      for (let i = 0; i < metaGradient.length; i++) {
        metaGradient[i] += queryGradient[i]!;
      }
    }

    // Outer loop update: update meta-parameters
    for (let i = 0; i < metaParams.length; i++) {
      const gradValue = metaGradient[i];
      if (gradValue !== undefined) {
        metaParams[i]! -= outerLR * (gradValue / tasks.length);
      }
    }

    // Report progress every 10 epochs via optional callback
    if (epoch % 10 === 0 && config.onProgress !== undefined) {
      const avgLoss = evaluateTasks(tasks, metaParams, model, loss);
      config.onProgress(epoch, avgLoss);
    }
  }

  return metaParams;
}

/**
 * Prototypical Networks
 *
 * Algorithm by Snell et al., 2017
 * https://arxiv.org/abs/1703.05175
 *
 * Key idea: Learn a metric space where classification is performed
 * by computing distances to prototype representations of each class.
 *
 * @param task - Few-shot classification task
 * @param embedModel - Function that embeds inputs into metric space
 * @returns Class predictions for query set
 */
export function prototypicalNetworks(
  task: Task,
  embedModel: (input: ReadonlyArray<number>) => ReadonlyArray<number>,
): ReadonlyArray<number> {
  // Step 1: Compute prototypes (class centroids in embedding space)
  const prototypes = computePrototypes(task.support, embedModel);

  // Step 2: Classify query examples by nearest prototype
  const predictions: number[] = [];

  for (const queryInput of task.query.inputs) {
    const queryEmbed = embedModel(queryInput);

    // Find nearest prototype
    let minDist = Number.POSITIVE_INFINITY;
    let predictedClass = 0;

    for (let c = 0; c < prototypes.length; c++) {
      const proto = prototypes[c]!;
      const dist = euclideanDistance(queryEmbed, proto);

      if (dist < minDist) {
        minDist = dist;
        predictedClass = c;
      }
    }

    predictions.push(predictedClass);
  }

  return predictions;
}

/**
 * Compute class prototypes (centroids)
 */
function computePrototypes(
  support: Task['support'],
  embedModel: (input: ReadonlyArray<number>) => ReadonlyArray<number>,
): ReadonlyArray<ReadonlyArray<number>> {
  const { inputs, labels } = support;

  // Group by class
  const classSamples = new Map<number, ReadonlyArray<number>[]>();

  for (let i = 0; i < inputs.length; i++) {
    const label = labels[i]!;
    const embed = embedModel(inputs[i]!);

    if (!classSamples.has(label)) {
      classSamples.set(label, []);
    }
    classSamples.get(label)!.push(embed);
  }

  // Compute centroid for each class
  const prototypes: ReadonlyArray<number>[] = [];

  for (const [_label, embeds] of classSamples) {
    const centroid = computeCentroid(embeds);
    prototypes.push(centroid);
  }

  return prototypes;
}

/**
 * Matching Networks
 *
 * Algorithm by Vinyals et al., 2016
 * https://arxiv.org/abs/1606.04080
 *
 * Key idea: Use attention mechanism to compare query with support set.
 *
 * @param task - Few-shot classification task
 * @param embedModel - Embedding function
 * @param attentionKernel - Attention kernel function
 * @returns Class predictions
 */
export function matchingNetworks(
  task: Task,
  embedModel: (input: ReadonlyArray<number>) => ReadonlyArray<number>,
  attentionKernel: (a: ReadonlyArray<number>, b: ReadonlyArray<number>) => number,
): ReadonlyArray<number> {
  const { support, query } = task;

  // Embed all support examples
  const supportEmbeds = support.inputs.map((x) => embedModel(x));

  const predictions: number[] = [];

  for (const queryInput of query.inputs) {
    const queryEmbed = embedModel(queryInput);

    // Compute attention weights
    const attentionWeights = supportEmbeds.map((supportEmbed) =>
      attentionKernel(queryEmbed, supportEmbed),
    );

    // Softmax normalization
    const weights = softmax(attentionWeights);

    // Weighted sum of support labels
    const classScores = new Map<number, number>();

    for (let i = 0; i < support.labels.length; i++) {
      const label = support.labels[i]!;
      const weight = weights[i]!;

      classScores.set(label, (classScores.get(label) || 0) + weight);
    }

    // Predict class with highest score
    let maxScore = -Infinity;
    let predictedClass = 0;

    for (const [cls, score] of classScores) {
      if (score > maxScore) {
        maxScore = score;
        predictedClass = cls;
      }
    }

    predictions.push(predictedClass);
  }

  return predictions;
}

/**
 * Reptile Meta-Learning
 *
 * Simpler alternative to MAML that directly interpolates parameters.
 *
 * Algorithm by Nichol et al., 2018
 * https://arxiv.org/abs/1803.02999
 */
export function reptile(
  tasks: ReadonlyArray<Task>,
  initialParams: Parameters,
  model: ModelFunction,
  loss: LossFunction,
  config: {
    innerLR: number;
    outerLR: number;
    innerSteps: number;
    outerSteps: number;
  },
): Parameters {
  const { innerLR, outerLR, innerSteps, outerSteps } = config;

  const metaParams = [...initialParams];

  for (let epoch = 0; epoch < outerSteps; epoch++) {
    for (const task of tasks) {
      // Adapt to task
      let taskParams = [...metaParams];

      for (let step = 0; step < innerSteps; step++) {
        const gradient = computeGradient(
          taskParams,
          task.support.inputs,
          task.support.labels,
          model,
          loss,
        );

        taskParams = taskParams.map((p, i) => p - innerLR * gradient[i]!);
      }

      // Update meta-parameters toward adapted parameters
      for (let i = 0; i < metaParams.length; i++) {
        const taskParam = taskParams[i];
        const metaParam = metaParams[i];
        if (taskParam !== undefined && metaParam !== undefined) {
          metaParams[i] = metaParam + outerLR * (taskParam - metaParam);
        }
      }
    }
  }

  return metaParams;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Compute gradient via finite differences
 */
function computeGradient(
  params: Parameters,
  inputs: ReadonlyArray<ReadonlyArray<number>>,
  labels: ReadonlyArray<number>,
  model: ModelFunction,
  loss: LossFunction,
  epsilon = 1e-5,
): ReadonlyArray<number> {
  const gradient: number[] = new Array(params.length).fill(0);

  for (let i = 0; i < params.length; i++) {
    // Compute loss with parameter perturbed up
    const paramsPlus = params.map((p, j) => (j === i ? p + epsilon : p));
    const lossPlus = computeTaskLoss(paramsPlus, inputs, labels, model, loss);

    // Compute loss with parameter perturbed down
    const paramsMinus = params.map((p, j) => (j === i ? p - epsilon : p));
    const lossMinus = computeTaskLoss(paramsMinus, inputs, labels, model, loss);

    // Central difference
    gradient[i] = (lossPlus - lossMinus) / (2 * epsilon);
  }

  return gradient;
}

/**
 * Compute total loss on dataset
 */
function computeTaskLoss(
  params: Parameters,
  inputs: ReadonlyArray<ReadonlyArray<number>>,
  labels: ReadonlyArray<number>,
  model: ModelFunction,
  loss: LossFunction,
): number {
  let totalLoss = 0;

  for (let i = 0; i < inputs.length; i++) {
    const prediction = model(inputs[i]!, params);
    totalLoss += loss(prediction, labels[i]!);
  }

  return totalLoss / inputs.length;
}

/**
 * Evaluate meta-learned parameters on all tasks
 */
function evaluateTasks(
  tasks: ReadonlyArray<Task>,
  params: Parameters,
  model: ModelFunction,
  loss: LossFunction,
): number {
  let totalLoss = 0;

  for (const task of tasks) {
    const taskLoss = computeTaskLoss(params, task.query.inputs, task.query.labels, model, loss);
    totalLoss += taskLoss;
  }

  return totalLoss / tasks.length;
}

/**
 * Euclidean distance
 */
function euclideanDistance(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Compute centroid of vectors
 */
function computeCentroid(vectors: ReadonlyArray<ReadonlyArray<number>>): ReadonlyArray<number> {
  const dim = vectors[0]?.length || 0;
  const centroid = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i]!;
    }
  }

  return centroid.map((x) => x / vectors.length);
}

/**
 * Softmax function
 */
function softmax(values: ReadonlyArray<number>): ReadonlyArray<number> {
  const maxVal = Math.max(...values);
  const exps = values.map((x) => Math.exp(x - maxVal));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

/**
 * Cosine similarity attention kernel
 */
export function cosineSimilarity(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
