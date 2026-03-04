<div align="center">
  <img src="https://raw.githubusercontent.com/ABCrimson/NextCalc/main/docs/assets/banner.svg" alt="NextCalc Pro" width="100%" />
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/github/actions/workflow/status/ABCrimson/NextCalc/ci.yml?branch=main&label=CI&logo=github" alt="CI" />
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="License" />
  <img src="https://img.shields.io/badge/deploy-nextcalc.io-000?logo=vercel&logoColor=white" alt="Deployed" />
  <img src="https://img.shields.io/badge/i18n-8_languages-a78bfa" alt="i18n" />
  <img src="https://img.shields.io/badge/edge-3_workers-F38020?logo=cloudflare&logoColor=white" alt="Workers" />
</p>

### What's New in v1.2.1

> **Comprehensive Audit, CI/CD Pipeline Fixes & Full Green CI**

<details>
<summary><strong>Highlights</strong></summary>

| Category | Improvements |
|:---------|:-------------|
| **Audit** | 78 issues fixed across entire monorepo (25 HIGH, 47 MEDIUM, 6 LOW) — security, performance, code quality |
| **CI/CD** | All 5 CI jobs green (Install, Lint, Typecheck, Build, Test), 54 test failures fixed, 170+ files formatted |
| **Security** | Path traversal guard, GraphQL redirect sanitization, input validation hardening |
| **Performance** | New DataLoaders (`hasUpvoted`, `commentCountByPostId`), `invalidateByPrefix` cache method |
| **Infrastructure** | GitHub Actions v6, `AUTH_SECRET` in CI build, Workers deploy with `workflow_dispatch` |

</details>

<h3 align="center">Scientific Calculator &amp; Mathematical Visualization Platform</h3>

<p align="center">
  47 pages &middot; 8 languages &middot; GPU-accelerated WebGL / WebGPU &middot; Edge computing
</p>

<p align="center">
  <a href="https://nextcalc.io"><strong>Live Demo</strong></a> &nbsp;&middot;&nbsp;
  <a href="#-quick-start">Quick Start</a> &nbsp;&middot;&nbsp;
  <a href="https://github.com/ABCrimson/NextCalc/wiki">Wiki</a> &nbsp;&middot;&nbsp;
  <a href="docs/ROADMAP.md">Roadmap</a>
</p>

<br />

---

## Highlights

<table>
<tr>
<td width="33%" valign="top">

**Scientific Calculator**
Full-featured calculator with expression history, LaTeX rendering, keyboard shortcuts, and statistical analysis panel.

</td>
<td width="33%" valign="top">

**2D / 3D Plotting**
GPU-accelerated function plotting with WebGL 2D, Three.js 3D surfaces, adaptive sampling, 6 colormaps, SSAO, and HDR cubemap themes.

</td>
<td width="33%" valign="top">

**Symbolic Math**
Computer algebra system with symbolic differentiation, integration (15+ rules), Taylor series, limits, and equation solving.

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Algorithm Visualizations**
Interactive demos for Transformers, Zero-Knowledge Proofs, Quantum Computing, PageRank, Meta-Learning, and graph algorithms.

</td>
<td width="33%" valign="top">

**Edge Workers**
3 Cloudflare Workers for sub-50ms global symbolic math, LaTeX-to-PDF export, and rate limiting with KV storage.

</td>
<td width="33%" valign="top">

**8 Languages**
Full i18n with 1200+ keys per locale: English, Russian, Spanish, Ukrainian, German, French, Japanese, Chinese.

</td>
</tr>
</table>

---

## Architecture

```mermaid
graph TB
    subgraph Client["Browser"]
        A["Next.js 16 + React 19.3<br/>Tailwind CSS 4 + Radix UI"]
    end

    subgraph Vercel["Vercel Edge Network"]
        B["App Router + SSR"]
        C["GraphQL API<br/>Apollo Server 5.4"]
    end

    subgraph Cloudflare["Cloudflare Workers"]
        D["CAS Service<br/>Symbolic Math"]
        E["Export Service<br/>LaTeX to PDF / PNG / SVG"]
        F["Rate Limiter<br/>KV-backed"]
    end

    subgraph Storage["Storage Layer"]
        G[("Neon PostgreSQL<br/>Prisma 7")]
        H[("Upstash Redis<br/>Cache + PubSub")]
        I[("R2 Bucket<br/>Exports")]
        J[("KV Store<br/>Rate Limits")]
    end

    A --> B
    A --> D
    A --> E
    B --> C
    C --> G
    C --> H
    D --> F
    E --> I
    F --> J
```

---

## Tech Stack

| Category | Technology | Version |
|:---------|:-----------|:--------|
| Language | TypeScript | 6.0 |
| Framework | Next.js | 16.2 |
| UI Library | React | 19.3 |
| Styling | Tailwind CSS | 4.2 |
| Components | Radix UI (unified) | 1.4 |
| Animation | Framer Motion | 12.34 |
| State | Zustand | 5.0 |
| Math | Math.js | 15.2 |
| 3D Rendering | Three.js | 0.183 |
| 2D Charts | D3.js | 7.9 |
| LaTeX | KaTeX | 0.16 |
| ORM | Prisma | 7.5 |
| Auth | NextAuth + jose | 5.0 / 6.1 |
| GraphQL | Apollo Server / Client | 5.4 / 4.2 |
| Cache | Upstash Redis | 1.37 |
| Workers | Hono on Cloudflare | 4.12 |
| Build | Turborepo | 2.8 |
| Linting | Biome | 2.5 |
| Testing | Vitest + Playwright | 4.1 |

