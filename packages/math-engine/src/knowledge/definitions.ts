/**
 * Mathematical Definitions Database
 *
 * Comprehensive collection of mathematical definitions organized by topic.
 * Each definition includes:
 * - Formal definition
 * - Intuitive explanation
 * - Examples
 * - Related concepts
 * - Prerequisites
 */

/**
 * Mathematical definition
 */
export interface Definition {
  /** Unique identifier */
  readonly id: string;
  /** Term being defined */
  readonly term: string;
  /** Topic category */
  readonly topic: MathTopic;
  /** Formal mathematical definition */
  readonly formal: string;
  /** Intuitive explanation for learners */
  readonly intuitive: string;
  /** Mathematical notation */
  readonly notation?: string;
  /** LaTeX representation */
  readonly latex?: string;
  /** Example usage */
  readonly examples: ReadonlyArray<string>;
  /** Related concepts */
  readonly related: ReadonlyArray<string>;
  /** Prerequisites */
  readonly prerequisites: ReadonlyArray<string>;
  /** Difficulty level (1-5) */
  readonly difficulty: number;
}

/**
 * Math topic categories
 */
export enum MathTopic {
  Algebra = 'Algebra',
  Calculus = 'Calculus',
  LinearAlgebra = 'Linear Algebra',
  AbstractAlgebra = 'Abstract Algebra',
  NumberTheory = 'Number Theory',
  Topology = 'Topology',
  Analysis = 'Analysis',
  DifferentialEquations = 'Differential Equations',
  Probability = 'Probability',
  Statistics = 'Statistics',
  DiscreteMath = 'Discrete Math',
  Geometry = 'Geometry',
  SetTheory = 'Set Theory',
  Logic = 'Logic',
}

// ============================================================================
// DEFINITIONS DATABASE
// ============================================================================

/**
 * Core mathematical definitions
 */
