# Math Engine

`@nextcalc/math-engine` is the core mathematical computation library with 18+ modules available via subpath exports.

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
import { taylorSeries } from '@nextcalc/math-engine';

const series = taylorSeries('sin(x)', 'x', 0, 5);
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
millerRabin(104729n, 20); // true
primeFactorize(360); // { 2: 3, 3: 2, 5: 1 }
modPow(2n, 10n, 1000n); // 24n
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
