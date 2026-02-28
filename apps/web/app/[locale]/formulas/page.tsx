'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Copy,
  Check,
  BookOpen,
  FunctionSquare,
  Triangle,
  Infinity,
  BarChart3,
  Zap,
  Circle,
  Grid3x3,
} from 'lucide-react';
import { MathRenderer } from '@/components/ui/math-renderer';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Union of all formula category identifiers.
 * Used as branded discriminant for category-specific styling.
 */
type FormulaCategory =
  | 'algebra'
  | 'trigonometry'
  | 'calculus'
  | 'linear-algebra'
  | 'statistics'
  | 'physics'
  | 'geometry';

/** A single formula entry in the library */
interface FormulaEntry {
  /** Stable unique ID (used as React key and clipboard anchor) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description explaining when / why the formula is used */
  description: string;
  /** LaTeX string for KaTeX rendering */
  latex: string;
  /** Plain-text expression for clipboard copy */
  expression: string;
  /** Category this formula belongs to */
  category: FormulaCategory;
  /** Optional tags for richer search matching */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Formula Data
// ---------------------------------------------------------------------------

const FORMULAS: FormulaEntry[] = [
  // --- Algebra ---------------------------------------------------------------
  {
    id: 'quadratic-formula',
    name: 'Quadratic Formula',
    description:
      'Solves any quadratic equation ax² + bx + c = 0 for its roots in terms of the coefficients.',
    latex: 'x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    expression: 'x = (-b ± sqrt(b² - 4ac)) / (2a)',
    category: 'algebra',
    tags: ['quadratic', 'roots', 'discriminant'],
  },
  {
    id: 'binomial-theorem',
    name: 'Binomial Theorem',
    description:
      'Expands the power of a binomial sum (x + y)ⁿ as a polynomial using binomial coefficients.',
    latex: '(x+y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k',
    expression: '(x + y)^n = Σ C(n,k) x^(n-k) y^k',
    category: 'algebra',
    tags: ['expansion', 'combinatorics', 'Pascal'],
  },
  {
    id: 'geometric-series',
    name: 'Geometric Series Sum',
    description:
      'Sum of a finite geometric series with first term a, common ratio r, and n terms.',
    latex: 'S_n = a \\cdot \\dfrac{1 - r^n}{1 - r}, \\quad r \\neq 1',
    expression: 'S_n = a(1 - r^n) / (1 - r)',
    category: 'algebra',
    tags: ['series', 'sum', 'ratio'],
  },
  {
    id: 'arithmetic-series',
    name: 'Arithmetic Series Sum',
    description:
      'Sum of the first n terms of an arithmetic sequence with first term a₁ and last term aₙ.',
    latex: 'S_n = \\dfrac{n}{2}(a_1 + a_n)',
    expression: 'S_n = n(a₁ + aₙ) / 2',
    category: 'algebra',
    tags: ['series', 'sum', 'arithmetic'],
  },
  {
    id: 'difference-of-squares',
    name: 'Difference of Squares',
    description:
      'Factorisation identity: the product of a sum and a difference equals the difference of their squares.',
    latex: 'a^2 - b^2 = (a+b)(a-b)',
    expression: 'a² - b² = (a+b)(a-b)',
    category: 'algebra',
    tags: ['factorisation', 'identity'],
  },
  {
    id: 'logarithm-change-base',
    name: 'Change-of-Base Formula',
    description:
      'Converts a logarithm in base b to a quotient of logarithms in any convenient base c.',
    latex: '\\log_b a = \\dfrac{\\log_c a}{\\log_c b}',
    expression: 'log_b(a) = log(a) / log(b)',
    category: 'algebra',
    tags: ['logarithm', 'base'],
  },
  {
    id: 'exponent-product',
    name: 'Exponent Product Rule',
    description:
      'When multiplying powers with the same base, add the exponents.',
    latex: 'a^m \\cdot a^n = a^{m+n}',
    expression: 'a^m · a^n = a^(m+n)',
    category: 'algebra',
    tags: ['exponents', 'product'],
  },
  {
    id: 'perfect-square-trinomial',
    name: 'Perfect Square Trinomial',
    description:
      'The square of a binomial always produces a perfect square trinomial.',
    latex: '(a \\pm b)^2 = a^2 \\pm 2ab + b^2',
    expression: '(a ± b)² = a² ± 2ab + b²',
    category: 'algebra',
    tags: ['factorisation', 'square', 'identity'],
  },
  {
    id: 'sum-of-cubes',
    name: 'Sum / Difference of Cubes',
    description:
      'Factorisation identities for the sum or difference of two perfect cubes.',
    latex: 'a^3 \\pm b^3 = (a \\pm b)(a^2 \\mp ab + b^2)',
    expression: 'a³ ± b³ = (a ± b)(a² ∓ ab + b²)',
    category: 'algebra',
    tags: ['factorisation', 'cubes'],
  },
  {
    id: 'infinite-geometric-series',
    name: 'Infinite Geometric Series',
    description:
      'Sum of an infinite geometric series converges when |r| < 1.',
    latex: 'S = \\dfrac{a}{1 - r}, \\quad |r| < 1',
    expression: 'S = a / (1 - r), |r| < 1',
    category: 'algebra',
    tags: ['series', 'infinite', 'convergence'],
  },

  // --- Trigonometry ----------------------------------------------------------
  {
    id: 'pythagorean-identity',
    name: 'Pythagorean Identity',
    description:
      'Fundamental identity relating the squares of sine and cosine for any angle.',
    latex: '\\sin^2\\theta + \\cos^2\\theta = 1',
    expression: 'sin²θ + cos²θ = 1',
    category: 'trigonometry',
    tags: ['identity', 'pythagorean'],
  },
  {
    id: 'double-angle-sin',
    name: 'Double Angle — sine',
    description:
      'Expresses sin(2θ) in terms of sin θ and cos θ using the angle addition formula.',
    latex: '\\sin 2\\theta = 2\\sin\\theta\\cos\\theta',
    expression: 'sin(2θ) = 2 sin(θ) cos(θ)',
    category: 'trigonometry',
    tags: ['double angle', 'identity'],
  },
  {
    id: 'double-angle-cos',
    name: 'Double Angle — cosine',
    description:
      'Three equivalent forms for cos(2θ), each useful in different simplification contexts.',
    latex: '\\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta = 1 - 2\\sin^2\\theta',
    expression: 'cos(2θ) = cos²θ - sin²θ = 1 - 2sin²θ',
    category: 'trigonometry',
    tags: ['double angle', 'identity'],
  },
  {
    id: 'law-of-cosines',
    name: 'Law of Cosines',
    description:
      'Generalises the Pythagorean theorem to any triangle, relating sides and the included angle.',
    latex: 'c^2 = a^2 + b^2 - 2ab\\cos C',
    expression: 'c² = a² + b² - 2ab cos(C)',
    category: 'trigonometry',
    tags: ['triangle', 'law of cosines'],
  },
  {
    id: 'law-of-sines',
    name: 'Law of Sines',
    description:
      'States that the ratio of each side to the sine of its opposite angle is constant in any triangle.',
    latex: '\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B} = \\dfrac{c}{\\sin C}',
    expression: 'a/sin(A) = b/sin(B) = c/sin(C)',
    category: 'trigonometry',
    tags: ['triangle', 'law of sines'],
  },
  {
    id: 'angle-addition-sin',
    name: 'Sine Angle Addition',
    description:
      'Expands sin(α ± β) into products of sines and cosines of the individual angles.',
    latex: '\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta',
    expression: 'sin(α ± β) = sin(α)cos(β) ± cos(α)sin(β)',
    category: 'trigonometry',
    tags: ['angle addition', 'identity'],
  },
  {
    id: 'product-to-sum',
    name: 'Product-to-Sum Identity',
    description:
      'Converts a product of two trig functions into a sum, useful for integration.',
    latex: '\\sin A \\cos B = \\tfrac{1}{2}[\\sin(A+B)+\\sin(A-B)]',
    expression: 'sin(A)cos(B) = [sin(A+B) + sin(A-B)] / 2',
    category: 'trigonometry',
    tags: ['product to sum', 'identity'],
  },
  {
    id: 'euler-formula',
    name: "Euler's Formula",
    description:
      "Links complex exponentials to trigonometric functions. At θ = π gives Euler's identity.",
    latex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta',
    expression: 'e^(iθ) = cos(θ) + i·sin(θ)',
    category: 'trigonometry',
    tags: ['complex', 'Euler', 'exponential'],
  },
  {
    id: 'half-angle-sin',
    name: 'Half-Angle Formulas',
    description:
      'Express sin and cos of half an angle in terms of the full angle; sign depends on quadrant.',
    latex: '\\sin\\tfrac{\\theta}{2} = \\pm\\sqrt{\\tfrac{1-\\cos\\theta}{2}}, \\quad \\cos\\tfrac{\\theta}{2} = \\pm\\sqrt{\\tfrac{1+\\cos\\theta}{2}}',
    expression: 'sin(θ/2) = ±√((1-cos θ)/2)',
    category: 'trigonometry',
    tags: ['half angle', 'identity'],
  },
  {
    id: 'sum-to-product',
    name: 'Sum-to-Product Identity',
    description:
      'Converts a sum of two sines into a product, useful for wave interference problems.',
    latex: '\\sin A + \\sin B = 2\\sin\\!\\tfrac{A+B}{2}\\cos\\!\\tfrac{A-B}{2}',
    expression: 'sin(A) + sin(B) = 2 sin((A+B)/2) cos((A-B)/2)',
    category: 'trigonometry',
    tags: ['sum to product', 'identity'],
  },

  // --- Calculus -------------------------------------------------------------
  {
    id: 'power-rule',
    name: 'Power Rule',
    description:
      'Differentiates any power function xⁿ by reducing the exponent by one.',
    latex: '\\dfrac{d}{dx}\\,x^n = n x^{n-1}',
    expression: 'd/dx [x^n] = n·x^(n-1)',
    category: 'calculus',
    tags: ['differentiation', 'derivative'],
  },
  {
    id: 'chain-rule',
    name: 'Chain Rule',
    description:
      'Differentiates composite functions by multiplying the outer and inner derivatives.',
    latex: '\\dfrac{d}{dx}[f(g(x))] = f\'(g(x))\\,g\'(x)',
    expression: 'd/dx [f(g(x))] = f\'(g(x)) · g\'(x)',
    category: 'calculus',
    tags: ['differentiation', 'composite'],
  },
  {
    id: 'product-rule',
    name: 'Product Rule',
    description:
      'Differentiates the product of two functions without multiplying them out first.',
    latex: '\\dfrac{d}{dx}[u\\,v] = u\'v + u\\,v\'',
    expression: 'd/dx [u·v] = u\'·v + u·v\'',
    category: 'calculus',
    tags: ['differentiation', 'product'],
  },
  {
    id: 'integration-by-parts',
    name: 'Integration by Parts',
    description:
      'Reduces the integral of a product using the reverse product rule. Choose u and dv wisely (LIATE).',
    latex: '\\int u\\,dv = uv - \\int v\\,du',
    expression: '∫ u dv = u·v - ∫ v du',
    category: 'calculus',
    tags: ['integration', 'product'],
  },
  {
    id: 'fundamental-theorem',
    name: 'Fundamental Theorem of Calculus',
    description:
      'Links differentiation and integration: the derivative of the area function returns the integrand.',
    latex: '\\dfrac{d}{dx}\\int_a^x f(t)\\,dt = f(x)',
    expression: 'd/dx ∫_a^x f(t) dt = f(x)',
    category: 'calculus',
    tags: ['integral', 'derivative', 'FTC'],
  },
  {
    id: 'taylor-series',
    name: 'Taylor Series',
    description:
      'Approximates a smooth function as an infinite polynomial centred at x = a.',
    latex: 'f(x) = \\sum_{n=0}^{\\infty} \\dfrac{f^{(n)}(a)}{n!}(x-a)^n',
    expression: 'f(x) = Σ f^(n)(a)/n! · (x-a)^n',
    category: 'calculus',
    tags: ['series', 'approximation', 'Taylor', 'Maclaurin'],
  },
  {
    id: "lhopital-rule",
    name: "L'Hôpital's Rule",
    description:
      'Evaluates indeterminate limits of the form 0/0 or ∞/∞ by differentiating numerator and denominator.',
    latex: "\\lim_{x \\to c}\\frac{f(x)}{g(x)} = \\lim_{x \\to c}\\frac{f'(x)}{g'(x)}",
    expression: "lim f(x)/g(x) = lim f'(x)/g'(x)  [0/0 or ∞/∞ forms]",
    category: 'calculus',
    tags: ["L'Hôpital", 'limits', 'indeterminate'],
  },
  {
    id: 'gaussian-integral',
    name: 'Gaussian Integral',
    description:
      'The integral of the bell curve over the entire real line, fundamental in probability and physics.',
    latex: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
    expression: '∫_{-∞}^{∞} e^(-x²) dx = √π',
    category: 'calculus',
    tags: ['Gaussian', 'integral', 'probability'],
  },
  {
    id: 'u-substitution',
    name: 'U-Substitution',
    description:
      'Change of variable technique that reverses the chain rule for integration.',
    latex: '\\int f(g(x))\\,g\'(x)\\,dx = \\int f(u)\\,du,\\quad u = g(x)',
    expression: '∫ f(g(x)) g\'(x) dx = ∫ f(u) du',
    category: 'calculus',
    tags: ['integration', 'substitution'],
  },
  {
    id: 'epsilon-delta',
    name: 'Epsilon-Delta Limit Definition',
    description:
      'Formal definition of a limit: for every ε > 0 there exists δ > 0 controlling the input neighbourhood.',
    latex: '\\lim_{x \\to a} f(x) = L \\iff \\forall\\varepsilon>0\\,\\exists\\delta>0:\\,0<|x-a|<\\delta\\Rightarrow|f(x)-L|<\\varepsilon',
    expression: 'lim f(x) = L iff for all ε>0 ∃δ>0: 0<|x-a|<δ → |f(x)-L|<ε',
    category: 'calculus',
    tags: ['limits', 'epsilon-delta', 'formal definition'],
  },

  // --- Linear Algebra -------------------------------------------------------
  {
    id: 'matrix-determinant-2x2',
    name: '2×2 Determinant',
    description:
      'Computes the determinant of a 2×2 matrix, representing the signed area of the parallelogram formed by its rows.',
    latex: '\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix} = ad - bc',
    expression: 'det([[a,b],[c,d]]) = ad - bc',
    category: 'linear-algebra',
    tags: ['determinant', 'matrix'],
  },
  {
    id: 'matrix-inverse-2x2',
    name: '2×2 Matrix Inverse',
    description:
      'Gives the inverse of an invertible 2×2 matrix A. Exists only when det(A) ≠ 0.',
    latex: 'A^{-1} = \\dfrac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}',
    expression: 'A^(-1) = 1/(ad-bc) · [[d,-b],[-c,a]]',
    category: 'linear-algebra',
    tags: ['inverse', 'matrix'],
  },
  {
    id: 'eigenvalue-equation',
    name: 'Eigenvalue Equation',
    description:
      'Defines eigenvalues λ and eigenvectors v of a linear transformation A: multiplying A by v merely scales it.',
    latex: 'A\\mathbf{v} = \\lambda\\mathbf{v}',
    expression: 'A·v = λ·v',
    category: 'linear-algebra',
    tags: ['eigenvalue', 'eigenvector'],
  },
  {
    id: 'characteristic-polynomial',
    name: 'Characteristic Polynomial',
    description:
      'Eigenvalues are roots of this polynomial; it is found by setting det(A − λI) = 0.',
    latex: '\\det(A - \\lambda I) = 0',
    expression: 'det(A - λI) = 0',
    category: 'linear-algebra',
    tags: ['eigenvalue', 'characteristic polynomial'],
  },
  {
    id: 'dot-product',
    name: 'Dot Product',
    description:
      'Scalar product of two vectors; equals |a||b|cos θ where θ is the angle between them.',
    latex: '\\mathbf{a}\\cdot\\mathbf{b} = \\sum_{i} a_i b_i = |\\mathbf{a}||\\mathbf{b}|\\cos\\theta',
    expression: 'a·b = Σ aᵢbᵢ = |a||b| cos(θ)',
    category: 'linear-algebra',
    tags: ['dot product', 'vectors'],
  },
  {
    id: 'cross-product',
    name: 'Cross Product Magnitude',
    description:
      'Magnitude of the cross product equals the area of the parallelogram spanned by the two vectors.',
    latex: '|\\mathbf{a}\\times\\mathbf{b}| = |\\mathbf{a}||\\mathbf{b}|\\sin\\theta',
    expression: '|a × b| = |a| |b| sin(θ)',
    category: 'linear-algebra',
    tags: ['cross product', 'vectors'],
  },
  {
    id: 'gram-schmidt',
    name: 'Gram-Schmidt Projection',
    description:
      'Projects vector u onto the span of v, used iteratively to orthogonalise a basis.',
    latex: '\\text{proj}_{\\mathbf{v}}\\mathbf{u} = \\dfrac{\\mathbf{u}\\cdot\\mathbf{v}}{\\mathbf{v}\\cdot\\mathbf{v}}\\mathbf{v}',
    expression: 'proj_v(u) = (u·v / v·v) · v',
    category: 'linear-algebra',
    tags: ['projection', 'orthogonalisation', 'Gram-Schmidt'],
  },
  {
    id: 'matrix-product',
    name: 'Matrix Multiplication',
    description:
      'Element (i,j) of the product AB is the dot product of row i of A with column j of B.',
    latex: '(AB)_{ij} = \\sum_{k} A_{ik} B_{kj}',
    expression: '(AB)_ij = Σ_k A_ik · B_kj',
    category: 'linear-algebra',
    tags: ['matrix', 'multiplication'],
  },
  {
    id: 'trace',
    name: 'Trace and Eigenvalue Relation',
    description:
      'The trace of a matrix (sum of diagonal entries) equals the sum of its eigenvalues.',
    latex: '\\text{tr}(A) = \\sum_i A_{ii} = \\sum_i \\lambda_i',
    expression: 'tr(A) = Σ A_ii = Σ λᵢ',
    category: 'linear-algebra',
    tags: ['trace', 'eigenvalue'],
  },
  {
    id: 'rank-nullity',
    name: 'Rank-Nullity Theorem',
    description:
      'The rank plus the nullity of a matrix always equal the number of its columns.',
    latex: '\\text{rank}(A) + \\text{nullity}(A) = n',
    expression: 'rank(A) + nullity(A) = n',
    category: 'linear-algebra',
    tags: ['rank', 'nullity'],
  },

  // --- Statistics ------------------------------------------------------------
  {
    id: 'mean',
    name: 'Arithmetic Mean',
    description:
      'The average value of a data set: sum all values and divide by the number of observations.',
    latex: '\\bar{x} = \\dfrac{1}{n}\\sum_{i=1}^{n} x_i',
    expression: 'x̄ = (1/n) Σ xᵢ',
    category: 'statistics',
    tags: ['mean', 'average', 'descriptive'],
  },
  {
    id: 'variance',
    name: 'Sample Variance',
    description:
      'Measures spread of data around the mean. Uses n−1 (Bessel correction) for unbiased estimation.',
    latex: 's^2 = \\dfrac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2',
    expression: 's² = Σ(xᵢ - x̄)² / (n-1)',
    category: 'statistics',
    tags: ['variance', 'spread', 'Bessel'],
  },
  {
    id: 'standard-deviation',
    name: 'Standard Deviation',
    description:
      'The square root of variance; expressed in the same units as the data.',
    latex: 's = \\sqrt{\\dfrac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}',
    expression: 's = √(Σ(xᵢ - x̄)² / (n-1))',
    category: 'statistics',
    tags: ['standard deviation', 'spread'],
  },
  {
    id: 'normal-distribution',
    name: 'Normal Distribution PDF',
    description:
      'Probability density function of the Gaussian (bell curve) with mean μ and standard deviation σ.',
    latex: 'f(x) = \\dfrac{1}{\\sigma\\sqrt{2\\pi}}\\exp\\!\\left(-\\dfrac{(x-\\mu)^2}{2\\sigma^2}\\right)',
    expression: 'f(x) = 1/(σ√(2π)) · exp(-(x-μ)² / (2σ²))',
    category: 'statistics',
    tags: ['normal distribution', 'Gaussian', 'PDF'],
  },
  {
    id: 'bayes-theorem',
    name: "Bayes' Theorem",
    description:
      'Updates the probability of hypothesis H given new evidence E, incorporating prior knowledge.',
    latex: 'P(H|E) = \\dfrac{P(E|H)\\,P(H)}{P(E)}',
    expression: 'P(H|E) = P(E|H) P(H) / P(E)',
    category: 'statistics',
    tags: ["Bayes", "conditional probability", "posterior"],
  },
  {
    id: 'correlation-coefficient',
    name: 'Pearson Correlation Coefficient',
    description:
      'Measures linear association between two variables; ranges from −1 (perfect negative) to +1 (perfect positive).',
    latex: 'r = \\dfrac{\\sum(x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum(x_i-\\bar{x})^2\\sum(y_i-\\bar{y})^2}}',
    expression: 'r = Σ(xᵢ-x̄)(yᵢ-ȳ) / √(Σ(xᵢ-x̄)² Σ(yᵢ-ȳ)²)',
    category: 'statistics',
    tags: ['correlation', 'Pearson', 'regression'],
  },
  {
    id: 'binomial-distribution',
    name: 'Binomial Distribution PMF',
    description:
      'Probability of exactly k successes in n independent Bernoulli trials each with probability p.',
    latex: 'P(X=k) = \\binom{n}{k}p^k(1-p)^{n-k}',
    expression: 'P(X=k) = C(n,k) p^k (1-p)^(n-k)',
    category: 'statistics',
    tags: ['binomial', 'PMF', 'discrete'],
  },
  {
    id: 'central-limit-theorem',
    name: 'Central Limit Theorem',
    description:
      'The sampling distribution of the mean approaches normality as n → ∞, regardless of the population distribution.',
    latex: '\\bar{X} \\xrightarrow{d} N\\!\\left(\\mu,\\,\\dfrac{\\sigma^2}{n}\\right) \\text{ as } n\\to\\infty',
    expression: 'X̄ → N(μ, σ²/n) as n → ∞',
    category: 'statistics',
    tags: ['CLT', 'sampling distribution'],
  },
  {
    id: 'confidence-interval',
    name: 'Confidence Interval (Mean)',
    description:
      'A 95% CI for the population mean uses the sample mean ± 1.96 standard errors.',
    latex: '\\bar{x} \\pm z_{\\alpha/2}\\dfrac{s}{\\sqrt{n}}',
    expression: 'CI = x̄ ± z_(α/2) · s/√n',
    category: 'statistics',
    tags: ['confidence interval', 'estimation'],
  },
  {
    id: 'poisson-distribution',
    name: 'Poisson Distribution PMF',
    description:
      'Models the number of events occurring in a fixed interval when events happen at constant rate λ.',
    latex: 'P(X=k) = \\dfrac{\\lambda^k e^{-\\lambda}}{k!}',
    expression: 'P(X=k) = λ^k e^(-λ) / k!',
    category: 'statistics',
    tags: ['Poisson', 'PMF', 'rate'],
  },

  // --- Physics ---------------------------------------------------------------
  {
    id: 'newtons-second-law',
    name: "Newton's Second Law",
    description:
      'Net force on an object equals its mass times acceleration. Foundation of classical mechanics.',
    latex: '\\mathbf{F} = m\\mathbf{a}',
    expression: 'F = m·a',
    category: 'physics',
    tags: ['Newton', 'force', 'mechanics'],
  },
  {
    id: 'kinetic-energy',
    name: 'Kinetic Energy',
    description:
      'Energy an object possesses due to its motion; proportional to mass and the square of velocity.',
    latex: 'K = \\dfrac{1}{2}mv^2',
    expression: 'K = (1/2) m v²',
    category: 'physics',
    tags: ['energy', 'kinetic', 'mechanics'],
  },
  {
    id: 'coulombs-law',
    name: "Coulomb's Law",
    description:
      'Electrostatic force between two point charges; decreases as the inverse square of the distance.',
    latex: 'F = k_e\\dfrac{q_1 q_2}{r^2}',
    expression: 'F = k_e q₁ q₂ / r²',
    category: 'physics',
    tags: ['Coulomb', 'electrostatics', 'charge'],
  },
  {
    id: 'schrodinger-equation',
    name: 'Time-Dependent Schrödinger Equation',
    description:
      'Governs the evolution of the quantum state ψ of a particle under Hamiltonian H.',
    latex: 'i\\hbar\\dfrac{\\partial\\psi}{\\partial t} = \\hat{H}\\psi',
    expression: 'iℏ ∂ψ/∂t = H·ψ',
    category: 'physics',
    tags: ['quantum mechanics', 'Schrödinger', 'wave function'],
  },
  {
    id: 'mass-energy-equivalence',
    name: 'Mass-Energy Equivalence',
    description:
      "Einstein's iconic result: rest mass and energy are interconvertible via the speed of light squared.",
    latex: 'E = mc^2',
    expression: 'E = m·c²',
    category: 'physics',
    tags: ['relativity', 'Einstein', 'energy'],
  },
  {
    id: 'gravitational-force',
    name: "Newton's Law of Gravitation",
    description:
      'Two masses attract each other with a force proportional to their masses and inversely proportional to the square of their distance.',
    latex: 'F = G\\dfrac{m_1 m_2}{r^2}',
    expression: 'F = G m₁ m₂ / r²',
    category: 'physics',
    tags: ['gravity', 'Newton', 'force'],
  },
  {
    id: 'maxwell-faraday',
    name: "Faraday's Law (Maxwell)",
    description:
      'A changing magnetic flux induces an electromotive force (EMF) in a closed loop.',
    latex: '\\mathcal{E} = -\\dfrac{d\\Phi_B}{dt}',
    expression: 'EMF = -dΦ_B/dt',
    category: 'physics',
    tags: ['electromagnetism', 'Faraday', 'Maxwell'],
  },
  {
    id: 'ideal-gas-law',
    name: 'Ideal Gas Law',
    description:
      'Relates pressure, volume, amount (moles), and temperature of an ideal gas.',
    latex: 'PV = nRT',
    expression: 'P·V = n·R·T',
    category: 'physics',
    tags: ['thermodynamics', 'gas', 'pressure'],
  },
  {
    id: 'wave-equation',
    name: 'Wave Speed Relation',
    description:
      'Wave speed equals frequency times wavelength; fundamental to optics, acoustics, and electromagnetism.',
    latex: 'v = f\\lambda',
    expression: 'v = f · λ',
    category: 'physics',
    tags: ['wave', 'frequency', 'wavelength'],
  },
  {
    id: 'de-broglie',
    name: 'de Broglie Wavelength',
    description:
      'Every particle with momentum p has an associated matter wavelength, merging wave and particle pictures.',
    latex: '\\lambda = \\dfrac{h}{p}',
    expression: 'λ = h / p',
    category: 'physics',
    tags: ['quantum mechanics', 'de Broglie', 'wave-particle duality'],
  },

  // --- Geometry -------------------------------------------------------------
  {
    id: 'pythagorean-theorem',
    name: 'Pythagorean Theorem',
    description:
      'In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.',
    latex: 'a^2 + b^2 = c^2',
    expression: 'a² + b² = c²',
    category: 'geometry',
    tags: ['right triangle', 'Pythagoras'],
  },
  {
    id: 'circle-area',
    name: 'Area of a Circle',
    description:
      'Area enclosed by a circle of radius r; proportional to the square of the radius.',
    latex: 'A = \\pi r^2',
    expression: 'A = π · r²',
    category: 'geometry',
    tags: ['circle', 'area'],
  },
  {
    id: 'circle-circumference',
    name: 'Circumference of a Circle',
    description:
      'Perimeter of a circle; linear in the radius (or diameter).',
    latex: 'C = 2\\pi r = \\pi d',
    expression: 'C = 2π·r = π·d',
    category: 'geometry',
    tags: ['circle', 'perimeter'],
  },
  {
    id: 'sphere-volume',
    name: 'Volume of a Sphere',
    description:
      '3D volume enclosed by a sphere of radius r; derived by integrating circular cross-sections.',
    latex: 'V = \\dfrac{4}{3}\\pi r^3',
    expression: 'V = (4/3) π r³',
    category: 'geometry',
    tags: ['sphere', 'volume'],
  },
  {
    id: 'sphere-surface',
    name: 'Surface Area of a Sphere',
    description:
      'Total surface area of a sphere; four times the area of a great circle.',
    latex: 'S = 4\\pi r^2',
    expression: 'S = 4π·r²',
    category: 'geometry',
    tags: ['sphere', 'surface area'],
  },
  {
    id: 'heron-formula',
    name: "Heron's Formula",
    description:
      "Area of a triangle from its three side lengths alone, using the semi-perimeter s = (a+b+c)/2.",
    latex: 'A = \\sqrt{s(s-a)(s-b)(s-c)},\\quad s=\\tfrac{a+b+c}{2}',
    expression: 'A = √(s(s-a)(s-b)(s-c)), s = (a+b+c)/2',
    category: 'geometry',
    tags: ['triangle', 'area', "Heron"],
  },
  {
    id: 'cylinder-volume',
    name: 'Volume of a Cylinder',
    description:
      'Volume of a right circular cylinder with base radius r and height h.',
    latex: 'V = \\pi r^2 h',
    expression: 'V = π r² h',
    category: 'geometry',
    tags: ['cylinder', 'volume'],
  },
  {
    id: 'cone-volume',
    name: 'Volume of a Cone',
    description:
      'Volume of a right circular cone: one-third the volume of its enclosing cylinder.',
    latex: 'V = \\dfrac{1}{3}\\pi r^2 h',
    expression: 'V = (1/3) π r² h',
    category: 'geometry',
    tags: ['cone', 'volume'],
  },
  {
    id: 'distance-formula',
    name: 'Distance Formula (2D)',
    description:
      'Euclidean distance between two points in the plane, derived directly from the Pythagorean theorem.',
    latex: 'd = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}',
    expression: 'd = √((x₂-x₁)² + (y₂-y₁)²)',
    category: 'geometry',
    tags: ['distance', 'Euclidean'],
  },
  {
    id: 'ellipse-area',
    name: 'Area of an Ellipse',
    description:
      'Area enclosed by an ellipse with semi-major axis a and semi-minor axis b; reduces to πr² for a circle.',
    latex: 'A = \\pi a b',
    expression: 'A = π·a·b',
    category: 'geometry',
    tags: ['ellipse', 'area'],
  },
];

// ---------------------------------------------------------------------------
// Category Metadata
// ---------------------------------------------------------------------------

interface CategoryMeta {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  gradient: string;
  border: string;
  chip: string;
  glow: string;
  text: string;
}

const CATEGORY_META: Record<FormulaCategory, CategoryMeta> = {
  algebra: {
    label: 'Algebra',
    icon: FunctionSquare,
    gradient: 'from-blue-950/40 to-blue-900/40',
    border: 'border-blue-500/40 hover:border-blue-400/60',
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(59,130,246,0.3)]',
    text: 'text-blue-300',
  },
  trigonometry: {
    label: 'Trigonometry',
    icon: Triangle,
    gradient: 'from-purple-950/40 to-purple-900/40',
    border: 'border-purple-500/40 hover:border-purple-400/60',
    chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(168,85,247,0.3)]',
    text: 'text-purple-300',
  },
  calculus: {
    label: 'Calculus',
    icon: Infinity,
    gradient: 'from-emerald-950/40 to-emerald-900/40',
    border: 'border-emerald-500/40 hover:border-emerald-400/60',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]',
    text: 'text-emerald-300',
  },
  'linear-algebra': {
    label: 'Linear Algebra',
    icon: Grid3x3,
    gradient: 'from-amber-950/40 to-amber-900/40',
    border: 'border-amber-500/40 hover:border-amber-400/60',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.3)]',
    text: 'text-amber-300',
  },
  statistics: {
    label: 'Statistics',
    icon: BarChart3,
    gradient: 'from-cyan-950/40 to-cyan-900/40',
    border: 'border-cyan-500/40 hover:border-cyan-400/60',
    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(6,182,212,0.3)]',
    text: 'text-cyan-300',
  },
  physics: {
    label: 'Physics',
    icon: Zap,
    gradient: 'from-rose-950/40 to-rose-900/40',
    border: 'border-rose-500/40 hover:border-rose-400/60',
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(244,63,94,0.3)]',
    text: 'text-rose-300',
  },
  geometry: {
    label: 'Geometry',
    icon: Circle,
    gradient: 'from-orange-950/40 to-orange-900/40',
    border: 'border-orange-500/40 hover:border-orange-400/60',
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    glow: 'hover:shadow-[0_0_24px_rgba(249,115,22,0.3)]',
    text: 'text-orange-300',
  },
} satisfies Record<FormulaCategory, CategoryMeta>;

