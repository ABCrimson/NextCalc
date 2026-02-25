/**
 * Modern Cryptography & Quantum Computing Algorithms
 *
 * Implementations of cutting-edge cryptographic protocols and
 * quantum computing simulations:
 * - Zero-knowledge proofs
 * - Homomorphic encryption basics
 * - Multi-party computation
 * - Post-quantum cryptography
 * - Quantum gate operations
 * - Quantum algorithms (Grover, Shor, QFT)
 *
 * @module modern-crypto-quantum
 * @version 1.0.0
 */

// ============================================================================
// CRYPTOGRAPHY & SECURITY ALGORITHMS
// ============================================================================

/**
 * Big integer type (for cryptographic operations)
 */
export type BigInt = bigint;

// ----------------------------------------------------------------------------
// 1. Zero-Knowledge Proof (Schnorr Protocol)
// ----------------------------------------------------------------------------

/**
 * Schnorr Zero-Knowledge Proof Protocol
 *
 * Proves knowledge of discrete logarithm without revealing it
 */
export class SchnorrProtocol {
  private readonly p: BigInt; // Large prime
  private readonly g: BigInt; // Generator
  private readonly q: BigInt; // Order of subgroup

  constructor(bitLength = 256) {
    // In production, use proper prime generation
    // This is a simplified version with small primes for demonstration
    this.p = BigInt(2) ** BigInt(bitLength) - BigInt(1);
    this.g = BigInt(2);
    this.q = (this.p - BigInt(1)) / BigInt(2);
  }

  /**
   * Generate public/private key pair
   */
  generateKeys(): { publicKey: BigInt; privateKey: BigInt } {
    const privateKey = this.randomBigInt(this.q);
    const publicKey = this.modPow(this.g, privateKey, this.p);
    return { publicKey, privateKey };
  }

  /**
   * Prover: Create commitment (first message)
   */
  commit(randomness: BigInt): BigInt {
    return this.modPow(this.g, randomness, this.p);
  }

  /**
   * Prover: Create response (third message)
   */
  respond(randomness: BigInt, challenge: BigInt, privateKey: BigInt): BigInt {
    return (randomness + challenge * privateKey) % this.q;
  }

  /**
   * Verifier: Verify the proof
   */
  verify(
    commitment: BigInt,
    challenge: BigInt,
    response: BigInt,
    publicKey: BigInt
  ): boolean {
    const left = this.modPow(this.g, response, this.p);
    const right =
      (commitment * this.modPow(publicKey, challenge, this.p)) % this.p;
    return left === right;
  }

  /**
   * Full interactive protocol
   */
  prove(privateKey: BigInt, challenge: BigInt): {
    commitment: BigInt;
    response: BigInt;
  } {
    const randomness = this.randomBigInt(this.q);
    const commitment = this.commit(randomness);
    const response = this.respond(randomness, challenge, privateKey);
    return { commitment, response };
  }

  private modPow(base: BigInt, exp: BigInt, mod: BigInt): BigInt {
    let result = BigInt(1);
    base = base % mod;

    while (exp > 0) {
      if (exp % BigInt(2) === BigInt(1)) {
        result = (result * base) % mod;
      }
      exp = exp / BigInt(2);
      base = (base * base) % mod;
    }

    return result;
  }

  private randomBigInt(max: BigInt): BigInt {
    // Simplified random generation
    const bytes = max.toString(16).length / 2;
    const randomHex = Array.from({ length: Math.ceil(bytes) }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('');
    return BigInt('0x' + randomHex) % max;
  }
}

// ----------------------------------------------------------------------------
// 2. Homomorphic Encryption (Paillier - Partial)
// ----------------------------------------------------------------------------

/**
 * Simplified Paillier Homomorphic Encryption
 *
 * Supports additive homomorphism: E(m1) * E(m2) = E(m1 + m2)
 */
export class PaillierEncryption {
  private readonly n: BigInt; // Public key (n = p * q)
  private readonly g: BigInt; // Generator
  private readonly lambda: BigInt; // Private key
  private readonly mu: BigInt; // Private key component

  constructor(p: BigInt, q: BigInt) {
    this.n = p * q;
    this.g = this.n + BigInt(1);
    this.lambda = this.lcm(p - BigInt(1), q - BigInt(1));
    this.mu = this.modInverse(this.l(this.modPow(this.g, this.lambda, this.n * this.n)), this.n);
  }

