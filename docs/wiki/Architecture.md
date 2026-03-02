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

## DataLoader Pattern

All GraphQL resolvers use [DataLoader](https://github.com/graphql/dataloader) to prevent N+1 query problems. DataLoader instances are created per-request in the Apollo Server context and batch database calls within a single event loop tick.

**Location**: `apps/api/src/lib/dataloaders.ts`

| DataLoader | Batches | Used by |
|:-----------|:--------|:--------|
| `userById` | `User` lookups by ID | Worksheet, ForumPost, Comment resolvers |
| `folderById` | `Folder` lookups by ID | Worksheet resolver |
| `worksheetSharesByWorksheetId` | Share records per worksheet | Worksheet resolver |
| `childFoldersByParentId` | Child folders per parent | Folder resolver |
| `upvoteCountByTargetId` | Upvote counts per target | ForumPost, Comment resolvers |

**How it works**: When resolving a list of forum posts, instead of issuing one `SELECT * FROM users WHERE id = ?` per post, DataLoader collects all user IDs and issues a single `SELECT * FROM users WHERE id IN (?, ?, ...)` query.

## Security Considerations

### IDOR Protection

All mutations that modify user-owned resources validate ownership before proceeding. For example, `updateWorksheet` and `deleteWorksheet` verify that the authenticated user's `userId` matches the worksheet's `userId`. Admin users can bypass this check for moderation.

**Affected resolvers**: worksheet, folder, forum post, comment, profile.

### JWT Verification

WebSocket subscriptions authenticate via JWT tokens passed in the connection `connectionParams`. The token is verified using `jose.jwtVerify()` with the `NEXTAUTH_SECRET` key, ensuring subscriptions cannot be opened without a valid session.

### Rate Limiter Security

The Cloudflare rate-limiter Worker uses timing-safe comparison (`crypto.subtle.timingSafeEqual`) for API key validation, preventing timing-based side-channel attacks on the shared secret.

## Prisma 7.5 Adapter Pattern

The database package uses Prisma 7.5.0-dev.33's Neon serverless adapter. The adapter constructor takes a **config object**, not a Pool instance:

```typescript
// Correct
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

// Wrong -- causes "No database host or connection string" errors
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
```

Prisma 7 creates its own connection pool internally via the adapter's `connect()` method.

### Schema Features (7.3+)

| Feature | Since | Description |
|:--------|:------|:------------|
| `compilerBuild = "fast"` | 7.3 | Speed-optimized query compiler (larger footprint, ideal for Node.js) |
| `partialIndexes` preview | 7.4 | Filtered indexes with `WHERE` conditions for smaller, faster lookups |
| Query plan caching | 7.4 | LRU cache for compiled query plans (~100% hit rate for repeated shapes) |
| BigInt precision in JSON | 7.3 | BigInt values cast to text inside JSON aggregation with `relationJoins` |

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
