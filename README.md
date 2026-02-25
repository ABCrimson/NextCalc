# NextCalc Pro

A comprehensive scientific calculator and mathematical visualization platform built as a monorepo with Next.js 16, React 19, and TypeScript 6.

NextCalc Pro provides a full-featured calculator with history, 2D/3D plotting, symbolic math, matrix operations, equation solving, statistics, unit conversion, Fourier analysis, PDE solving, game theory, chaos theory, graph algorithms, ML algorithm visualizations, and more -- all rendered with GPU-accelerated WebGL and WebGPU.

## Quick Start

```bash
git clone https://github.com/your-org/nextcalc-pro.git
cd nextcalc-pro
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your credentials (see docs/SETUP.md)
pnpm dev
# Open http://localhost:3005
```

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | 6.0.0-dev.20260223 |
| Framework | Next.js | 16.2.0-canary.56 |
| UI Library | React | 19.3.0-canary |
| Styling | Tailwind CSS | 4.2.1 |
| Components | Radix UI (unified) | 1.4.4-rc |
| Animation | Framer Motion | 12.34.3 |
| State | Zustand | 5.0.11 |
| Math | Math.js | 15.1.1 |
| 3D | Three.js | 0.183.1 |
| 2D Charts | D3.js | 7.9.0 |
| LaTeX | KaTeX | 0.16.28 |
| ORM | Prisma | 7.5.0-dev.15 |
| Auth | NextAuth | 5.0.0-beta.30 |
| GraphQL | Apollo Server / Client | 5.4.0 / 4.2.0-alpha.0 |
| Cache | Upstash Redis | 1.37.0-rc.12 |
| Workers | Hono on Cloudflare | 4.12.2 |
| Build | Turborepo | 2.8.10 |
| Linting | Biome | 2.4.4 |
| Testing | Vitest + Playwright | 4.1.0-beta.4 |

## Project Structure

```
NextCalc/
├── apps/
│   ├── web/                   # Next.js 16 frontend (port 3005)
│   │   ├── app/               # App Router pages
│   │   │   ├── algorithms/    # Algorithm visualizations (Transformer, ZKP, Quantum, PageRank, MAML)
│   │   │   ├── chaos/         # Chaos theory (Lorenz attractor, bifurcation)
│   │   │   ├── complex/       # Complex number operations
│   │   │   ├── fourier/       # Fourier analysis
│   │   │   ├── game-theory/   # Game theory solver
│   │   │   ├── graphs-full/   # Graph algorithm visualizations
│   │   │   ├── learn/         # Learning platform
│   │   │   ├── matrix/        # Matrix operations
│   │   │   ├── ml-algorithms/ # ML algorithm demos
│   │   │   ├── pde/           # PDE solver (heat, wave, Laplace)
│   │   │   ├── plot/          # 2D/3D function plotter
│   │   │   ├── practice/      # Practice problems
│   │   │   ├── problems/      # Problem browser (number theory, etc.)
│   │   │   ├── solver/        # Equation solver (algebraic, ODE)
│   │   │   ├── stats/         # Statistics calculator
│   │   │   ├── symbolic/      # Symbolic math (differentiation, integration)
│   │   │   ├── units/         # Unit converter
│   │   │   └── worksheet/     # Jupyter-like worksheet
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities, stores, hooks
│   ├── api/                   # GraphQL API (Apollo Server 5.4)
│   └── workers/               # Cloudflare Workers
│       ├── cas-service/       # Symbolic math on the edge
│       ├── export-service/    # LaTeX to PDF/PNG/SVG export
│       └── rate-limiter/      # API rate limiting via KV
├── packages/
│   ├── math-engine/           # Core math library (@nextcalc/math-engine)
│   ├── plot-engine/           # GPU visualization engine (@nextcalc/plot-engine)
│   ├── database/              # Prisma 7 shared package (@nextcalc/database)
│   └── types/                 # Shared TypeScript types (@nextcalc/types)
└── docs/                      # Documentation
    ├── SETUP.md               # Database and OAuth setup
    ├── DEPLOYMENT.md          # Deployment guide (Vercel, Cloudflare)
    └── ROADMAP.md             # Feature roadmap and backlog
```

## Documentation

| File | Description |
|------|-------------|
| [README.md](./README.md) | Project overview and quick start |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Developer guide, commands, and conventions |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and design decisions |
| [docs/SETUP.md](./docs/SETUP.md) | Database (Neon) and OAuth (Google, GitHub) setup |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Deployment guide for Vercel and Cloudflare |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Feature roadmap, backlog, and TODO list |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |

## License

MIT
