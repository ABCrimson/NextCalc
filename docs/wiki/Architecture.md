# Architecture

## High-Level Overview

```
Browser Client (Next.js 16 + React 19.3)
    |
    +-- Vercel Edge Network
    |     +-- App Router + SSR
    |     +-- GraphQL API (Apollo Server 5.4)
    |           +-- Neon PostgreSQL (Prisma 7)
    |           +-- Upstash Redis (cache + PubSub)
    |
    +-- Cloudflare Workers
          +-- CAS Service (symbolic math)
          +-- Export Service (LaTeX to PDF/PNG/SVG) --> R2 Bucket
          +-- Rate Limiter --> KV Store
```

## Package Dependency Graph

```
@nextcalc/web
  +-- @nextcalc/math-engine
  +-- @nextcalc/plot-engine
  |     +-- @nextcalc/math-engine
  +-- @nextcalc/database
  +-- @nextcalc/api
  |     +-- @nextcalc/database
  +-- @nextcalc/types

@nextcalc/cas-service     (standalone, uses mathjs)
@nextcalc/export-service  (standalone, uses mathjax)
@nextcalc/rate-limiter    (standalone, uses Cloudflare KV)
```

**Build order** (enforced by Turborepo):

1. `@nextcalc/types` (no deps)
2. `@nextcalc/math-engine` (depends on mathjs)
3. `@nextcalc/database` (depends on Prisma + Neon adapter)
4. `@nextcalc/plot-engine` (depends on math-engine, Three.js, D3)
5. `@nextcalc/api` (depends on database)
6. `@nextcalc/web` (depends on all above)

## Data Flow

### Client-Side Calculation

```
User Input --> Calculator Component --> Math Engine (client-side)
    --> Display Result --> Save to History (Zustand)
    --> (if authenticated) GraphQL Mutation --> Prisma --> Neon PostgreSQL
```

### Server-Side (GraphQL)

```
Apollo Client --> /api/graphql route --> Apollo Server
    --> Auth Check (NextAuth session)
    --> DataLoaders (batch + cache)
    --> Prisma Client --> Neon PostgreSQL
```

### Edge Worker Flow

```
Client --> Cloudflare Worker --> Rate Limit Check (KV)
    --> Process Request (CAS / Export)
    --> (if export) Store to R2 --> Return URL
```

## Key Design Decisions

| Decision | Rationale |
|:---------|:----------|
| Monorepo (pnpm + Turborepo) | Shared types, coordinated builds |
| Next.js App Router | Server Components, streaming, nested layouts |
| OKLCH colors | Perceptually uniform, P3 gamut |
| Prisma in shared package | Single schema, reusable across web and API |
| Apollo over tRPC | Schema-first, subscriptions, DataLoader integration |
| Edge Workers for CAS | Sub-50ms global latency |
| WebGL/WebGPU rendering | GPU acceleration for real-time visualization |
| Zustand over Redux | Simpler API, TypeScript-first |
| Biome over ESLint+Prettier | Faster, single tool |

## Styling System

- **OKLCH** color tokens in `apps/web/app/globals.css`
- **Tailwind 4** CSS-first config via `@theme` directive
- **Semantic tokens**: `bg-background`, `text-foreground`, `border-border`
- **Glass morphism**: `oklch()` + `backdrop-filter` + SVG noise texture
- **Modern CSS**: nesting, `@property`, `color-mix()`, `@starting-style`

## Internationalization

- **Library**: `next-intl` with App Router
- **Locales**: en, ru, es, uk, de, fr, ja, zh (8 languages)
- **Translation files**: `apps/web/messages/{locale}.json` (1200+ keys per locale)
- **Routing**: `[locale]` dynamic segment (e.g., `/en/plot`, `/ru/matrix`)