---

## Project Structure

```
NextCalc/
├── apps/
│   ├── web/                   # Next.js 16 frontend (port 3005)
│   ├── api/                   # GraphQL API (Apollo Server 5.4)
│   └── workers/               # Cloudflare Workers
│       ├── cas-service/       #   Symbolic math on the edge
│       ├── export-service/    #   LaTeX to PDF/PNG/SVG export
│       └── rate-limiter/      #   API rate limiting via KV
├── packages/
│   ├── math-engine/           # Core math library (18 modules)
│   ├── plot-engine/           # GPU visualization engine
│   ├── database/              # Prisma 7 shared package
│   └── types/                 # Shared TypeScript types
└── docs/                      # Documentation
```

<details>
<summary><strong>apps/web</strong> — 47 page routes</summary>

```
app/[locale]/
├── algorithms/           # Algorithm hub + 10 sub-pages
│   ├── astar/            #   A* pathfinding
│   ├── crypto/           #   Cryptography (ZKP, differential privacy)
│   ├── dijkstra/         #   Dijkstra's shortest path
│   ├── graph-traversal/  #   BFS / DFS
│   ├── graphs/           #   Graph theory intro
│   ├── meta-learning/    #   MAML playground
│   ├── mst/              #   Minimum spanning tree
│   ├── pagerank/         #   PageRank with 3D spheres
│   ├── quantum/          #   Quantum computing sim
│   ├── transformers/     #   Transformer attention
│   └── zero-knowledge/   #   Zero-knowledge proofs
├── auth/signin/          # OAuth sign-in (GitHub, Google)
├── chaos/                # Lorenz attractor + bifurcation (WebGPU)
├── complex/              # Complex number operations
├── forum/                # Community forum with GraphQL
├── fourier/              # Fourier analysis
├── game-theory/          # Nash equilibrium solver
├── graphs-full/          # Full graph algorithm suite
├── learn/                # Interactive learning platform
├── matrix/               # Matrix operations
├── ml-algorithms/        # ML algorithm demos
├── pde/                  # PDE solver (heat, wave, Laplace)
├── plot/                 # 2D/3D function plotter
├── practice/             # Practice problems
├── problems/             # Problem browser + number theory
├── profile/              # User profile
├── settings/             # User settings
├── solver/               # Equation + ODE solver
├── stats/                # Statistics calculator
├── symbolic/taylor/      # Taylor series expansion
├── units/                # Unit converter
└── worksheet/            # Jupyter-like worksheet
```

</details>

<details>
<summary><strong>packages/math-engine</strong> — 18 modules</summary>

| Module | Description |
|:-------|:------------|
| `parser/` | Expression parser + evaluator |
| `symbolic/` | Differentiation, integration, simplification, series, limits |
| `cas/` | Computer algebra system |
| `matrix/` | Matrix operations, eigenvalues, decompositions |
| `stats/` | Statistics, distributions, regression |
| `number-theory/` | Primes, modular arithmetic, factorization |
| `graph-theory/` | Graph algorithms (Dijkstra, BFS, DFS, MST, PageRank) |
| `game-theory/` | Nash equilibrium, dominant strategies |
| `prover/` | Logic core + proof search |
| `calculus/` | Vector calculus, line/surface integrals |
| `algorithms/` | Sorting, searching, crypto, ML |

</details>

<details>
<summary><strong>packages/plot-engine</strong> — GPU rendering pipeline</summary>

- **WebGL 2D Renderer** — primary 2D backend with GLSL shaders
- **Three.js 3D Renderer** — surface plots, parametric curves, SSAO, HDR cubemaps
- **WebGPU Compute** — PDE/ODE solvers, bifurcation diagrams
- **Canvas 2D Fallback** — software renderer for legacy browsers
- **6 Colormaps** — viridis, inferno, coolwarm, cividis, magma, spectral

</details>

---

## Quick Start

```bash
git clone https://github.com/ABCrimson/NextCalc.git
cd NextCalc
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your credentials (see docs/SETUP.md)
pnpm dev
# Open http://localhost:3005
```

> **Prerequisites**: Node.js >= 20.0.0, pnpm >= 11

---

## Documentation

| Document | Description |
|:---------|:------------|
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | Developer guide, commands, and conventions |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture and design decisions |
| **[docs/SETUP.md](docs/SETUP.md)** | Database (Neon) and OAuth (Google, GitHub) setup |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Deployment guide for Vercel and Cloudflare |
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Feature roadmap and backlog |
| **[CHANGELOG.md](CHANGELOG.md)** | Version history |
| **[Wiki](https://github.com/ABCrimson/NextCalc/wiki)** | Full reference: API, math engine, database schema |

---

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

---

## License

[MIT](LICENSE) &copy; 2025-2026 Albert Badalov