  /**
   * Encrypt a message
   */
  encrypt(message: BigInt, randomness?: BigInt): BigInt {
    const r = randomness ?? this.randomBigInt(this.n);
    const nSquared = this.n * this.n;
    const gm = this.modPow(this.g, message, nSquared);
    const rn = this.modPow(r, this.n, nSquared);
    return (gm * rn) % nSquared;
  }

  /**
   * Decrypt a ciphertext
   */
  decrypt(ciphertext: BigInt): BigInt {
    const nSquared = this.n * this.n;
    const u = this.modPow(ciphertext, this.lambda, nSquared);
    return (this.l(u) * this.mu) % this.n;
  }

  /**
   * Homomorphic addition: E(m1 + m2) = E(m1) * E(m2)
   */
  add(ciphertext1: BigInt, ciphertext2: BigInt): BigInt {
    const nSquared = this.n * this.n;
    return (ciphertext1 * ciphertext2) % nSquared;
  }

  /**
   * Homomorphic scalar multiplication: E(k * m) = E(m)^k
   */
  multiplyScalar(ciphertext: BigInt, scalar: BigInt): BigInt {
    const nSquared = this.n * this.n;
    return this.modPow(ciphertext, scalar, nSquared);
  }

  private l(x: BigInt): BigInt {
    return (x - BigInt(1)) / this.n;
  }

  private modPow(base: BigInt, exp: BigInt, mod: BigInt): BigInt {
    let result = BigInt(1);
    base = base % mod;

    while (exp > 0) {
      if (exp % BigInt(2) === BigInt(1)) {
        result = (result * base) % mod;
      }
      exp = exp / BigInt(2);
      base = (base * base) % mod;
    }

    return result;
  }

  private modInverse(a: BigInt, m: BigInt): BigInt {
    const [gcd, x, _] = this.extendedGCD(a, m);
    if (gcd !== BigInt(1)) {
      throw new Error('Modular inverse does not exist');
    }
    return (x % m + m) % m;
  }

  private extendedGCD(a: BigInt, b: BigInt): [BigInt, BigInt, BigInt] {
    if (b === BigInt(0)) {
      return [a, BigInt(1), BigInt(0)];
    }

    const [gcd, x1, y1] = this.extendedGCD(b, a % b);
    const x = y1;
    const y = x1 - (a / b) * y1;

    return [gcd, x, y];
  }

  private lcm(a: BigInt, b: BigInt): BigInt {
    return (a * b) / this.gcd(a, b);
  }

  private gcd(a: BigInt, b: BigInt): BigInt {
    while (b !== BigInt(0)) {
      [a, b] = [b, a % b];
    }
    return a;
  }

  private randomBigInt(max: BigInt): BigInt {
    const bytes = max.toString(16).length / 2;
    const randomHex = Array.from({ length: Math.ceil(bytes) }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('');
    return BigInt('0x' + randomHex) % max;
  }
}

// ----------------------------------------------------------------------------
// 3. Multi-Party Computation (Shamir Secret Sharing)
// ----------------------------------------------------------------------------

/**
 * Shamir's Secret Sharing Scheme
 *
 * Threshold secret sharing: k-of-n scheme
 */
export class ShamirSecretSharing {
  private readonly prime: BigInt;

  constructor(prime: BigInt = BigInt(2) ** BigInt(127) - BigInt(1)) {
    this.prime = prime;
  }

  /**
   * Split secret into n shares with threshold k
   */
  split(secret: BigInt, threshold: number, numShares: number): Array<{ x: BigInt; y: BigInt }> {
    if (threshold > numShares) {
      throw new Error('Threshold cannot exceed number of shares');
    }

    // Generate random coefficients for polynomial
    const coefficients: BigInt[] = [secret];
    for (let i = 1; i < threshold; i++) {
      coefficients.push(this.randomBigInt(this.prime));
    }

    // Evaluate polynomial at different points
    const shares: Array<{ x: BigInt; y: BigInt }> = [];
    for (let x = 1; x <= numShares; x++) {
      const xBig = BigInt(x);
      const y = this.evaluatePolynomial(coefficients, xBig);
      shares.push({ x: xBig, y });
    }

    return shares;
  }

  /**
   * Reconstruct secret from k shares using Lagrange interpolation
   */
  reconstruct(shares: Array<{ x: BigInt; y: BigInt }>): BigInt {
    let secret = BigInt(0);

    for (let i = 0; i < shares.length; i++) {
      const share = shares[i]!;
      let numerator = BigInt(1);
      let denominator = BigInt(1);

      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          const otherShare = shares[j]!;
          numerator = (numerator * (BigInt(0) - otherShare.x)) % this.prime;
          denominator = (denominator * (share.x - otherShare.x)) % this.prime;
        }
      }