export const DEFINITIONS: ReadonlyArray<Definition> = [
  // Algebra
  {
    id: 'polynomial',
    term: 'Polynomial',
    topic: MathTopic.Algebra,
    formal:
      'A polynomial is an expression consisting of variables and coefficients, involving only the operations of addition, subtraction, multiplication, and non-negative integer exponentiation of variables.',
    intuitive:
      'A polynomial is like a mathematical recipe where you can add, subtract, and multiply variables (usually x) raised to whole number powers. For example, x² + 3x - 5 is a polynomial.',
    notation: 'P(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + ... + a₁x + a₀',
    latex: 'P(x) = a_n x^n + a_{n-1} x^{n-1} + \\ldots + a_1 x + a_0',
    examples: ['x² + 2x + 1', '3x³ - 5x + 7', '2'],
    related: ['degree', 'coefficient', 'root', 'factorization'],
    prerequisites: ['variable', 'exponent'],
    difficulty: 2,
  },
  {
    id: 'function',
    term: 'Function',
    topic: MathTopic.Algebra,
    formal:
      'A function f from set A to set B is a relation that assigns to each element x in A exactly one element f(x) in B.',
    intuitive:
      'A function is like a machine: you put something in (input), and it gives you exactly one thing out (output). For example, f(x) = x² takes any number and returns its square.',
    notation: 'f: A → B, or y = f(x)',
    latex: 'f: A \\to B',
    examples: ['f(x) = x²', 'f(x) = 2x + 3', 'f(x) = sin(x)'],
    related: ['domain', 'range', 'composition', 'inverse'],
    prerequisites: ['set'],
    difficulty: 2,
  },

  // Calculus
  {
    id: 'derivative',
    term: 'Derivative',
    topic: MathTopic.Calculus,
    formal:
      "The derivative of a function f at point x is the limit: f'(x) = lim(h→0) [f(x+h) - f(x)]/h, provided this limit exists.",
    intuitive:
      "The derivative tells you how fast something is changing at a specific point. For example, if f(x) represents your position at time x, then f'(x) is your velocity.",
    notation: "f'(x), dy/dx, df/dx",
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    examples: ['d/dx(x²) = 2x', 'd/dx(sin x) = cos x', 'd/dx(eˣ) = eˣ'],
    related: ['limit', 'tangent line', 'rate of change', 'integral'],
    prerequisites: ['function', 'limit'],
    difficulty: 3,
  },
  {
    id: 'integral',
    term: 'Integral',
    topic: MathTopic.Calculus,
    formal:
      'The definite integral of f from a to b is the limit of Riemann sums: ∫ₐᵇ f(x)dx = lim(n→∞) Σᵢ₌₁ⁿ f(xᵢ)Δx.',
    intuitive:
      'The integral measures the total accumulation of a quantity. Geometrically, it represents the area under a curve. If f(x) is velocity, then ∫f(x)dx is total distance traveled.',
    notation: '∫f(x)dx, ∫ₐᵇ f(x)dx',
    latex: '\\int f(x)\\,dx, \\quad \\int_a^b f(x)\\,dx',
    examples: ['∫x dx = x²/2 + C', '∫₀¹ x² dx = 1/3', '∫eˣ dx = eˣ + C'],
    related: ['antiderivative', 'fundamental theorem', 'area', 'Riemann sum'],
    prerequisites: ['function', 'limit', 'derivative'],
    difficulty: 3,
  },
  {
    id: 'limit',
    term: 'Limit',
    topic: MathTopic.Calculus,
    formal:
      'We say lim(x→a) f(x) = L if for every ε > 0, there exists δ > 0 such that |f(x) - L| < ε whenever 0 < |x - a| < δ.',
    intuitive:
      'A limit describes what value a function approaches as the input gets arbitrarily close to some point. It\'s like asking "where is the function heading?"',
    notation: 'lim(x→a) f(x) = L',
    latex: '\\lim_{x \\to a} f(x) = L',
    examples: ['lim(x→0) sin(x)/x = 1', 'lim(x→∞) 1/x = 0', 'lim(x→2) x² = 4'],
    related: ['continuity', 'derivative', 'epsilon-delta'],
    prerequisites: ['function'],
    difficulty: 3,
  },

  // Linear Algebra
  {
    id: 'vector-space',
    term: 'Vector Space',
    topic: MathTopic.LinearAlgebra,
    formal:
      'A vector space over a field F is a set V with operations of addition and scalar multiplication satisfying: closure, associativity, commutativity, identity, inverse, and distributivity axioms.',
    intuitive:
      'A vector space is a collection of objects (vectors) that you can add together and multiply by numbers, following familiar arithmetic rules. Examples include 2D/3D space, polynomials, and functions.',
    notation: 'V over F',
    examples: [
      'ℝⁿ (n-dimensional real space)',
      'polynomials of degree ≤ n',
      'continuous functions',
    ],
    related: ['basis', 'dimension', 'linear transformation', 'subspace'],
    prerequisites: ['set', 'field'],
    difficulty: 4,
  },
  {
    id: 'matrix',
    term: 'Matrix',
    topic: MathTopic.LinearAlgebra,
    formal:
      'A matrix is a rectangular array of numbers, symbols, or expressions, arranged in rows and columns.',
    intuitive:
      'A matrix is like a spreadsheet of numbers that can represent data, transformations, or systems of equations. Each position in the grid has a specific meaning.',
    notation: 'A = [aᵢⱼ], where i is row and j is column',
    latex: 'A = \\begin{bmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{bmatrix}',
    examples: ['[1 2; 3 4]', 'identity matrix I', 'zero matrix'],
    related: ['determinant', 'inverse', 'eigenvalue', 'linear transformation'],
    prerequisites: [],
    difficulty: 2,
  },

  // Abstract Algebra
  {
    id: 'group',
    term: 'Group',
    topic: MathTopic.AbstractAlgebra,
    formal:
      'A group (G, ∘) is a set G with a binary operation ∘ satisfying: closure, associativity, identity element existence, and inverse element existence.',
    intuitive:
      'A group is a set with a way to combine elements that follows four key rules: combining any two elements gives another element in the set, parentheses don\'t matter, there\'s a "do nothing" element, and every element has an "undo" element.',
    notation: '(G, ∘)',
    examples: [
      '(ℤ, +) - integers under addition',
      '(ℝ*, ×) - non-zero reals under multiplication',
      'symmetry groups',
    ],
    related: ['subgroup', 'homomorphism', 'coset', 'quotient group'],
    prerequisites: ['set', 'binary operation'],
    difficulty: 4,
  },
  {
    id: 'ring',
    term: 'Ring',
    topic: MathTopic.AbstractAlgebra,
    formal:
      'A ring (R, +, ×) is a set R with two binary operations (addition and multiplication) where (R, +) is an abelian group, multiplication is associative with identity, and multiplication distributes over addition.',
    intuitive:
      'A ring is like a number system where you can add, subtract, and multiply (but not necessarily divide). Examples include integers, polynomials, and matrices.',
    notation: '(R, +, ×)',
    examples: [
      'ℤ - integers',
      'ℤ[x] - polynomials with integer coefficients',
      'M₂(ℝ) - 2×2 real matrices',
    ],
    related: ['field', 'ideal', 'homomorphism', 'integral domain'],
    prerequisites: ['group'],
    difficulty: 4,
  },

  // Number Theory
  {
    id: 'prime-number',
    term: 'Prime Number',
    topic: MathTopic.NumberTheory,
    formal:
      'A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself.',
    intuitive:
      'A prime number is a number that can only be divided evenly by 1 and itself. They\'re like the "atoms" of numbers - building blocks for all other numbers.',
    notation: 'p ∈ ℙ',
    examples: ['2, 3, 5, 7, 11, 13, 17, 19, 23, 29'],
    related: ['composite number', 'fundamental theorem of arithmetic', 'primality testing'],
    prerequisites: ['natural number', 'divisibility'],
    difficulty: 1,
  },
  {
    id: 'modular-arithmetic',
    term: 'Modular Arithmetic',
    topic: MathTopic.NumberTheory,
    formal: 'For integers a, b and positive integer n, we say a ≡ b (mod n) if n divides (a - b).',
    intuitive:
      'Modular arithmetic is like clock arithmetic - after reaching a certain number, you wrap around. For example, 15 ≡ 3 (mod 12) because 15 and 3 differ by 12.',
    notation: 'a ≡ b (mod n)',
    latex: 'a \\equiv b \\pmod{n}',
    examples: ['13 ≡ 1 (mod 12)', '27 ≡ 2 (mod 5)', '100 ≡ 0 (mod 10)'],
    related: ['congruence', 'residue class', 'Chinese remainder theorem'],
    prerequisites: ['integer', 'divisibility'],
    difficulty: 2,
  },

  // Topology
  {
    id: 'topological-space',
    term: 'Topological Space',
    topic: MathTopic.Topology,
    formal:
      'A topological space is a pair (X, τ) where X is a set and τ is a collection of subsets of X (called open sets) satisfying: ∅ and X are in τ, arbitrary unions of sets in τ are in τ, and finite intersections of sets in τ are in τ.',
    intuitive:
      'A topological space is a set with a notion of "nearness" or "continuity" without necessarily having distances. It\'s the foundation for studying continuous functions and geometric properties.',
    notation: '(X, τ)',
    examples: ['ℝⁿ with standard topology', 'discrete topology', 'trivial topology'],
    related: ['open set', 'closed set', 'continuous function', 'homeomorphism'],
    prerequisites: ['set'],
    difficulty: 5,
  },

  // Analysis
  {
    id: 'continuous-function',
    term: 'Continuous Function',
    topic: MathTopic.Analysis,
    formal:
      'A function f: A → B is continuous at point c if for every ε > 0, there exists δ > 0 such that |f(x) - f(c)| < ε whenever |x - c| < δ.',
    intuitive:
      'A function is continuous if its graph has no breaks, jumps, or holes. You can draw it without lifting your pencil.',
    notation: 'f continuous at c',
    examples: [
      'f(x) = x² is continuous everywhere',
      'f(x) = |x| is continuous everywhere',
      'f(x) = 1/x is continuous except at 0',
    ],
    related: ['limit', 'uniform continuity', 'intermediate value theorem'],
    prerequisites: ['function', 'limit'],
    difficulty: 3,
  },

  // Differential Equations
  {
    id: 'ordinary-differential-equation',
    term: 'Ordinary Differential Equation',
    topic: MathTopic.DifferentialEquations,
    formal:
      'An ordinary differential equation (ODE) is an equation containing a function of one independent variable and its derivatives.',
    intuitive:
      'An ODE is an equation that relates a function to its rates of change. For example, if you know how fast something is accelerating, you can find its position over time.',
    notation: "F(x, y, y', y'', ..., y⁽ⁿ⁾) = 0",
    latex: "F(x, y, y', y'', \\ldots, y^{(n)}) = 0",
    examples: ["y' = y (exponential growth)", "y'' + y = 0 (harmonic oscillator)", "y' = x² - y"],
    related: ['initial value problem', 'boundary value problem', 'solution method'],
    prerequisites: ['derivative', 'function'],
    difficulty: 3,
  },

  // More Calculus
  {
    id: 'partial-derivative',
    term: 'Partial Derivative',
    topic: MathTopic.Calculus,
    formal:
      'The partial derivative ∂f/∂x of a multivariable function f with respect to x is the derivative of f treating all other variables as constants.',
    intuitive:
      'A partial derivative measures how a function changes when you vary just one variable, keeping all others fixed. Like checking how temperature changes with latitude while keeping longitude constant.',
    notation: '∂f/∂x, ∂f/∂y, fₓ, f_x',
    latex: '\\frac{\\partial f}{\\partial x}',
    examples: ['∂/∂x(x²y) = 2xy', '∂/∂y(x²y) = x²', '∂/∂x(sin(xy)) = y cos(xy)'],
    related: ['gradient', 'directional derivative', 'chain rule'],
    prerequisites: ['derivative', 'multivariable function'],
    difficulty: 3,
  },
  {
    id: 'gradient',
    term: 'Gradient',
    topic: MathTopic.Calculus,
    formal:
      'The gradient of a scalar function f is the vector of its partial derivatives: ∇f = (∂f/∂x₁, ∂f/∂x₂, ..., ∂f/∂xₙ).',
    intuitive:
      'The gradient points in the direction of steepest increase of a function. Imagine standing on a hillside - the gradient vector points uphill.',
    notation: '∇f, grad f',
    latex:
      '\\nabla f = \\left(\\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z}\\right)',
    examples: ['∇(x²+y²) = (2x, 2y)', '∇(xyz) = (yz, xz, xy)'],
    related: ['partial derivative', 'directional derivative', 'divergence', 'curl'],
    prerequisites: ['partial derivative', 'vector'],
    difficulty: 3,
  },
  {
    id: 'taylor-series',
    term: 'Taylor Series',
    topic: MathTopic.Calculus,
    formal:
      'The Taylor series of a function f around point a is: f(x) = Σₙ₌₀^∞ [f⁽ⁿ⁾(a)/n!](x-a)ⁿ, where f⁽ⁿ⁾ is the nth derivative.',
    intuitive:
      "A Taylor series approximates any smooth function using polynomials. It's like describing a curved road using straight segments - more terms give better approximation.",
    notation: "f(x) = f(a) + f'(a)(x-a) + f''(a)(x-a)²/2! + ...",
    latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n',
    examples: [
      'eˣ = 1 + x + x²/2! + x³/3! + ...',
      'sin(x) = x - x³/3! + x⁵/5! - ...',
      'cos(x) = 1 - x²/2! + x⁴/4! - ...',
    ],
    related: ['Maclaurin series', 'power series', 'radius of convergence'],
    prerequisites: ['derivative', 'series', 'factorial'],
    difficulty: 4,
  },
  {
    id: 'chain-rule',
    term: 'Chain Rule',
    topic: MathTopic.Calculus,
    formal:
      "If y = f(u) and u = g(x), then dy/dx = (dy/du)(du/dx), or equivalently (f∘g)'(x) = f'(g(x))·g'(x).",
    intuitive:
      'The chain rule finds the derivative of composed functions. If distance depends on time and time depends on temperature, the chain rule tells how distance changes with temperature.',
    notation: "d/dx[f(g(x))] = f'(g(x))·g'(x)",
    latex: "\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)",
    examples: [
      'd/dx[sin(x²)] = cos(x²)·2x',
      'd/dx[(3x+1)⁵] = 5(3x+1)⁴·3',
      'd/dx[e^(x²)] = e^(x²)·2x',
    ],
    related: ['product rule', 'quotient rule', 'composite function'],
    prerequisites: ['derivative', 'function composition'],
    difficulty: 3,
  },
  {
    id: 'implicit-differentiation',
    term: 'Implicit Differentiation',
    topic: MathTopic.Calculus,
    formal:
      'Implicit differentiation finds dy/dx for equations where y is defined implicitly as a function of x, not explicitly solved for y.',
    intuitive:
      'Sometimes equations like x² + y² = 25 define y in terms of x without explicitly solving for y. Implicit differentiation finds dy/dx directly from the equation.',
    examples: [
      'x² + y² = 25 → 2x + 2y(dy/dx) = 0 → dy/dx = -x/y',
      'x³ + y³ = 6xy → dy/dx = (2y - x²)/(y² - 2x)',
    ],
    related: ['derivative', 'chain rule', 'related rates'],
    prerequisites: ['derivative', 'chain rule'],
    difficulty: 3,
  },

  // More Linear Algebra
  {
    id: 'eigenvalue',
    term: 'Eigenvalue',
    topic: MathTopic.LinearAlgebra,
    formal:
      'An eigenvalue λ of a matrix A is a scalar such that Av = λv for some non-zero vector v (the eigenvector).',
    intuitive:
      "An eigenvalue tells you how much a matrix stretches space in a particular direction (given by the eigenvector). It's like finding directions where a transformation only scales, not rotates.",
    notation: 'Av = λv',
    latex: 'Av = \\lambda v',
    examples: [
      'A = [[2,0],[0,3]] has eigenvalues λ=2,3',
      'A = [[0,-1],[1,0]] has eigenvalues λ=±i',
    ],
    related: ['eigenvector', 'characteristic polynomial', 'diagonalization', 'spectral theorem'],
    prerequisites: ['matrix', 'vector', 'linear transformation'],
    difficulty: 4,
  },
  {
    id: 'determinant',
    term: 'Determinant',
    topic: MathTopic.LinearAlgebra,
    formal:
      'The determinant is a scalar value computed from a square matrix that encodes information about the linear transformation it represents.',
    intuitive:
      'The determinant tells you how much a matrix scales area/volume. det(A)=0 means the matrix squashes space to a lower dimension (not invertible).',
    notation: 'det(A), |A|',
    latex: '\\det(A) = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc',
    examples: [
      'det([[2,0],[0,3]]) = 6',
      'det([[1,2],[2,4]]) = 0',
      'det([[cos θ, -sin θ],[sin θ, cos θ]]) = 1',
    ],
    related: ['matrix', 'inverse', 'eigenvalue', 'volume'],
    prerequisites: ['matrix'],
    difficulty: 3,
  },
  {
    id: 'basis',
    term: 'Basis',
    topic: MathTopic.LinearAlgebra,
    formal: 'A basis of a vector space V is a linearly independent set of vectors that spans V.',
    intuitive:
      'A basis is a minimal set of vectors needed to build any vector in the space. Like coordinate axes - every point can be uniquely described using the basis vectors.',
    examples: [
      'Standard basis of ℝ³: {(1,0,0), (0,1,0), (0,0,1)}',
      'Basis of ℝ²: {(1,1), (1,-1)}',
      'Basis of polynomials degree ≤2: {1, x, x²}',
    ],
    related: ['dimension', 'span', 'linear independence', 'coordinate system'],
    prerequisites: ['vector space', 'linear independence', 'span'],
    difficulty: 4,
  },
  {
    id: 'orthogonality',
    term: 'Orthogonality',
    topic: MathTopic.LinearAlgebra,
    formal: 'Two vectors u and v are orthogonal if their dot product is zero: u·v = 0.',
    intuitive:
      'Orthogonal vectors are perpendicular to each other. Like the x and y axes in a coordinate system - completely independent directions.',
    notation: 'u ⊥ v',
    latex: 'u \\perp v \\iff u \\cdot v = 0',
    examples: ['(1,0) ⊥ (0,1)', '(1,1,0) ⊥ (1,-1,0)', '(2,3) ⊥ (-3,2)'],
    related: ['dot product', 'inner product', 'orthonormal basis', 'projection'],
    prerequisites: ['vector', 'dot product'],
    difficulty: 2,
  },

  // More Algebra
  {
    id: 'quadratic-formula',
    term: 'Quadratic Formula',
    topic: MathTopic.Algebra,
    formal: 'For quadratic equation ax² + bx + c = 0, the solutions are x = [-b ± √(b²-4ac)]/(2a).',
    intuitive:
      'The quadratic formula solves any quadratic equation. The discriminant (b²-4ac) tells you how many real solutions exist.',
    notation: 'x = (-b ± √(b²-4ac))/(2a)',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
    examples: ['x²-5x+6=0 → x=(5±√(25-24))/2 → x=2,3', 'x²+2x+5=0 → no real solutions (b²-4ac<0)'],
    related: ['discriminant', 'roots', 'completing the square', 'parabola'],
    prerequisites: ['polynomial', 'square root'],
    difficulty: 2,
  },
  {
    id: 'logarithm',
    term: 'Logarithm',
    topic: MathTopic.Algebra,
    formal:
      'The logarithm logₐ(x) is the exponent to which base a must be raised to get x: if y = logₐ(x), then aʸ = x.',
    intuitive:
      'A logarithm answers "what power do I raise this base to, to get this number?" It\'s the inverse of exponentiation.',
    notation: 'log(x), ln(x), logₐ(x)',
    latex: '\\log_a(x) = y \\iff a^y = x',
    examples: ['log₁₀(100) = 2', 'ln(e³) = 3', 'log₂(8) = 3'],
    related: ['exponent', 'natural log', 'logarithmic scale', 'exponential function'],
    prerequisites: ['exponentiation'],
    difficulty: 2,
  },
  {
    id: 'binomial-theorem',
    term: 'Binomial Theorem',
    topic: MathTopic.Algebra,
    formal:
      'For any non-negative integer n: (x+y)ⁿ = Σₖ₌₀ⁿ C(n,k)xⁿ⁻ᵏyᵏ, where C(n,k) = n!/(k!(n-k)!).',
    intuitive:
      'The binomial theorem expands powers of sums. It tells you all the terms when you multiply out (x+y)ⁿ without doing all the multiplication.',
    notation: '(x+y)ⁿ = Σ C(n,k)xⁿ⁻ᵏyᵏ',
    latex: '(x+y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k',
    examples: ['(x+y)² = x² + 2xy + y²', '(x+y)³ = x³ + 3x²y + 3xy² + y³'],
    related: ['binomial coefficient', "Pascal's triangle", 'combinatorics'],
    prerequisites: ['factorial', 'summation'],
    difficulty: 3,
  },

  // More Number Theory
  {
    id: 'gcd',
    term: 'Greatest Common Divisor',
    topic: MathTopic.NumberTheory,
    formal:
      'The greatest common divisor gcd(a,b) of integers a and b is the largest positive integer that divides both a and b.',
    intuitive:
      'The GCD is the biggest number that divides evenly into both numbers. Like finding the largest block size that can measure two different lengths.',
    notation: 'gcd(a,b), (a,b)',
    examples: ['gcd(12,18) = 6', 'gcd(7,11) = 1 (coprime)', 'gcd(24,36) = 12'],
    related: ['lcm', 'Euclidean algorithm', 'coprime', "Bezout's identity"],
    prerequisites: ['divisibility', 'integer'],
    difficulty: 2,
  },
  {
    id: 'fermats-little-theorem',
    term: "Fermat's Little Theorem",
    topic: MathTopic.NumberTheory,
    formal: 'If p is prime and a is not divisible by p, then a^(p-1) ≡ 1 (mod p).',
    intuitive:
      "Fermat's Little Theorem says that if you raise a number to (prime-1) power and divide by that prime, the remainder is always 1. It's fundamental in cryptography.",
    notation: 'aᵖ⁻¹ ≡ 1 (mod p)',
    latex: 'a^{p-1} \\equiv 1 \\pmod{p}',
    examples: ['2⁶ ≡ 1 (mod 7)', '3⁴ ≡ 1 (mod 5)', '5¹⁰ ≡ 1 (mod 11)'],
    related: ['modular arithmetic', 'prime number', "Euler's theorem", 'RSA encryption'],
    prerequisites: ['modular arithmetic', 'prime number'],
    difficulty: 4,
  },
  {
    id: 'chinese-remainder-theorem',
    term: 'Chinese Remainder Theorem',
    topic: MathTopic.NumberTheory,
    formal:
      'If n₁, n₂, ..., nₖ are pairwise coprime, then the system x ≡ a₁ (mod n₁), ..., x ≡ aₖ (mod nₖ) has a unique solution modulo N = n₁n₂...nₖ.',
    intuitive:
      'The CRT says you can solve multiple modular equations simultaneously. Like figuring out a secret number by knowing its remainders when divided by different numbers.',
    notation: 'x ≡ aᵢ (mod nᵢ) for i=1,...,k',
    latex: 'x \\equiv a_i \\pmod{n_i}',
    examples: ['x ≡ 2 (mod 3) and x ≡ 3 (mod 5) → x ≡ 8 (mod 15)'],
    related: ['modular arithmetic', 'coprime', 'system of equations'],
    prerequisites: ['modular arithmetic', 'gcd'],
    difficulty: 4,
  },

  // Probability & Statistics
  {
    id: 'probability',
    term: 'Probability',
    topic: MathTopic.Probability,
    formal:
      'Probability P(E) of an event E is a number in [0,1] satisfying: P(∅)=0, P(Ω)=1, and P(⋃Eᵢ) = ΣP(Eᵢ) for disjoint events.',
    intuitive:
      "Probability measures how likely an event is to occur, from 0 (impossible) to 1 (certain). Like saying there's a 50% chance of heads when flipping a coin.",
    notation: 'P(E), Pr(E)',
    latex: '0 \\leq P(E) \\leq 1',
    examples: [
      'P(heads) = 1/2',
      'P(rolling 6) = 1/6',
      'P(rain or sun) = P(rain) + P(sun) if mutually exclusive',
    ],
    related: ['sample space', 'event', 'conditional probability', 'independence'],
    prerequisites: ['set theory'],
    difficulty: 2,
  },
  {
    id: 'expected-value',
    term: 'Expected Value',
    topic: MathTopic.Probability,
    formal:
      'The expected value E[X] of a random variable X is the weighted average of all possible values, weighted by their probabilities.',
    intuitive:
      "Expected value is the long-run average if you repeat an experiment many times. Like the average dice roll is 3.5 even though you can't roll 3.5.",
    notation: 'E[X], μ, ⟨X⟩',
    latex: 'E[X] = \\sum_x x \\cdot P(X=x)',
    examples: ['E[fair die] = (1+2+3+4+5+6)/6 = 3.5', 'E[coin flip: heads=1, tails=0] = 0.5'],
    related: ['variance', 'mean', 'random variable', 'linearity of expectation'],
    prerequisites: ['probability', 'weighted average'],
    difficulty: 3,
  },
  {
    id: 'variance',
    term: 'Variance',
    topic: MathTopic.Statistics,
    formal: 'The variance Var(X) of a random variable X is E[(X - μ)²], where μ = E[X].',
    intuitive:
      "Variance measures how spread out values are from the mean. High variance means values are far from average; low variance means they're clustered near average.",
    notation: 'Var(X), σ², s²',
    latex: '\\text{Var}(X) = E[(X-\\mu)^2] = E[X^2] - (E[X])^2',
    examples: ['Var([1,2,3,4,5]) = 2', 'Var([constant]) = 0'],
    related: ['standard deviation', 'expected value', 'covariance'],
    prerequisites: ['expected value', 'mean'],
    difficulty: 3,
  },
  {
    id: 'normal-distribution',
    term: 'Normal Distribution',
    topic: MathTopic.Probability,
    formal:
      'The normal distribution N(μ,σ²) has probability density f(x) = (1/√(2πσ²))exp(-(x-μ)²/(2σ²)).',
    intuitive:
      'The normal distribution (bell curve) describes many natural phenomena. Heights, test scores, and measurement errors often follow this pattern - most values cluster near the mean, fewer at extremes.',
    notation: 'X ~ N(μ,σ²)',
    latex: 'f(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',
    examples: [
      'Standard normal: N(0,1)',
      'IQ scores: N(100,15²)',
      'Heights: approximately N(170cm, σ²)',
    ],
    related: ['central limit theorem', 'standard deviation', 'z-score', 'Gaussian'],
    prerequisites: ['probability distribution', 'mean', 'variance'],
    difficulty: 3,
  },
  {
    id: 'bayes-theorem',
    term: "Bayes' Theorem",
    topic: MathTopic.Probability,
    formal: "Bayes' theorem states: P(A|B) = P(B|A)P(A)/P(B), relating conditional probabilities.",
    intuitive:
      "Bayes' theorem updates probabilities based on new evidence. Like revising your belief about having a disease after getting a positive test result.",
    notation: 'P(A|B) = P(B|A)P(A)/P(B)',
    latex: 'P(A|B) = \\frac{P(B|A)P(A)}{P(B)}',
    examples: ['Medical diagnosis', 'Spam filtering', 'Weather prediction'],
    related: ['conditional probability', 'posterior probability', 'prior probability'],
    prerequisites: ['probability', 'conditional probability'],
    difficulty: 3,
  },

  // Set Theory & Logic
  {
    id: 'set',
    term: 'Set',
    topic: MathTopic.SetTheory,
    formal: 'A set is an unordered collection of distinct objects, called elements or members.',
    intuitive:
      "A set is like a bag of objects where order doesn't matter and duplicates are ignored. {1,2,3} is the same as {3,2,1}.",
    notation: '{a, b, c}, A, B, S',
    examples: ['{1, 2, 3}', 'ℕ = {0, 1, 2, 3, ...}', '∅ (empty set)', '{x | x > 0} (set builder)'],
    related: ['element', 'subset', 'union', 'intersection', 'cardinality'],
    prerequisites: [],
    difficulty: 1,
  },
  {
    id: 'cardinality',
    term: 'Cardinality',
    topic: MathTopic.SetTheory,
    formal: 'The cardinality |A| of a set A is the number of elements in A.',
    intuitive:
      'Cardinality is just the size of a set - how many elements it contains. Some infinite sets have different "sizes" of infinity!',
    notation: '|A|, #A, card(A)',
    examples: [
      '|{1,2,3}| = 3',
      '|ℕ| = ℵ₀ (countably infinite)',
      '|ℝ| = 2^ℵ₀ (uncountably infinite)',
    ],
    related: ['countable', 'uncountable', 'bijection', "Cantor's theorem"],
    prerequisites: ['set'],
    difficulty: 2,
  },
  {
    id: 'implication',
    term: 'Logical Implication',
    topic: MathTopic.Logic,
    formal:
      'The implication P → Q is false only when P is true and Q is false. It is logically equivalent to ¬P ∨ Q.',
    intuitive:
      'Implication says "if P then Q". It\'s only violated when the hypothesis (P) is true but the conclusion (Q) is false.',
    notation: 'P → Q, P ⇒ Q',
    latex: 'P \\rightarrow Q \\equiv \\neg P \\vee Q',
    examples: ['"If it rains, the ground is wet"', '"x>0 → x²>0"', 'Contrapositive: ¬Q → ¬P'],
    related: ['contrapositive', 'converse', 'biconditional', 'logical equivalence'],
    prerequisites: ['proposition'],
    difficulty: 2,
  },
  {
    id: 'quantifiers',
    term: 'Logical Quantifiers',
    topic: MathTopic.Logic,
    formal:
      'Universal quantifier ∀ means "for all"; existential quantifier ∃ means "there exists".',
    intuitive:
      '∀ claims something is true for everything in a domain. ∃ claims at least one example exists. Like "all birds have wings" vs "there exists a red bird".',
    notation: '∀x, ∃x, ∀x∈S, ∃!x (unique existence)',
    latex: '\\forall x \\in S, \\exists x \\in S',
    examples: ['∀x∈ℝ: x² ≥ 0', '∃x∈ℚ: x² = 2 (false)', '∀ε>0 ∃δ>0 ... (epsilon-delta)'],
    related: ['predicate logic', 'domain', 'negation of quantifiers'],
    prerequisites: ['proposition', 'set'],
    difficulty: 3,
  },

  // Geometry
  {
    id: 'pythagorean-theorem',
    term: 'Pythagorean Theorem',
    topic: MathTopic.Geometry,
    formal: 'In a right triangle with legs a and b and hypotenuse c: a² + b² = c².',
    intuitive:
      'In a right triangle, the square of the longest side equals the sum of squares of the other two sides. Fundamental for measuring distances.',
    notation: 'a² + b² = c²',
    latex: 'a^2 + b^2 = c^2',
    examples: ['3² + 4² = 5²', '5² + 12² = 13²', 'Distance formula comes from this'],
    related: ['right triangle', 'distance formula', 'law of cosines', 'Euclidean geometry'],
    prerequisites: ['triangle', 'right angle'],
    difficulty: 1,
  },
  {
    id: 'circle',
    term: 'Circle',
    topic: MathTopic.Geometry,
    formal: 'A circle is the set of all points in a plane equidistant from a fixed center point.',
    intuitive:
      'A circle is all points at the same distance (radius) from a center. Like the edge of a wheel or the path you walk around a tree at constant distance.',
    notation: '(x-h)² + (y-k)² = r²',
    latex: '(x-h)^2 + (y-k)^2 = r^2',
    examples: [
      'x² + y² = 1 (unit circle)',
      '(x-3)² + (y+2)² = 25',
      'Area = πr², Circumference = 2πr',
    ],
    related: ['radius', 'diameter', 'circumference', 'arc', 'chord', 'tangent'],
    prerequisites: ['distance', 'plane'],
    difficulty: 1,
  },

  // Discrete Math
  {
    id: 'combinatorics',
    term: 'Combinatorics',
    topic: MathTopic.DiscreteMath,
    formal:
      'Combinatorics is the study of counting, arrangement, and combination of objects in discrete structures.',
    intuitive:
      'Combinatorics answers questions like "how many ways can we arrange these objects?" or "how many possible outcomes exist?"',
    examples: [
      'Permutations: n!/(n-k)!',
      'Combinations: C(n,k) = n!/(k!(n-k)!)',
      'Counting subsets: 2ⁿ',
    ],
    related: ['permutation', 'combination', 'binomial coefficient', 'counting principle'],
    prerequisites: ['set', 'factorial'],
    difficulty: 2,
  },
  {
    id: 'graph-theory',
    term: 'Graph (Graph Theory)',
    topic: MathTopic.DiscreteMath,
    formal:
      'A graph G = (V,E) consists of a set V of vertices and a set E of edges connecting pairs of vertices.',
    intuitive:
      'A graph represents connections between objects. Like a social network where people are vertices and friendships are edges.',
    notation: 'G = (V,E)',
    examples: ['Social networks', 'Road maps', 'Computer networks', 'Family trees'],
    related: ['vertex', 'edge', 'path', 'cycle', 'connected graph', 'tree'],
    prerequisites: ['set'],
    difficulty: 2,
  },
  {
    id: 'recursion',
    term: 'Recursion',
    topic: MathTopic.DiscreteMath,
    formal:
      'Recursion defines a sequence or function in terms of previous values with a base case.',
    intuitive:
      'Recursion solves a problem by breaking it into smaller versions of itself. Like calculating factorial: n! = n × (n-1)!',
    notation: 'f(n) = g(f(n-1), f(n-2), ...) with f(0) = base case',
    examples: [
      'Fibonacci: F(n) = F(n-1) + F(n-2), F(0)=0, F(1)=1',
      'Factorial: n! = n × (n-1)!',
      'Tower of Hanoi',
    ],
    related: ['induction', 'recurrence relation', 'dynamic programming', 'divide and conquer'],
    prerequisites: ['sequence', 'function'],
    difficulty: 3,
  },

  // More Advanced Topics
  {
    id: 'manifold',
    term: 'Manifold',
    topic: MathTopic.Topology,
    formal:
      'A manifold is a topological space that locally resembles Euclidean space near each point.',
    intuitive:
      "A manifold is a shape that looks flat when you zoom in close enough. Earth's surface is a 2D manifold - locally flat but globally curved.",
    examples: ['Circle (1D manifold)', 'Sphere (2D manifold)', 'Torus (2D manifold)', 'ℝⁿ'],
    related: ['topology', 'differential geometry', 'tangent space', 'chart'],
    prerequisites: ['topological space', 'Euclidean space'],
    difficulty: 5,
  },
  {
    id: 'hilbert-space',
    term: 'Hilbert Space',
    topic: MathTopic.Analysis,
    formal: 'A Hilbert space is a complete inner product space.',
    intuitive:
      'A Hilbert space is an infinite-dimensional generalization of Euclidean space with notions of length and angle. Foundation of quantum mechanics.',
    notation: 'H, L²',
    examples: [
      'ℝⁿ with dot product',
      'L²[0,1] (square-integrable functions)',
      'ℓ² (square-summable sequences)',
    ],
    related: ['inner product space', 'Banach space', 'orthonormal basis', 'quantum mechanics'],
    prerequisites: ['vector space', 'inner product', 'completeness'],
    difficulty: 5,
  },
  {
    id: 'fourier-transform',
    term: 'Fourier Transform',
    topic: MathTopic.Analysis,
    formal: 'The Fourier transform F(ω) of a function f(t) is F(ω) = ∫_{-∞}^{∞} f(t)e^{-iωt}dt.',
    intuitive:
      'The Fourier transform decomposes a signal into its frequency components. Like finding all the musical notes that make up a sound.',
    notation: 'F(ω), ℱ[f](ω), f̂(ω)',
    latex: 'F(\\omega) = \\int_{-\\infty}^{\\infty} f(t)e^{-i\\omega t}dt',
    examples: [
      'Audio signal analysis',
      'Image compression (JPEG)',
      'Solving differential equations',
    ],
    related: ['Fourier series', 'frequency domain', 'convolution', 'inverse transform'],
    prerequisites: ['complex numbers', 'integration', 'exponential function'],
    difficulty: 4,
  },
];

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get definition by ID
 */
