/**
 * Positional Encoding
 *
 * Since transformers have no inherent notion of position/order, we add
 * positional information to the input embeddings.
 *
 * Uses sinusoidal functions of different frequencies:
 * PE(pos, 2i) = sin(pos / 10000^(2i/d))
 * PE(pos, 2i+1) = cos(pos / 10000^(2i/d))
 *
 * "Attention Is All You Need" - Vaswani et al., 2017
 */

import type { Matrix } from './attention';

/**
 * Generate sinusoidal positional encodings
 *
 * @param maxLen - Maximum sequence length
 * @param dim - Embedding dimension (model dimension)
 * @returns Positional encoding matrix (maxLen × dim)
 */
export function generatePositionalEncoding(maxLen: number, dim: number): Matrix {
  const encoding: number[][] = [];

  for (let pos = 0; pos < maxLen; pos++) {
    encoding[pos] = [];

    for (let i = 0; i < dim; i++) {
      const angle = pos / 10000 ** ((2 * Math.floor(i / 2)) / dim);

      // Even indices: sin, Odd indices: cos
      if (i % 2 === 0) {
        encoding[pos]![i] = Math.sin(angle);
      } else {
        encoding[pos]![i] = Math.cos(angle);
      }
    }
  }

  return encoding;
}

/**
 * Add positional encoding to input embeddings
 *
 * @param embeddings - Input embeddings (seqLen × dim)
 * @param positionalEncoding - Pre-computed positional encodings
 * @returns Embeddings with position information
 */
export function addPositionalEncoding(embeddings: Matrix, positionalEncoding: Matrix): Matrix {
  const seqLen = embeddings.length;
  const dim = embeddings[0]?.length || 0;

  if (seqLen > positionalEncoding.length) {
    throw new Error(`Sequence length ${seqLen} exceeds max length ${positionalEncoding.length}`);
  }

  const result: number[][] = [];

  for (let i = 0; i < seqLen; i++) {
    result[i] = [];
    for (let j = 0; j < dim; j++) {
      result[i]![j] = (embeddings[i]?.[j] || 0) + (positionalEncoding[i]?.[j] || 0);
    }
  }

  return result;
}

/**
 * Learned Positional Embeddings (alternative to sinusoidal)
 *
 * Instead of fixed sinusoidal functions, learn position embeddings
 * during training. Used in models like BERT.
 */
export class LearnedPositionalEmbedding {
  private embeddings: Matrix;

  constructor(
    public readonly maxLen: number,
    public readonly dim: number,
  ) {
    // Initialize with small random values
    this.embeddings = this.initialize();
  }

  private initialize(): Matrix {
    const scale = 0.02;
    const embeddings: number[][] = [];

    for (let i = 0; i < this.maxLen; i++) {
      embeddings[i] = [];
      for (let j = 0; j < this.dim; j++) {
        embeddings[i]![j] = (Math.random() * 2 - 1) * scale;
      }
    }

    return embeddings;
  }

  /**
   * Get positional embedding for given positions
   */
  getEmbedding(positions: ReadonlyArray<number>): Matrix {
    return positions.map((pos) => {
      if (pos >= this.maxLen) {
        throw new Error(`Position ${pos} exceeds max length ${this.maxLen}`);
      }
      return this.embeddings[pos]!;
    });
  }

  /**
   * Add to input embeddings
   */
  addToEmbeddings(embeddings: Matrix): Matrix {
    const seqLen = embeddings.length;
    const result: number[][] = [];

    for (let i = 0; i < seqLen; i++) {
      result[i] = [];
      for (let j = 0; j < this.dim; j++) {
        result[i]![j] = (embeddings[i]?.[j] || 0) + (this.embeddings[i]?.[j] || 0);
      }
    }

    return result;
  }

  /**
   * Update embeddings (during training)
   */
  update(gradients: Matrix, learningRate: number): void {
    // Create mutable copy for update
    const mutableEmbeddings = this.embeddings.map((row) => [...row]);

    for (let i = 0; i < Math.min(gradients.length, this.maxLen); i++) {
      for (let j = 0; j < this.dim; j++) {
        const currentVal = mutableEmbeddings[i]?.[j];
        if (currentVal !== undefined) {
          mutableEmbeddings[i]![j] = currentVal - learningRate * (gradients[i]?.[j] || 0);
        }
      }
    }

    this.embeddings = mutableEmbeddings;
  }
}

/**
 * Relative Positional Encoding (Transformer-XL, T5)
 *
 * Encodes relative distances between positions rather than absolute positions.
 * Allows better generalization to longer sequences.
 */
export class RelativePositionalEncoding {
  private biases: Matrix;

  constructor(
    public readonly maxRelativePosition: number,
    public readonly numHeads: number,
  ) {
    this.biases = this.initialize();
  }