      const lagrangeCoeff = (numerator * this.modInverse(denominator, this.prime)) % this.prime;
      secret = (secret + share.y * lagrangeCoeff) % this.prime;
    }

    return (secret + this.prime) % this.prime;
  }

  private evaluatePolynomial(coefficients: BigInt[], x: BigInt): BigInt {
    let result = BigInt(0);
    let xPower = BigInt(1);

    for (const coeff of coefficients) {
      result = (result + coeff * xPower) % this.prime;
      xPower = (xPower * x) % this.prime;
    }

    return result;
  }

  private modInverse(a: BigInt, m: BigInt): BigInt {
    const [gcd, x, _] = this.extendedGCD(a, m);
    if (gcd !== BigInt(1)) {
      throw new Error('Modular inverse does not exist');
    }
    return (x % m + m) % m;
  }

  private extendedGCD(a: BigInt, b: BigInt): [BigInt, BigInt, BigInt] {
    if (b === BigInt(0)) {
      return [a, BigInt(1), BigInt(0)];
    }

    const [gcd, x1, y1] = this.extendedGCD(b, a % b);
    const x = y1;
    const y = x1 - (a / b) * y1;

    return [gcd, x, y];
  }

  private randomBigInt(max: BigInt): BigInt {
    const bytes = max.toString(16).length / 2;
    const randomHex = Array.from({ length: Math.ceil(bytes) }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('');
    return BigInt('0x' + randomHex) % max;
  }
}

// ----------------------------------------------------------------------------
// 4. Post-Quantum Cryptography (Lattice-based - Simplified)
// ----------------------------------------------------------------------------

/**
 * Simplified Learning With Errors (LWE) encryption
 *
 * Foundation for many post-quantum schemes
 */
export class LWEEncryption {
  private readonly n: number; // Dimension
  private readonly q: number; // Modulus
  private readonly sigma: number; // Error standard deviation
  private readonly A: number[][]; // Public matrix
  private readonly s: number[]; // Secret vector

  constructor(n = 256, q = 4093, sigma = 1.0) {
    this.n = n;
    this.q = q;
    this.sigma = sigma;
    this.s = this.randomVector(n, q);
    this.A = this.randomMatrix(n, n, q);
  }

  /**
   * Encrypt a bit
   */
  encryptBit(bit: 0 | 1): { u: number[]; c: number } {
    // Select random subset
    const subset = Array.from({ length: this.n }, () => Math.random() < 0.5);

    // Compute u = sum of selected rows
    const u = Array(this.n).fill(0);
    for (let i = 0; i < this.n; i++) {
      if (subset[i]) {
        for (let j = 0; j < this.n; j++) {
          u[j] = (u[j]! + (this.A[i]?.[j] ?? 0)) % this.q;
        }
      }
    }

    // Compute c = <subset, As> + error + encode(bit)
    let c = 0;
    for (let i = 0; i < this.n; i++) {
      if (subset[i]) {
        for (let j = 0; j < this.n; j++) {
          c = (c + (this.A[i]?.[j] ?? 0) * (this.s[j] ?? 0)) % this.q;
        }
      }
    }

    const error = Math.round(this.gaussianRandom() * this.sigma);
    c = (c + error + (bit * Math.floor(this.q / 2))) % this.q;

    return { u, c };
  }

  /**
   * Decrypt a ciphertext
   */
  decryptBit(ciphertext: { u: number[]; c: number }): 0 | 1 {
    // Compute <u, s>
    let us = 0;
    for (let i = 0; i < this.n; i++) {
      us = (us + (ciphertext.u[i] ?? 0) * (this.s[i] ?? 0)) % this.q;
    }

    // Recover message
    const diff = (ciphertext.c - us + this.q) % this.q;
    const threshold = this.q / 4;

    return diff > threshold && diff < 3 * threshold ? 1 : 0;
  }

  private randomVector(size: number, max: number): number[] {
    return Array.from({ length: size }, () => Math.floor(Math.random() * max));
  }

  private randomMatrix(rows: number, cols: number, max: number): number[][] {
    return Array.from({ length: rows }, () => this.randomVector(cols, max));
  }

