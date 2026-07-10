# @nextcalc/math-engine

Core mathematical computation library for NextCalc Pro: expression parsing, symbolic algebra, linear algebra, statistics, graph/game theory, number theory, and more -- all consumed via subpath exports so callers only pull in the modules they need.

## Tech Stack

- **Language:** TypeScript 7 native (the Go-based compiler is the real `typecheck` gate for this package)
- **Numeric backend:** Math.js 15.x for expression parsing/evaluation, with a custom type-safe AST layer on top
- **Arbitrary precision:** WASM scaffolding in `src/wasm/` (Emscripten/MPFR build still pending -- see [docs/ROADMAP.md](../../docs/ROADMAP.md); production **throws** if the module isn't built, no silent float fallback; the mock is test/dev-only)
- **Testing:** Vitest + property-based testing via `fast-check`

> Exact pinned versions live in [`package.json`](package.json).

## Module Index

Each row is an importable subpath, e.g. `import { differentiate } from '@nextcalc/math-engine/symbolic'`. The bare package entry point (`@nextcalc/math-engine`) re-exports the most commonly used functions across modules.

| Subpath | Description |
|:--------|:-------------|
| `.` (root) | Barrel re-export of the most commonly used functions across all modules |
| `./parser` | Expression tokenizer, AST builder (`NodeType` enum, `createConstantNode()`/`createSymbolNode()`/`createOperatorNode()`), evaluator |
| `./symbolic` | Symbolic differentiation, integration (15+ rules), simplification, Taylor series, limits |
| `./cas` | Computer algebra system core -- pattern matching, expression simplification |
| `./matrix` | Linear algebra: multiplication, inverse, eigenvalues, decompositions |
| `./solver` | Algebraic + ODE equation solving |
| `./stats` | Statistics, distributions, regression |
| `./complex` | Complex number arithmetic (`Complex` class) |
| `./units` | Unit conversion engine (SI + imperial) |
| `./fourier` | FFT, IFFT, spectral analysis, Fourier series -- see [FOURIER_EXAMPLES.md](FOURIER_EXAMPLES.md) |
| `./graph-theory` | Graph algorithms: Dijkstra, BFS/DFS, MST, PageRank, SCC, max flow, TSP, coloring -- see [GRAPH_THEORY_EXAMPLES.md](GRAPH_THEORY_EXAMPLES.md) |
| `./game-theory` | Nash equilibrium, dominant strategies |
| `./chaos` | Lorenz attractor, bifurcation maps |
| `./calculus` | Vector calculus, line/surface integrals |
| `./differential` | Differential equations (ODE/PDE support) |
| `./algorithms` | Sorting, searching, cryptography (RSA, Miller-Rabin), quantum simulation, ML algorithms |
| `./knowledge` | Mathematical knowledge base (formulas, theorems) |
| `./problems` | Practice problem generation |
| `./prover` | Logic core + proof search (BFS/DFS/iterative deepening) |
| `./content` | Educational content (lessons, LaTeX/Markdown explanations) |
| `./wasm` | Arbitrary precision arithmetic (`getWASMManager()`, `getHighPrecision()`) -- scaffolded, no native build yet |

Two additional source directories, `src/algebra/` and `src/number-theory/`, don't have dedicated subpath exports -- they're consumed through the root entry point and through `./algorithms` respectively.

## Usage Examples

```typescript
import { parse, evaluate, differentiate, simplify } from '@nextcalc/math-engine';

const ast = parse('2 * sin(x) + 3');
evaluate(ast, { x: Math.PI / 2 }); // 5

const derivative = simplify(differentiate(parse('x^3 + 2*x^2 + x'), 'x'));
// 3*x^2 + 4*x + 1
```

```typescript
import { dijkstra, kruskal, pageRank } from '@nextcalc/math-engine/graph-theory';
import { fft, fourierSeries } from '@nextcalc/math-engine/fourier';
```

See [FOURIER_EXAMPLES.md](FOURIER_EXAMPLES.md) and [GRAPH_THEORY_EXAMPLES.md](GRAPH_THEORY_EXAMPLES.md) for worked, module-specific examples, and [docs/wiki/Math-Engine.md](../../docs/wiki/Math-Engine.md) for the full API reference including AST types, BigInt-safety notes, and performance characteristics.

## Commands

```bash
pnpm --filter @nextcalc/math-engine test       # Vitest
pnpm --filter @nextcalc/math-engine build      # tsc build
pnpm --filter @nextcalc/math-engine rebuild    # clean + build
pnpm --filter @nextcalc/math-engine typecheck  # tsc --noEmit
pnpm --filter @nextcalc/math-engine lint       # Biome
```

## Type Safety

Production code has zero `as any` -- all AST visitors use the `NodeType` discriminated union with exhaustive `switch`/`case` narrowing. Only test mock files carry `biome-ignore` exceptions for type assertions.
