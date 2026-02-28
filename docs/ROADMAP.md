# NextCalc Pro - Roadmap

## Completed Features (verified in codebase)

### Core Calculator (`apps/web/app/page.tsx`)
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
- [x] GraphQL API with Apollo Server 5.4 (`apps/api/`)
- [x] Prisma 7 shared database package (`packages/database/`)
- [x] NextAuth v5 with Google + GitHub OAuth
- [x] Upstash Redis integration (caching + rate limiting)
- [x] Apollo Client integration in web app
- [x] DataLoaders for N+1 query prevention
- [x] Full resolver set (user, worksheet, folder, calculation, forum, comment, upvote)
- [x] Cursor pagination (Relay-style connections)
- [x] Custom error classes (AuthenticationError, ForbiddenError, NotFoundError, ValidationError)
- [x] IDOR protection on profile resolvers
- [x] Zod input validation on all mutations
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
- [x] `next-intl` configured with 1203 translation keys across 40+ pages (en, ru, es, uk, de, fr, ja, zh)
- [x] Vercel Analytics + Speed Insights
- [x] Dependabot for dependency vulnerability scanning
- [x] Bookmarks store (Zustand + localStorage persistence)

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

- [ ] Set up Neon production database branch
- [ ] Configure production environment variables on Vercel
- [ ] Deploy web app to Vercel
- [ ] Create Cloudflare R2 buckets (nextcalc-exports-public + nextcalc-exports-private)
- [ ] Set ADMIN_KEY secret via `wrangler secret put ADMIN_KEY`
- [ ] Deploy 3 Cloudflare Workers to production
- [ ] Configure custom domain + SSL

---

## Known Technical Debt

- Export service uses MathJax placeholder -- needs production-grade rendering
- Some WebGPU features have Canvas 2D fallback but not all browsers support WebGPU yet
- `vitest.setup.ts` still contains `React.forwardRef` in mocks (acceptable for test code)
- 4 biome-ignored `as any` casts remain in API package for adapter/handler type incompatibilities
- WebSocket subscriptions use in-memory PubSub (needs Redis PubSub for production scale)