export function getDefinition(id: string): Definition | undefined {
  return DEFINITIONS.find((def) => def.id === id);
}

/**
 * Search definitions by term
 */
export function searchDefinitions(query: string): ReadonlyArray<Definition> {
  const lowerQuery = query.toLowerCase();
  return DEFINITIONS.filter(
    (def) =>
      def.term.toLowerCase().includes(lowerQuery) ||
      def.intuitive.toLowerCase().includes(lowerQuery) ||
      def.formal.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Get definitions by topic
 */
export function getDefinitionsByTopic(topic: MathTopic): ReadonlyArray<Definition> {
  return DEFINITIONS.filter((def) => def.topic === topic);
}

/**
 * Get definitions by difficulty
 */
export function getDefinitionsByDifficulty(
  minDifficulty: number,
  maxDifficulty: number,
): ReadonlyArray<Definition> {
  return DEFINITIONS.filter(
    (def) => def.difficulty >= minDifficulty && def.difficulty <= maxDifficulty,
  );
}

/**
 * Get related definitions
 */
export function getRelatedDefinitions(id: string): ReadonlyArray<Definition> {
  const def = getDefinition(id);
  if (!def) return [];

  return DEFINITIONS.filter((d) => def.related.includes(d.id) || d.related.includes(id));
}

/**
 * Get all topics
 */
export function getAllTopics(): ReadonlyArray<MathTopic> {
  return Object.values(MathTopic);
}

/**
 * Get definition count by topic
 */
export function getDefinitionCountByTopic(): Map<MathTopic, number> {
  const counts = new Map<MathTopic, number>();

  for (const topic of Object.values(MathTopic)) {
    counts.set(topic, getDefinitionsByTopic(topic).length);
  }

  return counts;
}