  private gaussianRandom(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ============================================================================
// QUANTUM COMPUTING SIMULATION
// ============================================================================

/**
 * Complex number for quantum states
 */
export interface Complex {
  readonly real: number;
  readonly imag: number;
}

/**
 * Quantum state vector
 */
export type QuantumState = ReadonlyArray<Complex>;

// ----------------------------------------------------------------------------
// 5. Quantum Gate Operations
// ----------------------------------------------------------------------------

/**
 * Basic quantum gates
 */
export class QuantumGates {
  /**
   * Pauli-X gate (NOT gate)
   */
  static X(): number[][] {
    return [
      [0, 1],
      [1, 0],
    ];
  }

  /**
   * Pauli-Y gate
   */
  static Y(): Complex[][] {
    return [
      [{ real: 0, imag: 0 }, { real: 0, imag: -1 }],
      [{ real: 0, imag: 1 }, { real: 0, imag: 0 }],
    ];
  }

  /**
   * Pauli-Z gate
   */
  static Z(): number[][] {
    return [
      [1, 0],
      [0, -1],
    ];
  }

  /**
   * Hadamard gate
   */
  static H(): number[][] {
    const sqrt2 = 1 / Math.sqrt(2);
    return [
      [sqrt2, sqrt2],
      [sqrt2, -sqrt2],
    ];
  }

  /**
   * CNOT gate (2-qubit)
   */
  static CNOT(): number[][] {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 1],
      [0, 0, 1, 0],
    ];
  }

  /**
   * Apply gate to quantum state
   */
  static apply(gate: number[][], state: Complex[]): Complex[] {
    const result: Complex[] = [];

    for (let i = 0; i < gate.length; i++) {
      let real = 0;
      let imag = 0;

      for (let j = 0; j < state.length; j++) {
        const gateVal = gate[i]?.[j] ?? 0;
        const stateVal = state[j] ?? { real: 0, imag: 0 };
        real += gateVal * stateVal.real;
        imag += gateVal * stateVal.imag;
      }

      result.push({ real, imag });
    }

    return result;
  }
}

// ----------------------------------------------------------------------------
// 6. Grover's Algorithm
// ----------------------------------------------------------------------------

/**
 * Grover's quantum search algorithm
 */
export class GroverAlgorithm {
  private readonly n: number; // Number of qubits

  constructor(n: number) {
    this.n = n;
  }

  /**
   * Run Grover's algorithm to search for target
   *
   * @param target - Target state to find
   * @returns Probability distribution after Grover iterations
   */
  search(target: number): number[] {
    const N = 2 ** this.n;
    const iterations = Math.floor((Math.PI / 4) * Math.sqrt(N));

    // Initialize to uniform superposition
    let state: Complex[] = Array.from({ length: N }, () => ({
      real: 1 / Math.sqrt(N),
      imag: 0,
    }));

    // Apply Grover iterations
    for (let iter = 0; iter < iterations; iter++) {
      // Oracle: flip phase of target
      state = state.map((amp, i) =>
        i === target ? { real: -amp.real, imag: -amp.imag } : amp
      );

      // Diffusion operator
      state = this.diffusion(state);
    }

    // Return probability distribution
    return state.map(amp => amp.real * amp.real + amp.imag * amp.imag);
  }

  private diffusion(state: Complex[]): Complex[] {
    const N = state.length;
    const avg = state.reduce((sum, amp) => sum + amp.real, 0) / N;

    return state.map(amp => ({
      real: 2 * avg - amp.real,
      imag: -amp.imag,
    }));
  }
}

// ----------------------------------------------------------------------------
// 7. Quantum Fourier Transform
// ----------------------------------------------------------------------------

/**
 * Quantum Fourier Transform
 */
export class QuantumFourierTransform {
  /**
   * Apply QFT to quantum state
   */
  static apply(state: Complex[]): Complex[] {
    const N = state.length;
    const result: Complex[] = Array(N).fill({ real: 0, imag: 0 });

    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;

      for (let j = 0; j < N; j++) {
        const phase = (2 * Math.PI * k * j) / N;
        const stateVal = state[j] ?? { real: 0, imag: 0 };

        real += stateVal.real * Math.cos(phase) + stateVal.imag * Math.sin(phase);
        imag += stateVal.imag * Math.cos(phase) - stateVal.real * Math.sin(phase);
      }

      result[k] = {
        real: real / Math.sqrt(N),
        imag: imag / Math.sqrt(N),
      };
    }

    return result;
  }
}

// Export all algorithms
export const ModernCryptoQuantumAlgorithms = {
  SchnorrProtocol,
  PaillierEncryption,
  ShamirSecretSharing,
  LWEEncryption,
  QuantumGates,
  GroverAlgorithm,
  QuantumFourierTransform,
};
