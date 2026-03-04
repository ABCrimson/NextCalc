# NextCalc Pro - Roadmap

## Completed Features (verified in codebase)

### Core Calculator (`apps/web/app/[locale]/page.tsx`)
- [x] Basic and scientific operations
- [x] Calculation history with Zustand persistence
- [x] Keyboard shortcuts
- [x] LaTeX rendering via KaTeX
- [x] Share button component
- [x] Dark mode toggle -- cookie-based server-side theme persistence, no flash of wrong theme

### Math Engine (`packages/math-engine/`)
- [x] Expression parser with tokenizer and AST (`src/parser/`)
- [x] Symbolic differentiation and integration (`src/symbolic/`)
- [x] Matrix operations and linear algebra (`src/matrix/`)
- [x] Equation solver -- algebraic and ODE (`src/solver/`)
- [x] Statistics functions (`src/stats/`)
- [x] Unit conversion engine (`src/units/`)
- [x] Complex number arithmetic (`src/complex/`)
- [x] Fourier analysis -- FFT, IFFT, spectral analysis, Fourier series (`src/fourier/`)
- [x] Graph theory -- MST, topological sort, SCC, coloring, max flow, TSP, cycle detection (`src/graph-theory/`)
- [x] Algorithm implementations -- ML, crypto, quantum, graph, optimization (`src/algorithms/`)
- [x] Calculus operations (`src/calculus/`)
- [x] CAS core (`src/cas/`)
- [x] Differential equations (`src/differential/`)
- [x] Knowledge base (`src/knowledge/`)
- [x] Problem generation (`src/problems/`)
- [x] Mathematical prover (`src/prover/`)
- [x] Educational content (`src/content/`)
- [x] WASM scaffolding with mock fallback (`src/wasm/`)

### Visualization (`packages/plot-engine/`)
- [x] WebGL 2D renderer with adaptive sampling
- [x] Three.js 3D surface/parametric renderer (lazy-loaded)
- [x] HDR procedural cubemap with starfield (5 themes)
- [x] SSAO post-processing (GTAONode)
- [x] Interactive controls (pan, zoom, rotate)
- [x] Export (PNG, SVG, CSV)
- [x] 5 colormaps (viridis, inferno, coolwarm, cividis, magma, spectral)

### Web App Pages (all in `apps/web/app/[locale]/`)
- [x] Calculator home page (`/`)
- [x] 2D/3D function plotter (`/plot`)
- [x] Symbolic math -- differentiation and integration (`/symbolic`)
- [x] Matrix operations (`/matrix`)
- [x] Equation solver -- algebraic (`/solver`)
- [x] ODE solver with GPU direction field (`/solver/ode`)
- [x] Unit converter (`/units`)
- [x] Statistics calculator (`/stats`)
- [x] Complex numbers (`/complex`)
- [x] Fourier analysis (`/fourier`)
- [x] PDE solver -- heat, wave, Laplace with WebGPU compute (`/pde`)
- [x] Game theory (`/game-theory`)
- [x] Chaos theory -- Lorenz attractor, bifurcation diagrams (`/chaos`)
- [x] Graph algorithms (`/graphs-full`)
- [x] Algorithm visualizations -- Transformer, ZKP, Quantum, PageRank, MAML (`/algorithms`)
- [x] ML algorithm demos (`/ml-algorithms`)
- [x] Worksheet (Jupyter-like) (`/worksheet`)
- [x] Forum (basic) (`/forum`)
- [x] Learning platform (`/learn`)
- [x] Practice problems (`/practice`)
- [x] Problem browser with number theory (`/problems`)
- [x] Settings page (`/settings`)
- [x] Sign-in page (`/auth/signin`)

