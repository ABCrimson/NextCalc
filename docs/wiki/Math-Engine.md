# Math Engine

`@nextcalc/math-engine` is the core mathematical computation library with 20 subpath export modules.

## Modules

| Module | Import Path | Description |
|:-------|:------------|:------------|
| Parser | `@nextcalc/math-engine/parser` | Expression tokenizer, AST builder, evaluator |
| Symbolic | `@nextcalc/math-engine/symbolic` | Differentiation, integration, simplification, series, limits |
| CAS | `@nextcalc/math-engine/cas` | Computer algebra system core |
| Matrix | `@nextcalc/math-engine/matrix` | Linear algebra, eigenvalues, decompositions |
| Solver | `@nextcalc/math-engine/solver` | Algebraic + ODE equation solving |
| Stats | `@nextcalc/math-engine/stats` | Statistics, distributions, regression |
| Complex | `@nextcalc/math-engine/complex` | Complex number arithmetic |
| Units | `@nextcalc/math-engine/units` | Unit conversion engine |
| Fourier | `@nextcalc/math-engine/fourier` | FFT, IFFT, spectral analysis, Fourier series |
| Graph Theory | `@nextcalc/math-engine/graph-theory` | MST, SCC, coloring, max flow, TSP |
| Algorithms | `@nextcalc/math-engine/algorithms` | Sorting, searching, graph, DP, greedy, string algorithms |
| Game Theory | `@nextcalc/math-engine/game-theory/game-theory` | Nash equilibrium, dominant strategies |
| Chaos Theory | `@nextcalc/math-engine/chaos/chaos-theory` | Lorenz attractor, bifurcation |
| Calculus | `@nextcalc/math-engine/calculus` | Vector calculus, line/surface integrals |
| Differential | `@nextcalc/math-engine/differential` | ODE/PDE support |
| Problems | `@nextcalc/math-engine/problems` | Practice problem generation |
| Prover | `@nextcalc/math-engine/prover` | Logic core + proof search |
| Knowledge | `@nextcalc/math-engine/knowledge` | Mathematical knowledge base |
| Content | `@nextcalc/math-engine/content` | Educational content, LaTeX/Markdown |
| WASM | `@nextcalc/math-engine/wasm` | Arbitrary precision (scaffolded, mock fallback) |

## Usage Examples

### Expression Parsing

```typescript
import { parse, evaluate } from '@nextcalc/math-engine';

const ast = parse('2 * sin(x) + 3');
const result = evaluate(ast, { x: Math.PI / 2 });
// result = 5
```

### Symbolic Differentiation

```typescript
import { differentiate, simplify } from '@nextcalc/math-engine';

const expr = parse('x^3 + 2*x^2 + x');
const derivative = differentiate(expr, 'x');
const simplified = simplify(derivative);
// 3*x^2 + 4*x + 1
```

### Symbolic Integration

```typescript
import { integrate } from '@nextcalc/math-engine';

const expr = parse('x * ln(x)');
const integral = integrate(expr, 'x');
// x^2/2 * ln(x) - x^2/4 + C
```

### Taylor Series

```typescript
import { parse, taylorSeries } from '@nextcalc/math-engine';

const series = taylorSeries(parse('sin(x)'), 'x', { center: 0, terms: 5 });
// x - x^3/6 + x^5/120
```

### Graph Algorithms

```typescript
import { dijkstra, kruskal, pageRank } from '@nextcalc/math-engine';

const graph = createGraph(5);
graph.addEdge(0, 1, 4);
graph.addEdge(0, 2, 1);
graph.addEdge(2, 1, 2);

const shortest = dijkstra(graph, 0);
const mst = kruskal(graph);
const ranks = pageRank(graph);
```

### Number Theory

```typescript
import { isPrime, millerRabin, primeFactorize, modPow, crt } from '@nextcalc/math-engine';

isPrime(104729); // true
millerRabin(104729, 20); // true
primeFactorize(360); // PrimeFactorization { factors: Map { 2 => 3, 3 => 2, 5 => 1 }, n: 360 }
modPow(2, 10, 1000); // 24
```

### Theorem Prover

```typescript
import { atom, implies, isTautology, NDProofBuilder } from '@nextcalc/math-engine';

const p = atom('P');
const q = atom('Q');
const formula = implies(implies(p, q), implies(p, q));
isTautology(formula); // true
```

## AST Types

The parser produces an AST using these node types (from `NodeType` enum):

- `ConstantNode` - Numeric literals
- `SymbolNode` - Variables
- `OperatorNode` - Binary operators (+, -, *, /, ^)
- `FunctionNode` - Function calls (sin, cos, ln, etc.)

Use builder functions: `createConstantNode()`, `createSymbolNode()`, `createOperatorNode()`.

## BigInt Safety

Since v1.1.0, `modPow` and `lucasLehmer` expose `number` signatures (`modPow(base, exp, m): number`, `lucasLehmer(p): boolean`) while computing internally with BigInt to prevent integer overflow. Within RSA key generation (`algorithms/crypto/rsa.ts`), a private `randomBigIntBelow()` helper replaces unsafe `Number(bigint)` conversions, ensuring correct uniform sampling for arbitrarily large key candidates. It is an internal helper scoped to RSA, not a cross-cutting public export.

## Performance

Key algorithms are optimized with typed arrays and efficient data structures:

- **Sieve of Eratosthenes** uses `Uint8Array` for O(n) memory with cache-friendly sequential access
- **PageRank** uses `Float64Array` for cache-friendly iteration over rank vectors
- **Tarjan SCC** uses an iterative DFS stack (no recursion) to avoid stack overflow on large graphs
- **Topological sort (Kahn)** uses an index pointer instead of `Array.shift()` for O(V+E) instead of O(V^2)
- **Math.min/max** on large arrays replaced with `.reduce()` to prevent call stack limits

## Type Safety

Production code has zero `as any` -- all AST visitors use proper discriminated union types via the `NodeType` enum. Type narrowing is enforced through `switch`/`case` on `node.type`, ensuring exhaustive handling of all AST node variants. Only test mock files contain `biome-ignore` exceptions for type assertions.