  private initialize(): Matrix {
    const scale = 0.02;
    const numRelativePositions = 2 * this.maxRelativePosition + 1;
    const biases: number[][] = [];

    for (let i = 0; i < numRelativePositions; i++) {
      biases[i] = [];
      for (let j = 0; j < this.numHeads; j++) {
        biases[i]![j] = (Math.random() * 2 - 1) * scale;
      }
    }

    return biases;
  }

  /**
   * Get relative position bias
   */
  getBias(queryPos: number, keyPos: number): ReadonlyArray<number> {
    const relativePos = keyPos - queryPos;
    const clampedPos = Math.max(
      -this.maxRelativePosition,
      Math.min(this.maxRelativePosition, relativePos),
    );

    const index = clampedPos + this.maxRelativePosition;
    return this.biases[index]!;
  }

  /**
   * Apply relative position bias to attention scores
   */
  applyBias(attentionScores: Matrix, headIndex: number): Matrix {
    const seqLen = attentionScores.length;
    const biasedScores: number[][] = [];

    for (let i = 0; i < seqLen; i++) {
      biasedScores[i] = [];
      for (let j = 0; j < seqLen; j++) {
        const bias = this.getBias(i, j)[headIndex] || 0;
        biasedScores[i]![j] = (attentionScores[i]?.[j] || 0) + bias;
      }
    }

    return biasedScores;
  }
}

/**
 * Rotary Position Embedding (RoPE)
 *
 * Used in models like GPT-Neo, LLaMA.
 * Applies rotation to query and key vectors based on position.
 *
 * More efficient than adding position encodings.
 */
export function applyRotaryEmbedding(
  vectors: Matrix,
  positions: ReadonlyArray<number>,
  dim: number,
): Matrix {
  const seqLen = vectors.length;
  const result: number[][] = [];

  for (let i = 0; i < seqLen; i++) {
    result[i] = [];
    const pos = positions[i]!;

    for (let j = 0; j < dim; j += 2) {
      const freq = 1.0 / 10000 ** (j / dim);
      const angle = pos * freq;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = vectors[i]?.[j] || 0;
      const y = vectors[i]?.[j + 1] || 0;

      // Rotation matrix application
      result[i]![j] = x * cos - y * sin;
      result[i]![j + 1] = x * sin + y * cos;
    }
  }

  return result;
}

/**
 * ALiBi (Attention with Linear Biases)
 *
 * Simple and efficient alternative to positional encoding.
 * Adds linear bias to attention scores based on distance.
 *
 * Used in models like BLOOM.
 */
export class ALiBiPositionalBias {
  private slopes: ReadonlyArray<number>;

  constructor(public readonly numHeads: number) {
    this.slopes = this.computeSlopes();
  }

  /**
   * Compute geometric sequence of slopes for each head
   */
  private computeSlopes(): ReadonlyArray<number> {
    const slopes: number[] = [];
    const ratio = 2 ** (-8 / this.numHeads);

    for (let i = 0; i < this.numHeads; i++) {
      slopes.push(ratio ** (i + 1));
    }

    return slopes;
  }

  /**
   * Apply linear bias to attention scores
   */
  applyBias(attentionScores: Matrix, headIndex: number): Matrix {
    const numQueries = attentionScores.length;
    const numKeys = attentionScores[0]?.length || 0;
    const slope = this.slopes[headIndex] || 1;
    const biasedScores: number[][] = [];

    for (let i = 0; i < numQueries; i++) {
      biasedScores[i] = [];
      for (let j = 0; j < numKeys; j++) {
        // Bias is proportional to distance: -(i - j) * slope
        const distance = i - j;
        const bias = -Math.abs(distance) * slope;
        biasedScores[i]![j] = (attentionScores[i]?.[j] || 0) + bias;
      }
    }

    return biasedScores;
  }
}

/**
 * Visualize positional encoding patterns
 */
export function visualizePositionalEncoding(encoding: Matrix, maxDisplay = 10): string {
  const seqLen = Math.min(encoding.length, maxDisplay);
  const dim = Math.min(encoding[0]?.length || 0, 20);

  let output = 'Positional Encoding Visualization:\n';
  output += `(Showing first ${seqLen} positions, ${dim} dimensions)\n\n`;

  output += 'Pos |';
  for (let j = 0; j < dim; j++) {
    output += ` ${j.toString().padStart(5)}`;
  }
  output += '\n';

  output += '----+';
  for (let j = 0; j < dim; j++) {
    output += '------';
  }
  output += '\n';

  for (let i = 0; i < seqLen; i++) {
    output += `${i.toString().padStart(3)} |`;
    for (let j = 0; j < dim; j++) {
      const val = encoding[i]?.[j] || 0;
      output += ` ${val.toFixed(2).padStart(5)}`;
    }
    output += '\n';
  }

  return output;
}