### Backend Infrastructure
- [x] GraphQL API with Apollo Server 5.4 + jose 6.1 JWT verification (`apps/api/`)
- [x] Prisma 7 shared database package (`packages/database/`)
- [x] NextAuth v5 with Google + GitHub OAuth
- [x] Upstash Redis integration (caching + rate limiting)
- [x] Apollo Client integration in web app
- [x] DataLoaders for N+1 query prevention
- [x] Full resolver set (user, worksheet, folder, calculation, forum, comment, upvote)
- [x] Cursor pagination (Relay-style connections)
- [x] Custom error classes (AuthenticationError, ForbiddenError, NotFoundError, ValidationError)
- [x] IDOR protection on profile and worksheet resolvers
- [x] Zod input validation on all mutations
- [x] Atomic view counters (forum posts, worksheets)
- [x] Configurable rate limiting (RATE_LIMIT_AUTH / RATE_LIMIT_ANON env vars)

### Cloudflare Workers (`apps/workers/`)
- [x] CAS Service -- symbolic math on the edge (Hono + mathjs)
- [x] Export Service -- LaTeX to PDF/PNG/SVG (Hono + MathJax)
- [x] Rate Limiter -- sliding window via Cloudflare KV

### WebGPU Features
- [x] GPU compute PDE solver (heat/wave/Laplace FTCS stencils, ping-pong buffers)
- [x] GPU direction field for ODE solver (compute + instanced arrows)
- [x] GPU sieve compute for number theory (compute shader, instanced cells)
- [x] Lorenz GPU particle field following attractor trajectory
- [x] Bifurcation diagram with cubic, Gauss, circle maps
- [x] Procedural space cubemap themes (5 variants)

### Infrastructure
- [x] CI/CD pipeline (GitHub Actions) -- multi-job CI + worker deploy workflow
- [x] Structured JSON logging across API and web app
- [x] Apollo Server request/error logging plugin
- [x] Next.js instrumentation hooks (register + onRequestError)
- [x] Sentry stub configs (activate with DSN + @sentry/nextjs)
- [x] Content Security Policy (CSP) headers -- Nosecone with nonces, HSTS, permissions policy
- [x] Rate limiter wired to GraphQL SSE stream endpoint
- [x] `next-intl` configured with 1274 translation keys across 40+ pages (en, ru, es, uk, de, fr, ja, zh)
- [x] Vercel Analytics + Speed Insights
- [x] Dependabot for dependency vulnerability scanning
- [x] Bookmarks store (Zustand + localStorage persistence)
- [x] Comprehensive security audit with IDOR, JWT, and XSS fixes (March 2026)
- [x] Performance audit: BigInt math, iterative DFS, lazy loading, stack overflow prevention

---

## Recently Completed

### Math Engine Completeness (all done)
- [x] General variable exponent differentiation (f^g) -- logarithmic differentiation
- [x] Unary minus parser fix
- [x] Partial fraction decomposition -- real/complex pole handling
- [x] Series expansion for limits -- ratio/root/comparison tests
- [x] Bernoulli numbers for exact Taylor coefficients
- [x] LaTeX AST serialization
- [x] Logic formula parser (AND, OR, NOT, IMPLIES)
- [x] CAS pattern matching with recursive simplifyChildren
- [x] Proof search (BFS, DFS, iterative deepening)

### v1.1.3 -- Codebase Audit (March 2026)
- [x] Comprehensive codebase audit -- performance (DataLoaders, lazy KaTeX, typed arrays), security (timing-safe comparison, CORS hardening, query complexity), and code quality (50+ type fixes, exactOptionalPropertyTypes compliance)

### Feature Integration (all done)
- [x] Calculation sharing backend -- short code generation + /share/[code] pages
- [x] Export to PDF/LaTeX -- export menu wired to export-service Worker
- [x] Thousands separator formatting -- Zustand store + Intl.NumberFormat
- [x] Sentry observability -- client/server configs, instrumentation, global error handler
- [x] CAS solver rewrite -- polynomial root finding with Durand-Kerner method
- [x] AI-generated translations for ru, es, uk, de, fr, ja, zh (1200+ keys each)
- [x] User profile dashboard -- edit dialog, stats grid, activity feed, quick actions
- [x] Variable sliders (Desmos-style) -- interactive parameter sliders on plots
- [x] Formula library -- 70+ formulas across 7 categories, search/filter, KaTeX rendering
- [x] Calculation templates -- 20 interactive templates across 5 categories
- [x] Learning bookmarks -- topic cards with bookmark toggle

