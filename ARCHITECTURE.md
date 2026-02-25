# NextCalc Pro - Architecture

## High-Level Architecture

```
                        +-----------------------+
                        |    Browser Client      |
                        |  (Next.js 16 + React)  |
                        +----------+------------+
                                   |
                    +--------------+--------------+
                    |              |              |
               +----v----+  +-----v-----+  +-----v-----+
               |  Vercel  |  | Cloudflare |  | Cloudflare |
               | Next.js  |  | Workers    |  | Workers    |
               | App      |  | (CAS,      |  | (Rate      |
               | + API    |  |  Export)    |  |  Limiter)  |
               +----+-----+  +-----+------+  +-----+------+
                    |               |               |
               +----v-----+   +----v----+     +----v----+
               |  Neon     |   |  R2     |     |  KV     |
               | PostgreSQL|   | Bucket  |     | Store   |
               +----+------+   +---------+     +---------+
                    |
               +----v------+
               | Upstash   |
               | Redis     |
               +-----------+
```

## Package Dependency Graph

```
@nextcalc/web
  ├── @nextcalc/math-engine
  ├── @nextcalc/plot-engine
  │     └── @nextcalc/math-engine
  ├── @nextcalc/database
  ├── @nextcalc/api
  │     └── @nextcalc/database
  └── @nextcalc/types

@nextcalc/cas-service     (standalone, uses mathjs directly)
@nextcalc/export-service  (standalone, uses mathjax)
@nextcalc/rate-limiter    (standalone, uses Cloudflare KV)
```

Build order enforced by Turborepo:

1. `@nextcalc/types` (no deps)
2. `@nextcalc/math-engine` (depends on mathjs)
3. `@nextcalc/database` (depends on Prisma + Neon adapter)
4. `@nextcalc/plot-engine` (depends on math-engine, Three.js, D3)
5. `@nextcalc/api` (depends on database)
6. `@nextcalc/web` (depends on all above)

## Package Descriptions

### @nextcalc/math-engine

Core mathematical computation library with subpath exports.

| Module | Description | Key Exports |
|--------|-------------|-------------|
| `parser/` | Expression tokenizer and AST builder | `tokenize()`, `parse()`, AST node types |
| `symbolic/` | Symbolic differentiation and integration | `differentiate()`, `integrate()` |
| `matrix/` | Linear algebra operations | `multiply()`, `inverse()`, `eigenvalues()` |
| `solver/` | Equation solving (algebraic + ODE) | `solve()`, `solveODE()` |
| `stats/` | Statistical functions | `mean()`, `stdev()`, `regression()` |
| `units/` | Unit conversion engine | `convert()`, unit definitions |
| `complex/` | Complex number arithmetic | `Complex` class, operations |
| `algorithms/` | Algorithm implementations | graph theory, game theory |
| `fourier/` | FFT, spectral analysis, Fourier series | `fft()`, `ifft()`, `fourierSeries()` |
| `calculus/` | Calculus operations | Taylor series, limits |
| `cas/` | Computer algebra system core | expression simplification |
| `differential/` | Differential equations | ODE/PDE support |
| `knowledge/` | Mathematical knowledge base | formulas, theorems |
| `problems/` | Problem generation | practice problem sets |
| `prover/` | Mathematical proof engine | proof steps, verification |
| `content/` | Educational content | lessons, explanations |
| `wasm/` | WASM arbitrary precision (scaffolded) | `getWASMManager()` (mock fallback) |

**Tech:** Math.js 15.1.1, TypeScript 6.0, Vitest

### @nextcalc/plot-engine

GPU-accelerated mathematical visualization engine.

| Module | Description |
|--------|-------------|
| `renderers/` | WebGL 2D renderer (<15KB), Three.js 3D renderer (lazy-loaded) |
| `sampling/` | Adaptive function sampling with recursive subdivision |
| `controls/` | Interactive pan, zoom, rotate (mouse, touch, keyboard) |
| `export/` | PNG, SVG, CSV export |
| `types/` | Plot configuration types |

**Tech:** Three.js 0.183.1, D3 7.9.0, WebGL 2, WebGPU (progressive enhancement)

### @nextcalc/database

Shared Prisma 7 database package.

- **Schema:** `packages/database/prisma/schema.prisma` (single source of truth)
- **Config:** `packages/database/prisma.config.ts` (loads env from `apps/web/.env.local` via dotenv)
- **Client:** `packages/database/src/client.ts` (Neon serverless adapter singleton)
- **Generated:** `packages/database/src/generated/prisma/` (gitignored, regenerated on postinstall)

**Tables:** users, accounts, sessions, worksheets, folders, forum_posts, comments, upvotes, audit_logs

**Tech:** Prisma 7.5.0-dev.15, @neondatabase/serverless 1.0.2, @prisma/adapter-neon

### @nextcalc/api

GraphQL API integrated into the Next.js app via route handler.

| Directory | Description |
|-----------|-------------|
| `src/graphql/` | Schema definition, resolvers |
| `src/lib/` | Context, DataLoaders, error handling, validation, subscriptions |

**Key features:**
- Auth is configurable via `setAuthFunction()` -- real NextAuth injected from the web route handler
- DataLoaders for N+1 prevention (userById, folderById, worksheetSharesByWorksheetId, etc.)
- Resolvers: user, worksheet, folder, calculation, forum, comment, upvote
- Upstash Redis caching in `src/lib/cache.ts`
- API package exports source `.ts` files (not dist/) for monorepo dev

**Tech:** Apollo Server 5.4.0, GraphQL 16.12.0, DataLoader 2.2.3, Zod

### @nextcalc/types

Shared TypeScript type definitions used across the monorepo.