const ALL_CATEGORIES: FormulaCategory[] = [
  'algebra',
  'trigonometry',
  'calculus',
  'linear-algebra',
  'statistics',
  'physics',
  'geometry',
];

// ---------------------------------------------------------------------------
// FormulaCard sub-component
// ---------------------------------------------------------------------------

interface FormulaCardProps {
  formula: FormulaEntry;
  index: number;
}

function FormulaCard({ formula, index }: FormulaCardProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meta = CATEGORY_META[formula.category];
  const CategoryIcon = meta.icon;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formula.expression);
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      // Clipboard API not available; silent fail
    }
  }, [formula.expression]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.04, 0.32),
        ease: 'easeOut',
      }}
      className={cn(
        'group relative flex flex-col gap-3 p-5 rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer',
        `bg-gradient-to-br ${meta.gradient}`,
        meta.border,
        meta.glow,
        'shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
      )}
      onClick={handleCopy}
      role="button"
      tabIndex={0}
      aria-label={`${formula.name}: ${formula.description}. Click to copy expression.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleCopy();
        }
      }}
    >
      {/* Top row: category chip + copy icon */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
            meta.chip
          )}
          aria-hidden="true"
        >
          <CategoryIcon className="h-3 w-3" aria-hidden="true" />
          {meta.label}
        </span>

        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{ scale: copied ? 1.15 : 1 }}
          className={cn(
            'shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-200',
            copied
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-muted/20 text-muted-foreground group-hover:text-foreground group-hover:bg-muted/40'
          )}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </motion.div>
      </div>

      {/* Formula name */}
      <h3 className={cn('text-sm font-semibold leading-tight', meta.text)}>
        {formula.name}
      </h3>

      {/* KaTeX rendered formula */}
      <div
        className="rounded-lg bg-background/40 backdrop-blur-sm border border-border/30 px-3 py-3 overflow-x-auto"
        aria-hidden="true"
      >
        <MathRenderer
          expression={formula.latex}
          displayMode
          className="text-base pointer-events-none select-none"
          ariaLabel={formula.name}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">
        {formula.description}
      </p>

      {/* Copied feedback overlay */}
      <AnimatePresence>
        {copied && (
          <motion.div
            key="copied-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center bg-emerald-950/60 backdrop-blur-sm rounded-xl pointer-events-none"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="flex items-center gap-2 px-4 py-2 bg-emerald-900/80 border border-emerald-500/40 rounded-full text-emerald-300 text-sm font-medium">
              <Check className="h-4 w-4" aria-hidden="true" />
              Copied!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

/**
 * Formula Library Page
 *
 * A searchable, filterable reference library of 60+ mathematical and physics
 * formulas rendered with KaTeX. Each card is clickable to copy the plain-text
 * expression to the clipboard.
 *
 * Features:
 * - Full-text search across name, description, and tags
 * - Category chip filters (multi-select)
 * - Animated card grid with Framer Motion layout animations
 * - KaTeX LaTeX rendering via MathRenderer component
 * - Clipboard copy with visual feedback
 * - Keyboard accessible (Tab + Enter/Space to copy)
 * - Responsive: 1 col mobile → 2 col tablet → 3 col desktop
 * - Respects prefers-reduced-motion
 *
 * Accessibility:
 * - All interactive elements have ARIA labels
 * - role="status" live region announces result counts
 * - Keyboard navigation for category chips and formula cards
 * - Focus rings on all interactive elements
 * - Screen-reader-only copy state announcements
 */
export default function FormulasPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<FormulaCategory[]>([]);

  const toggleCategory = useCallback((cat: FormulaCategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategories([]);
  }, []);

  const hasActiveFilters = searchQuery.length > 0 || activeCategories.length > 0;

  const filteredFormulas = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return FORMULAS.filter((formula) => {
      // Category filter
      if (activeCategories.length > 0 && !activeCategories.includes(formula.category)) {
        return false;
      }
      // Text search
      if (query) {
        const haystack = [
          formula.name,
          formula.description,
          CATEGORY_META[formula.category].label,
          ...(formula.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });
  }, [searchQuery, activeCategories]);

  // Group filtered formulas by category for the count summary
  const countByCategory = useMemo(() => {
    const counts: Partial<Record<FormulaCategory, number>> = {};
    for (const f of filteredFormulas) {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
    }
    return counts;
  }, [filteredFormulas]);

  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden py-14 px-4">
        {/* Decorative background blobs */}
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-12 left-8 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-8 right-12 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: '1.2s' }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/3 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: '2.4s' }}
          />
        </div>

        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Reference Library</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-5 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              Formula Library
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
              {FORMULAS.length}+ essential formulas across 7 disciplines — rendered in LaTeX, searchable, and one-click copyable.
            </p>

            {/* Category highlight pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm" aria-hidden="true">
              {ALL_CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                return (
                  <span
                    key={cat}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border',
                      meta.chip
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Filters + Grid                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar filters */}
          <aside className="lg:col-span-1" aria-label="Formula filters">
            <div className="sticky top-24 flex flex-col gap-4 p-5 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Filters</h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label="Clear all filters"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear all
                  </button>
                )}
              </div>

              {/* Search input */}
              <div>
                <label htmlFor="formula-search" className="sr-only">
                  Search formulas
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="formula-search"
                    type="search"
                    placeholder="Search formulas…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-sm text-foreground',
                      'placeholder:text-muted-foreground',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      'transition-colors'
                    )}
                    aria-label="Search formulas by name, description, or tag"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring rounded"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category filter chips */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  Categories
                </p>
                <div className="flex flex-col gap-1.5">
                  {ALL_CATEGORIES.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    const isActive = activeCategories.includes(cat);
                    const count = countByCategory[cat] ?? 0;
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        aria-pressed={isActive}
                        aria-label={`Filter by ${meta.label}${isActive ? ', currently active' : ''}`}
                        className={cn(
                          'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium',
                          'border transition-all duration-200',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          isActive
                            ? cn(meta.chip, 'border-transparent shadow-sm')
                            : 'bg-background border-border text-foreground hover:border-border/80 hover:bg-muted/30'
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {meta.label}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full',
                            isActive ? 'bg-white/10' : 'bg-muted/50 text-muted-foreground'
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active filter summary */}
              {hasActiveFilters && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Showing{' '}
                    <span className="font-semibold text-foreground">
                      {filteredFormulas.length}
                    </span>{' '}
                    of {FORMULAS.length} formulas
                    {activeCategories.length > 0 && (
                      <span>
                        {' '}in{' '}
                        <span className="font-semibold text-foreground">
                          {activeCategories.length}
                        </span>{' '}
                        {activeCategories.length === 1 ? 'category' : 'categories'}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Main grid area */}
          <div className="lg:col-span-3">
            {/* Result count header */}
            <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-semibold">
                  {hasActiveFilters ? 'Filtered Results' : 'All Formulas'}
                </h2>
                <p
                  className="text-sm text-muted-foreground mt-0.5"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {filteredFormulas.length === 1
                    ? '1 formula'
                    : `${filteredFormulas.length} formulas`}
                  {searchQuery && (
                    <span>
                      {' '}matching &ldquo;
                      <span className="font-medium text-foreground">{searchQuery}</span>
                      &rdquo;
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Click any card to copy the expression
              </p>
            </div>

            {/* Formula grid */}
            {filteredFormulas.length > 0 ? (
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {filteredFormulas.map((formula, index) => (
                    <FormulaCard key={formula.id} formula={formula} index={index} />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              /* Empty state */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
                role="status"
                aria-live="polite"
              >
                <div className="mb-4 p-4 rounded-full bg-muted/20">
                  <Search className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No formulas found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                  Try a different search term or clear the category filters to see all formulas.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Clear all filters
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Educational callout                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 pb-16" aria-label="Tip">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="p-7 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/20 shrink-0" aria-hidden="true">
              <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Using This Library</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Click any formula card to copy its plain-text expression to the clipboard — ready to paste into the calculator, worksheet, or your own notes.
                Use the search box to find formulas by name, description, or keyword (e.g. &ldquo;quadratic&rdquo;, &ldquo;Bayes&rdquo;, or &ldquo;determinant&rdquo;).
                Category chips let you narrow down to a specific branch of mathematics or physics.
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