---

## Remaining Work

### Phase 1: Data Persistence & Grading (all done)

- [x] Worksheet DB persistence -- save/load/delete server actions with autosave + version conflict detection
- [x] Problem submission & grading -- test case validation, hint deduction, attempt recording, topic progress
- [x] Practice metrics persistence -- session tracking, per-attempt saving, completion finalization

### Phase 2: Visualization & UX Polish

- [x] Graph annotations -- text labels + arrow annotations with placement toolbar
- [x] Polar plot drag-to-pan -- center offset added to Plot2DPolarConfig
- [x] Tree/graph visualization renderers -- SVG-based binary tree + circular graph layouts
- [x] Step-by-step solutions expansion -- SymbolicPanel with Show Steps toggle, category badges, collapsible cards
- [x] KaTeX rendering -- MathRenderer component with MathML accessibility, display/inline modes
- [x] My Worksheets listing page -- grid/list view with search, sort, and delete

### Phase 3: Testing & Quality

- [x] Playwright E2E tests -- 27 spec files covering calculator, navigation, plots, accessibility, forum, solver, stats, units, matrix, symbolic, mobile, settings
- [x] Expand math-engine tests for untested modules -- 296 new tests across 5 modules

### Phase 4: Deployment

- [x] Set up Neon production database -- schema pushed to ep-cool-dew-aex6zq7t (US East 2)
- [x] Configure production environment variables on Vercel -- DATABASE_URL, OAuth, Redis, AUTH_SECRET, NEXTAUTH_URL
- [x] Deploy web app to Vercel -- live at https://nextcalc.io
- [x] Create Cloudflare R2 buckets -- 4 buckets (public/private + dev) in ENAM region
- [x] Register workers.dev subdomain (albert-r-badalov.workers.dev)
- [x] Set ADMIN_KEY secret via `wrangler secret put ADMIN_KEY`
- [x] Deploy 3 Cloudflare Workers to production -- cas.nextcalc.io, ratelimit.nextcalc.io, export.nextcalc.io
- [x] Configure custom domain + SSL -- nextcalc.io (Vercel), worker subdomains (Cloudflare)
- [x] Configure Google + GitHub OAuth for production (redirect URIs on nextcalc.io)

---

## Technical Debt (All Resolved)

All technical debt items have been addressed as of v1.0.0:

- Export SVG: Dual rendering (foreignObject for browsers, Unicode text for rasterization)
- Canvas 2D fallback: `Canvas2DRenderer` added; factory selects WebGPU > WebGL2 > Canvas2D
- Test mocks: Updated to React 19 ref-as-prop pattern
- API type safety: `as any` replaced with typed assertions (4 `biome-ignore` for adapter type mismatch)
- PubSub: Hybrid Upstash Redis Streams + in-memory; graceful degradation

### Security & Performance Audit (March 2026)

