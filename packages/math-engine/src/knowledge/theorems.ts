/**
 * Mathematical Theorems Repository
 *
 * Collection of important mathematical theorems with:
 * - Statement
 * - Proof sketch
 * - Applications
 * - Historical context
 */

import { MathTopic } from './definitions';

/**
 * Mathematical theorem
 */
export interface Theorem {
  /** Unique identifier */
  readonly id: string;
  /** Theorem name */
  readonly name: string;
  /** Topic category */
  readonly topic: MathTopic;
  /** Formal statement */
  readonly statement: string;
  /** Informal explanation */
  readonly explanation: string;
  /** LaTeX statement */
  readonly latex?: string;
  /** Proof sketch or key ideas */
  readonly proofSketch: string;
  /** Practical applications */
  readonly applications: ReadonlyArray<string>;
  /** Prerequisites */
  readonly prerequisites: ReadonlyArray<string>;
  /** Related theorems */
  readonly related: ReadonlyArray<string>;
  /** Historical note */
  readonly history?: string;
  /** Importance level (1-5) */
  readonly importance: number;
}

// ============================================================================
// THEOREMS DATABASE
// ============================================================================

/**
 * Core mathematical theorems
 */
export const THEOREMS: ReadonlyArray<Theorem> = [
  // Calculus
  {
    id: 'fundamental-theorem-calculus',
    name: 'Fundamental Theorem of Calculus',
    topic: MathTopic.Calculus,
    statement:
      'If f is continuous on [a,b] and F is an antiderivative of f, then ∫ₐᵇ f(x)dx = F(b) - F(a).',
    explanation:
      'This theorem connects differentiation and integration - they are inverse operations. It tells us that to find the area under a curve, we just need to find an antiderivative and evaluate it at the endpoints.',
    latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)',
    proofSketch:
      "Define F(x) = ∫ₐˣ f(t)dt. Show F'(x) = f(x) using the definition of derivative and properties of integrals. Then use this to prove the evaluation formula.",
    applications: [
      'Computing definite integrals',
      'Finding areas and volumes',
      'Physics: work, energy calculations',
      'Differential equations',
    ],
    prerequisites: ['derivative', 'integral', 'continuity'],
    related: ['mean-value-theorem', 'integration-by-parts'],
    history:
      'Discovered independently by Newton and Leibniz in the 17th century, forming the foundation of calculus.',
    importance: 5,
  },
  {
    id: 'mean-value-theorem',
    name: 'Mean Value Theorem',
    topic: MathTopic.Calculus,
    statement:
      "If f is continuous on [a,b] and differentiable on (a,b), then there exists c in (a,b) such that f'(c) = [f(b) - f(a)]/(b - a).",
    explanation:
      "At some point between a and b, the instantaneous rate of change equals the average rate of change. Geometrically, there's a point where the tangent line is parallel to the secant line.",
    latex: "f'(c) = \\frac{f(b) - f(a)}{b - a}",
    proofSketch:
      "Consider the function g(x) = f(x) - [f(a) + (x-a)·(f(b)-f(a))/(b-a)]. Apply Rolle's theorem to g, which has g(a) = g(b) = 0.",
    applications: [
      'Proving inequalities',
      'Analyzing function behavior',
      'Error estimation',
      'Proving other theorems',
    ],
    prerequisites: ['derivative', 'continuity', 'rolles-theorem'],
    related: ['rolles-theorem', 'fundamental-theorem-calculus'],
    importance: 4,
  },
  {
    id: 'chain-rule',
    name: 'Chain Rule',
    topic: MathTopic.Calculus,
    statement:
      "If g is differentiable at x and f is differentiable at g(x), then the composition f∘g is differentiable at x and (f∘g)'(x) = f'(g(x))·g'(x).",
    explanation:
      'When differentiating a composition of functions, multiply the derivative of the outer function (evaluated at the inner function) by the derivative of the inner function.',
    latex: "\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)",
    proofSketch:
      'Use the definition of derivative and manipulate the difference quotient, introducing an auxiliary variable for g(x+h).',
    applications: [
      'Computing derivatives of composite functions',
      'Implicit differentiation',
      'Related rates problems',
      'Neural networks (backpropagation)',
    ],
    prerequisites: ['derivative', 'function-composition'],
    related: ['product-rule', 'quotient-rule'],
    importance: 5,
  },

  // Algebra
  {
    id: 'quadratic-formula',
    name: 'Quadratic Formula',
    topic: MathTopic.Algebra,
    statement: 'The solutions to ax² + bx + c = 0 are x = [-b ± √(b² - 4ac)]/(2a).',
    explanation:
      'This formula gives the exact solutions to any quadratic equation. The discriminant b² - 4ac tells us how many real solutions exist.',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    proofSketch:
      'Complete the square on ax² + bx + c = 0. Isolate the squared term and take square roots.',
    applications: [
      'Solving quadratic equations',
      'Analyzing parabolas',
      'Physics: projectile motion',
      'Optimization problems',
    ],
    prerequisites: ['polynomial', 'square-root'],
    related: ['discriminant', 'vietas-formulas'],
    history: 'Known to ancient Babylonians, formalized by Al-Khwarizmi in the 9th century.',
    importance: 5,
  },
  {
    id: 'binomial-theorem',
    name: 'Binomial Theorem',
    topic: MathTopic.Algebra,
    statement: '(x + y)ⁿ = Σₖ₌₀ⁿ C(n,k)xⁿ⁻ᵏyᵏ, where C(n,k) = n!/(k!(n-k)!).',
    explanation:
      "This theorem gives a formula for expanding powers of binomials. The coefficients are binomial coefficients from Pascal's triangle.",
    latex: '(x + y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k',
    proofSketch:
      "Use mathematical induction. Base case n=1 is trivial. Inductive step uses Pascal's identity: C(n+1,k) = C(n,k-1) + C(n,k).",
    applications: [
      'Polynomial expansion',
      'Probability calculations',
      'Combinatorics',
      'Taylor series',
    ],
    prerequisites: ['polynomial', 'factorial', 'combination'],
    related: ['pascals-triangle', 'multinomial-theorem'],
    importance: 4,
  },

  // Linear Algebra
  {
    id: 'rank-nullity',
    name: 'Rank-Nullity Theorem',
    topic: MathTopic.LinearAlgebra,
    statement:
      'For a linear transformation T: V → W, dim(V) = rank(T) + nullity(T), where rank is the dimension of the image and nullity is the dimension of the kernel.',
    explanation:
      "This theorem relates the dimension of the domain to the dimensions of the image and kernel. It's a fundamental constraint on linear transformations.",
    latex: '\\dim(V) = \\text{rank}(T) + \\text{nullity}(T)',
    proofSketch:
      'Choose a basis for ker(T), extend it to a basis for V. Show that the images of the extension vectors form a basis for im(T).',
    applications: [
      'Analyzing linear transformations',
      'Solving systems of equations',
      'Data analysis (PCA)',
      'Computer graphics',
    ],
    prerequisites: ['vector-space', 'linear-transformation', 'basis'],
    related: ['dimension-theorem', 'isomorphism-theorems'],
    importance: 4,
  },
  {
    id: 'spectral-theorem',
    name: 'Spectral Theorem',
    topic: MathTopic.LinearAlgebra,
    statement:
      'Every symmetric real matrix can be diagonalized by an orthogonal matrix. Equivalently, it has an orthonormal basis of eigenvectors.',
    explanation:
      'Symmetric matrices have particularly nice properties: all eigenvalues are real, and eigenvectors corresponding to different eigenvalues are orthogonal.',
    latex: 'A = Q\\Lambda Q^T',
    proofSketch:
      'Show eigenvalues are real. Prove eigenvectors for distinct eigenvalues are orthogonal. Use induction on dimension with Gram-Schmidt.',
    applications: [
      'Principal component analysis',
      'Quantum mechanics',
      'Optimization',
      'Differential equations',
    ],
    prerequisites: ['eigenvalue', 'orthogonality', 'matrix'],
    related: ['singular-value-decomposition', 'diagonalization'],
    importance: 5,
  },

  // Number Theory
  {
    id: 'fundamental-theorem-arithmetic',
    name: 'Fundamental Theorem of Arithmetic',
    topic: MathTopic.NumberTheory,
    statement:
      'Every integer greater than 1 can be uniquely factored as a product of prime numbers (up to order).',
    explanation:
      'Every number has exactly one prime factorization. This makes primes the "building blocks" of all integers.',
    latex: 'n = p_1^{a_1} p_2^{a_2} \\cdots p_k^{a_k}',
    proofSketch:
      "Existence: Use strong induction. Uniqueness: Suppose two factorizations exist. Use Euclid's lemma to show they must be identical.",
    applications: [
      'Cryptography (RSA)',
      'Number theory proofs',
      'GCD and LCM calculations',
      'Fraction simplification',
    ],
    prerequisites: ['prime-number', 'divisibility'],
    related: ['euclids-lemma', 'unique-factorization-domain'],
    importance: 5,
  },
  {
    id: 'fermats-little-theorem',
    name: "Fermat's Little Theorem",
    topic: MathTopic.NumberTheory,
    statement: 'If p is prime and a is not divisible by p, then aᵖ⁻¹ ≡ 1 (mod p).',
    explanation:
      "This theorem gives a pattern for powers modulo a prime. It's fundamental to modern cryptography.",
    latex: 'a^{p-1} \\equiv 1 \\pmod{p}',
    proofSketch:
      "Consider the set {a, 2a, 3a, ..., (p-1)a} mod p. Show it's a permutation of {1, 2, ..., p-1}. Multiply all elements.",
    applications: [
      'Primality testing',
      'Cryptography (RSA)',
      'Modular exponentiation',
      'Number theory proofs',
    ],
    prerequisites: ['prime-number', 'modular-arithmetic'],
    related: ['eulers-theorem', 'chinese-remainder-theorem'],
    importance: 4,
  },

  // Abstract Algebra
  {
    id: 'lagranges-theorem',
    name: "Lagrange's Theorem",
    topic: MathTopic.AbstractAlgebra,
    statement: 'For a finite group G and subgroup H, the order of H divides the order of G.',
    explanation:
      'The size of any subgroup must divide the size of the whole group. This constrains what subgroups can exist.',
    latex: '|H| \\mid |G|',
    proofSketch:
      'Partition G into cosets of H. Show all cosets have the same size as H. Count elements.',
    applications: ['Group theory', 'Cryptography', 'Coding theory', 'Symmetry analysis'],
    prerequisites: ['group', 'subgroup', 'coset'],
    related: ['sylow-theorems', 'cauchy-theorem'],
    importance: 4,
  },

  // Topology
  {
    id: 'heine-borel',
    name: 'Heine-Borel Theorem',
    topic: MathTopic.Topology,
    statement: 'A subset of ℝⁿ is compact if and only if it is closed and bounded.',
    explanation:
      'This theorem gives a simple test for compactness in Euclidean space. Compact sets have many nice properties.',
    latex: 'K \\text{ compact} \\iff K \\text{ closed and bounded}',
    proofSketch:
      'Forward: Compact implies bounded (cover with balls). Compact implies closed (limit points). Reverse: Use Bolzano-Weierstrass.',
    applications: [
      'Analysis proofs',
      'Optimization (extreme value theorem)',
      'Functional analysis',
      'Differential equations',
    ],
    prerequisites: ['topological-space', 'compactness', 'closed-set'],
    related: ['bolzano-weierstrass', 'extreme-value-theorem'],
    importance: 4,
  },

  // Analysis
  {
    id: 'intermediate-value-theorem',
    name: 'Intermediate Value Theorem',
    topic: MathTopic.Analysis,
    statement:
      'If f is continuous on [a,b] and f(a) ≠ f(b), then for any value k between f(a) and f(b), there exists c in (a,b) such that f(c) = k.',
    explanation:
      'A continuous function on an interval takes on every value between its endpoints. This means you can\'t "skip" values.',
    latex: 'f(a) < k < f(b) \\implies \\exists c: f(c) = k',
    proofSketch:
      'Consider the set S = {x ∈ [a,b] : f(x) < k}. Take c = sup(S). Use continuity to show f(c) = k.',
    applications: [
      'Root-finding algorithms',
      'Proving existence of solutions',
      'Fixed point theorems',
      'Topology',
    ],
    prerequisites: ['continuous-function', 'interval'],
    related: ['extreme-value-theorem', 'mean-value-theorem'],
    importance: 4,
  },
];

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get theorem by ID
 */
export function getTheorem(id: string): Theorem | undefined {
  return THEOREMS.find((thm) => thm.id === id);
}

/**
 * Search theorems
 */
export function searchTheorems(query: string): ReadonlyArray<Theorem> {
  const lowerQuery = query.toLowerCase();
  return THEOREMS.filter(
    (thm) =>
      thm.name.toLowerCase().includes(lowerQuery) ||
      thm.statement.toLowerCase().includes(lowerQuery) ||
      thm.explanation.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Get theorems by topic
 */
export function getTheoremsByTopic(topic: MathTopic): ReadonlyArray<Theorem> {
  return THEOREMS.filter((thm) => thm.topic === topic);
}

/**
 * Get theorems by importance
 */
export function getTheoremsByImportance(minImportance: number): ReadonlyArray<Theorem> {
  return THEOREMS.filter((thm) => thm.importance >= minImportance).sort(
    (a, b) => b.importance - a.importance,
  );
}

/**
 * Get related theorems
 */
export function getRelatedTheorems(id: string): ReadonlyArray<Theorem> {
  const thm = getTheorem(id);
  if (!thm) return [];

  return THEOREMS.filter((t) => thm.related.includes(t.id) || t.related.includes(id));
}