**Exports:** `Calculation`, `HistoryEntry`, and other shared interfaces.

### Cloudflare Workers

Three edge microservices deployed to Cloudflare's global network:

| Worker | Purpose | Port (dev) | Bindings |
|--------|---------|-----------|----------|
| cas-service | Symbolic math (solve, differentiate, integrate) | 8787 | -- |
| export-service | LaTeX to PDF/PNG/SVG conversion | 8788 | R2 bucket |
| rate-limiter | API quota enforcement (sliding window) | 8789 | KV namespace |

**Tech:** Hono 4.12.2, Wrangler 4.67.0, Zod

## Data Flow

### Client-Side Calculation

```
User Input -> Calculator Component -> Math Engine (client-side)
                                        |
                                        v
                                   Display Result
                                        |
                                        v
                              Save to History (Zustand store)
                                        |
                                        v (if authenticated)
                              GraphQL Mutation -> Prisma -> Neon PostgreSQL
```

### Server-Side (GraphQL)

```
Apollo Client -> Next.js API Route (/api/graphql)
                    |
                    v
               Apollo Server
                    |
                    v
               Auth Check (NextAuth session)
                    |
                    v
               DataLoaders (batch + cache)
                    |
                    v
               Prisma Client -> Neon PostgreSQL
```

### Edge Worker Flow

```
Client -> Cloudflare Worker (global edge)
              |
              v
         Rate Limit Check (KV)
              |
              v
         Process Request (CAS / Export)
              |
              v (if export)
         Store to R2 -> Return URL
```

## Authentication Flow

```
1. User clicks "Sign in with Google/GitHub"
2. NextAuth redirects to OAuth provider
3. Provider redirects back to /api/auth/callback/[provider]
4. NextAuth creates/updates User + Account in database
5. JWT session token set as HTTP-only cookie
6. Subsequent requests include session automatically
7. API resolvers check session via auth() function
```

**Providers:** Google OAuth 2.0, GitHub OAuth
**Strategy:** JWT (stateless, 30-day expiry)
**Adapter:** @auth/prisma-adapter for database persistence
**Important:** Only providers with configured credentials are registered (conditional push in `auth.config.ts`)

## Styling System

### OKLCH Color Architecture

Colors are defined in `apps/web/app/globals.css` using the OKLCH color space (P3 gamut, perceptually uniform):

```css
@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0.006 286.029);
  /* ... */
}
```

### Design System Layers

1. **CSS Custom Properties** -- OKLCH color tokens in `globals.css`
2. **Tailwind 4** -- CSS-first config via `@theme` directive (no `tailwind.config.ts` for colors)
3. **Semantic Tokens** -- `bg-background`, `text-foreground`, `border-border` etc.
4. **Glass Morphism** -- `oklch()` + `backdrop-filter` + SVG noise texture
5. **Modern CSS** -- nesting, `@property`, `color-mix()`, `@starting-style`, `interpolate-size`

### Component Library

- **shadcn/ui** -- CLI-installed components (not npm package), stored in `apps/web/components/ui/`
- **Radix UI** -- Unified `radix-ui@1.4.4-rc` package (replaces individual `@radix-ui/*` packages)
- **Framer Motion** -- Layout animations, `prefers-reduced-motion` support

## State Management

- **Zustand 5.0.11** -- Global state with immer middleware for calculator, worksheets, collaboration
- **React 19 cache** -- Server-side caching for data fetching
- **Apollo Client** -- GraphQL cache for server data

```typescript
// Store pattern
export const useStore = create<State>()(
  immer((set) => ({
    value: 0,
    setValue: (v) => set((s) => { s.value = v; }),
  }))
);
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Monorepo (pnpm + Turborepo) | Shared types, coordinated builds, single version control |
| Next.js App Router | Server Components, streaming, nested layouts |
| OKLCH colors | Perceptually uniform, P3 gamut, better than HSL for design |
| Prisma in shared package | Single schema, reusable across web and API |
| Apollo over tRPC | Schema-first API, subscriptions, DataLoader integration |
| Edge Workers for CAS | Sub-50ms global latency for symbolic math |
| WebGL/WebGPU rendering | GPU acceleration for real-time mathematical visualization |
| Zustand over Redux | Simpler API, TypeScript-first, no boilerplate |
| Biome over ESLint+Prettier | Faster linting, single tool for format+lint |

## File Conventions

| Pattern | Purpose |
|---------|---------|
| `app/**/page.tsx` | Route pages |
| `app/**/layout.tsx` | Layouts |
| `app/**/loading.tsx` | Loading UI (Suspense) |
| `app/**/error.tsx` | Error boundary |
| `app/**/not-found.tsx` | 404 page |
| `components/ui/*.tsx` | shadcn/ui components |
| `components/calculator/*.tsx` | Calculator feature components |
| `components/plots/*.tsx` | Plot visualization components |
| `lib/stores/*.ts` | Zustand stores |
| `lib/hooks/*.ts` | Custom React hooks |
| `lib/workers/*.ts` | Web Worker scripts |

## Performance Targets

| Metric | Target |
|--------|--------|
| Dev hot reload | <500ms |
| Production build (cached) | <1s |
| Initial page load | <1.5s |
| Animation FPS | 60 |
| 2D plot render (10k pts) | 60fps |
| 3D plot render | 45fps |
| API latency (p95) | <200ms |
| Database query (p95) | <50ms |

## Accessibility

- WCAG 2.2 AA/AAA compliance target
- Keyboard navigation throughout
- Screen reader support with ARIA labels
- `prefers-reduced-motion` support
- High contrast mode support
- Focus-visible outlines (not focus outlines)