- JWT WebSocket auth: replaced base64 decode with `jose.jwtVerify()` signature verification
- IDOR fixes: worksheet queries enforce ownership, unshareWorksheet validates worksheetId
- Profile resolver: fixed `authorId` → `userId` field reference
- Forum post views: atomic `update({ data: { views: { increment: 1 } } })` replaces read-then-write
- Worksheet views: existence check before increment
- Worker error responses: internal `err.message` no longer leaked to clients
- Rate limiter: unlimited tiers skip KV entirely (no unbounded arrays)
- Math engine: `modPow`/`lucasLehmer` rewritten with BigInt (overflow-safe for all inputs)
- RSA: `randomBigIntBelow()` helper replaces unsafe `Number(bigint)` conversion
- Limits: fixed copy-paste bug (`v1` → `v2`), infinite recursion guard via `_skipAlgebraic`
- Graph theory: `tarjanSCC` converted to iterative DFS (no stack overflow on large graphs)
- Graph theory: `topologicalSortKahn` uses index pointer instead of `Array.shift()` (O(V+E) vs O(V²))
- Web: `Lorenz3DRenderer` lazy-loaded with `next/dynamic` + `ssr: false`
- Web: `Math.min/max(...largeArray)` replaced with `.reduce()` (no stack overflow)
- Web: `dangerouslySetInnerHTML` removed for plain-text problem statements
- Web: PDE `toggleAnimation` stale closure fixed with functional state update
- Bifurcation renderer: stale `gpuParams` closure fixed
- `isFinite()`/`isNaN()` → `Number.isFinite()`/`Number.isNaN()` across 12 files
- Node.js builtins: `node:` import protocol added to 4 files
- Prisma schema: removed redundant `@@index([shortCode])` (already `@unique`)
- Database: `FavoriteType` enum exported from `@nextcalc/database`
- Turbo: Sentry env vars added to build cache keys, `test` depends on `^build`

### v1.2.1 -- CI/CD Pipeline Fixes & Comprehensive Audit (March 2026)

- [x] Fix 54 test failures across all packages (API, web, export-service, rate-limiter)
- [x] Fix Biome formatting across 170+ files
- [x] Upgrade CI actions: `actions/checkout@v4` → `@v6`, `actions/setup-node@v4` → `@v6`
- [x] Add `AUTH_SECRET` env var to CI build step (NextAuth build-time requirement)
- [x] Add `@graphql-codegen/cli` and `@graphql-typed-document-node/core` devDependencies for typecheck
- [x] Update deploy-workers workflow: v6 actions, `pnpm-lock.yaml` trigger, `workflow_dispatch`
- [x] New DataLoaders: `hasUpvoted`, `commentCountByPostId` — eliminates N+1 queries
- [x] Redis `invalidateByPrefix` cache method using SCAN
- [x] Path traversal guard in `getTopicPath`, GraphQL redirect sanitization
- [x] 78 audit issues fixed across entire monorepo (25 HIGH, 47 MEDIUM, 6 LOW)

### v1.2.0 -- Auth, Forum, Level System & Icons (March 2026)

- [x] Fix signIn redirect from `/dashboard` (404) to `/`
- [x] Fix signOut to use CSRF token (NextAuth v5 requirement)
- [x] Add `onError` fallback to navbar avatar (broken image → initials/level icon)
- [x] Sync OAuth provider name/image on every sign-in
- [x] Add `commentCount` field to GraphQL ForumPost type + resolver
- [x] Fix forum post listing and detail pages showing 0 comments
- [x] Remove hardcoded fake top contributors, show empty state
- [x] Extract HeroAvatar component with `onError` image fallback
- [x] RS3-style XP formula: `sum(floor(i + 300 * 2^(i/7)) / 4)` — exponential curve, 100 levels
- [x] 10 named tiers (Novice → Transcendent) + admin-only Architect (L101)
- [x] OKLCH color progression per level, XP formatting helpers
- [x] Programmatic crystal SVG component (`LevelIcon`) with 10 visual tiers
- [x] Pre-generated 103 SVG files via Node.js script (`generate-level-icons.ts`)
- [x] Static SVG loader component (`LevelIconStatic`)
- [x] 3 L101 special variants: Prismatic Crown, Cosmic Nexus, Phoenix Crystal
- [x] Level icon as default avatar in navigation and profile
- [x] XP bar with tier name display in profile HeroCard

---

## Future Ideas

- [ ] WASM arbitrary precision (Emscripten build for native performance)
- [ ] Collaborative worksheets (real-time multiplayer via WebSocket)
- [ ] Plugin system for custom math modules
- [ ] Mobile app (React Native or PWA enhancements)
- [ ] AI-powered step-by-step explanations
- [ ] LaTeX document editor with live preview
- [ ] API key system for third-party integrations
