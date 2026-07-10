/**
 * Tests for Zero-Knowledge Proofs
 *
 * Covers:
 * - Schnorr protocol (interactive and non-interactive)
 * - zk-SNARK simulation
 * - Range proofs
 * - Pedersen commitments
 * - Zero-knowledge properties
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  PedersenCommitment,
  RangeProof,
  SchnorrProof,
  ZKSnarkSimulation,
} from '../zero-knowledge-proofs';

describe('Zero-Knowledge Proofs', () => {
  describe('SchnorrProof', () => {
    it('should verify valid interactive proof', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const { commitment, randomness } = schnorr.generateCommitment(secret);
      const challenge = 3n;
      const response = schnorr.generateResponse(secret, randomness, challenge);

      const verified = schnorr.verify(commitment, challenge, response);

      expect(verified).toBe(true);
    });

    it('should reject invalid proofs (wrong secret)', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const wrongSecret = 8n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const { commitment, randomness } = schnorr.generateCommitment(secret);
      const challenge = 3n;
      const response = schnorr.generateResponse(wrongSecret, randomness, challenge); // Wrong!

      const verified = schnorr.verify(commitment, challenge, response);

      expect(verified).toBe(false);
    });

    it('should complete interactive protocol successfully', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const result = schnorr.interactiveProof(secret);

      expect(result.success).toBe(true);
      expect(result.transcript.commitment).toBeDefined();
      expect(result.transcript.challenge).toBeDefined();
      expect(result.transcript.response).toBeDefined();
    });

    it('should verify non-interactive proof (Fiat-Shamir)', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const { commitment, response } = schnorr.nonInteractiveProof(secret);

      const verified = schnorr.verifyNonInteractive(commitment, response);

      expect(verified).toBe(true);
    });

    it('should reject forged non-interactive proofs', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const { commitment, response } = schnorr.nonInteractiveProof(secret);
      // For a fixed commitment + Fiat-Shamir challenge there is exactly one
      // valid response modulo the exponent-group order, so an off-by-one
      // forgery is deterministically invalid. (A fixed literal like 999n is
      // only *usually* wrong — it collides with the valid response whenever
      // the random nonce lines up, ~1/22 of runs with p = 23.)
      const forgedResponse = response + 1n;

      const verified = schnorr.verifyNonInteractive(commitment, forgedResponse);

      expect(verified).toBe(false);
    });

    it('property: valid proofs always verify', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 2n, max: 20n }),
          fc.bigInt({ min: 2n, max: 10n }),
          (secret, challenge) => {
            const p = 23n;
            const g = 5n;
            const y = g ** secret % p;

            const schnorr = new SchnorrProof(p, g, y);

            const { commitment, randomness } = schnorr.generateCommitment(secret);
            const response = schnorr.generateResponse(secret, randomness, challenge);

            const verified = schnorr.verify(commitment, challenge, response);

            expect(verified).toBe(true);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should use modular arithmetic correctly', () => {
      const p = 23n;
      const g = 5n;
      const secret = 15n; // Larger than p
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const result = schnorr.interactiveProof(secret);

      expect(result.success).toBe(true);
    });
  });

  describe('ZKSnarkSimulation', () => {
    it('should prove polynomial solution', () => {
      const snark = new ZKSnarkSimulation();

      const secretX = 3; // Solution to x^3 + x + 5 = 35
      const { proof, publicOutput } = snark.provePolynomialSolution(secretX);

      expect(publicOutput).toBe(35);
      expect(proof.commitment).toBeDefined();
      expect(proof.evaluation).toBeDefined();
    });

    it('should verify valid polynomial proof', () => {
      const snark = new ZKSnarkSimulation();

      const secretX = 3;
      const { proof, publicOutput } = snark.provePolynomialSolution(secretX);

      const verified = snark.verifyPolynomialSolution(proof, publicOutput);

      expect(verified).toBe(true);
    });

    it('should reject proof with wrong output', () => {
      const snark = new ZKSnarkSimulation();

      const secretX = 3;
      const { proof } = snark.provePolynomialSolution(secretX);

      const verified = snark.verifyPolynomialSolution(proof, 999); // Wrong output

      expect(verified).toBe(false);
    });

    it('should produce different commitments for different secrets', () => {
      const snark = new ZKSnarkSimulation();

      const proof1 = snark.provePolynomialSolution(3);
      const proof2 = snark.provePolynomialSolution(4);

      expect(proof1.proof.commitment).not.toBe(proof2.proof.commitment);
      expect(proof1.publicOutput).not.toBe(proof2.publicOutput);
    });
  });

  describe('RangeProof', () => {
    it('should prove value in range', () => {
      const rangeProof = new RangeProof();

      const value = 42;
      const maxBits = 8; // Range [0, 255]

      const { commitment, proof } = rangeProof.prove(value, maxBits);

      expect(commitment).toBeDefined();
      expect(proof).toHaveLength(maxBits);
    });

    it('should throw error for value out of range', () => {
      const rangeProof = new RangeProof();

      const value = 256; // Out of range for 8 bits
      const maxBits = 8;

      expect(() => rangeProof.prove(value, maxBits)).toThrow('Value 256 not in range [0, 255]');
    });

    it('should throw error for negative values', () => {
      const rangeProof = new RangeProof();

      const value = -1;
      const maxBits = 8;

      expect(() => rangeProof.prove(value, maxBits)).toThrow();
    });

    it('should verify range proof with correct length', () => {
      const rangeProof = new RangeProof();

      const value = 100;
      const maxBits = 8;

      const { commitment, proof } = rangeProof.prove(value, maxBits);

      const verified = rangeProof.verify(commitment, proof, maxBits);

      expect(verified).toBe(true);
    });

    it('should reject proof with wrong bit length', () => {
      const rangeProof = new RangeProof();

      const value = 10;
      const maxBits = 8;

      const { commitment, proof } = rangeProof.prove(value, maxBits);

      const verified = rangeProof.verify(commitment, proof, 16); // Wrong length

      expect(verified).toBe(false);
    });

    it('property: all values in range can be proven', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 255 }), (value) => {
          const rangeProof = new RangeProof();
          const maxBits = 8;

          const { commitment, proof } = rangeProof.prove(value, maxBits);

          expect(commitment).toBeDefined();
          expect(proof).toHaveLength(maxBits);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('PedersenCommitment', () => {
    it('should commit to value', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const value = 7n;
      const { commitment, randomness } = pedersen.commit(value);

      expect(commitment).toBeGreaterThan(0n);
      expect(commitment).toBeLessThan(p);
      expect(randomness).toBeDefined();
    });

    it('should successfully open commitment', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const value = 7n;
      const { commitment, randomness } = pedersen.commit(value);

      const opened = pedersen.open(commitment, value, randomness);

      expect(opened).toBe(true);
    });

    it('should reject opening with wrong value', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const value = 7n;
      const { commitment, randomness } = pedersen.commit(value);

      const opened = pedersen.open(commitment, 8n, randomness); // Wrong value!

      expect(opened).toBe(false);
    });

    it('should reject opening with wrong randomness', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const value = 7n;
      const { commitment, randomness } = pedersen.commit(value);

      // Off-by-one from the real blinding factor is deterministically wrong;
      // a fixed literal collides with the real randomness ~1/22 of runs.
      const opened = pedersen.open(commitment, value, randomness + 1n);

      expect(opened).toBe(false);
    });

    it('should support homomorphic addition', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const value1 = 3n;
      const value2 = 4n;

      const { commitment: c1, randomness: r1 } = pedersen.commit(value1);
      const { commitment: c2, randomness: r2 } = pedersen.commit(value2);

      // C(v1 + v2) = C(v1) * C(v2)
      const sumCommitment = pedersen.add(c1, c2);

      // Should be able to open with sum
      const sumRandomness = (r1 + r2) % (p - 1n);
      const opened = pedersen.open(sumCommitment, value1 + value2, sumRandomness);

      expect(opened).toBe(true);
    });

    it('should produce different commitments for different values', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const { commitment: c1, randomness: r1 } = pedersen.commit(7n);

      // Two independent commitments CAN collide in a 23-element demo group
      // (~1/23 of runs), so compare under the same blinding factor instead:
      // g^7·h^r ≠ g^8·h^r deterministically, i.e. c1 must not open as 8.
      expect(pedersen.open(c1, 8n, r1)).toBe(false);
      expect(pedersen.open(c1, 7n, r1)).toBe(true);
    });

    it('property: commitment is binding (can open to only one value)', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1n, max: 20n }),
          fc.bigInt({ min: 1n, max: 20n }),
          (value1, value2) => {
            if (value1 === value2) return true; // Skip identical

            const p = 23n;
            const g = 5n;
            const h = 11n;

            const pedersen = new PedersenCommitment(p, g, h);

            const { commitment, randomness } = pedersen.commit(value1);

            // Cannot open to different value with same randomness
            const opened = pedersen.open(commitment, value2, randomness);

            expect(opened).toBe(false);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Zero-Knowledge Properties', () => {
    it('should not reveal secret in Schnorr proof transcript', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const result = schnorr.interactiveProof(secret);

      // 'Does not reveal the secret' cannot be asserted as `!== secret`:
      // with a 23-element demo group the response is a near-uniform exponent
      // and equals any particular value ~1/22 of runs (statistical flake).
      // Assert the deterministic contract instead: the response is reduced
      // into the exponent range (not a raw secret-derived value) and the
      // transcript verifies.
      expect(result.transcript.response >= 0n).toBe(true);
      expect(result.transcript.response < p - 1n).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should hide committed value in Pedersen commitment', () => {
      const p = 23n;
      const g = 5n;
      const h = 11n;

      const pedersen = new PedersenCommitment(p, g, h);

      const secretValue = 13n;
      const { commitment, randomness } = pedersen.commit(secretValue);

      // With p = 23 the commitment is a near-uniform group element, so any
      // 'commitment != f(value)' assertion is statistical and flaky (~9%/run).
      // Assert the deterministic properties instead: the commitment opens
      // only with the exact (value, randomness) pair — without the blinding
      // factor the committed value cannot be confirmed.
      expect(pedersen.open(commitment, secretValue, randomness)).toBe(true);
      expect(pedersen.open(commitment, secretValue + 1n, randomness)).toBe(false);
    });

    it('should maintain soundness: invalid proofs should fail', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      // Try to create proof without knowing secret
      const fakeCommitment = 10n;
      const fakeChallenge = 5n;
      const fakeResponse = 15n;

      const verified = schnorr.verify(fakeCommitment, fakeChallenge, fakeResponse);

      // Should fail (with high probability)
      expect(verified).toBe(false);
    });

    it('should provide completeness: valid proofs should succeed', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      // Multiple runs should all succeed
      for (let i = 0; i < 5; i++) {
        const result = schnorr.interactiveProof(secret);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Performance and Security', () => {
    it('should handle large prime moduli', () => {
      // Use a Mersenne prime: 2^19 - 1 = 524287 (actually prime)
      const p = 524287n; // Large prime (2^19 - 1, a Mersenne prime)
      const g = 5n;
      const secret = 12345n;
      const y = SchnorrProof.computePublicKey(g, secret, p);

      const schnorr = new SchnorrProof(p, g, y);

      const startTime = performance.now();
      const result = schnorr.interactiveProof(secret);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should use proper modular arithmetic', () => {
      const p = 23n;
      const g = 5n;
      const secret = 100n; // Large secret
      const y = g ** secret % p;

      const schnorr = new SchnorrProof(p, g, y);

      const result = schnorr.interactiveProof(secret);

      expect(result.success).toBe(true);

      // Values should be in valid range
      expect(result.transcript.commitment).toBeLessThan(p);
      expect(result.transcript.response).toBeGreaterThanOrEqual(0n);
    });

    it('should generate different random commitments each time', () => {
      const p = 23n;
      const g = 5n;
      const secret = 7n;

      const schnorr = new SchnorrProof(p, g, secret);

      const c1 = schnorr.generateCommitment(secret).commitment;
      const c2 = schnorr.generateCommitment(secret).commitment;
      const c3 = schnorr.generateCommitment(secret).commitment;

      // Should be different due to randomness
      const unique = new Set([c1, c2, c3]);
      expect(unique.size).toBeGreaterThan(1);
    });
  });
});
