# NextCalc Pro - Roadmap

## Completed Features (verified in codebase)

### Core Calculator (`apps/web/app/page.tsx`)
- [x] Basic and scientific operations
- [x] Calculation history with Zustand persistence
- [x] Keyboard shortcuts
- [x] LaTeX rendering via KaTeX
- [x] Share button component

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

### Web App Pages (all in `apps/web/app/`)
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

---

## P1: Deployment and Testing

### Deployment
- [ ] Deploy web app to Vercel (see [DEPLOYMENT.md](./DEPLOYMENT.md))
- [ ] Configure production environment variables
- [ ] Set up Neon production database branch
- [ ] Deploy Cloudflare Workers to production
- [ ] Configure custom domain and SSL
- [ ] Set up CI/CD pipeline (GitHub Actions)

### Testing Coverage
- [ ] Expand unit tests for math-engine (target: 90% coverage)
- [ ] Add integration tests for GraphQL API resolvers
- [ ] Expand E2E tests with Playwright for critical user flows
- [ ] Add accessibility tests (axe-core) for all pages
- [ ] Add visual regression tests for plot outputs
- [ ] Performance benchmarking suite

---

## P2: Enhanced Features

### WASM Native Build
- [ ] Install Emscripten and build MPFR/GMP WASM module
- [ ] Replace mock fallback with native arbitrary precision arithmetic
- [ ] Benchmark native vs JavaScript performance
- [ ] Web Worker integration for non-blocking computation

### Internationalization (i18n)
- [ ] `next-intl` is installed (v4.8.3) but not yet configured with message files
- [ ] Translate UI to Spanish, French, German, Japanese, Chinese
- [ ] RTL layout support for Arabic/Hebrew
- [ ] Locale-specific number formatting

---

## P3: Production Hardening

### Monitoring and Observability
- [ ] OpenTelemetry distributed tracing
- [ ] Sentry error tracking integration
- [ ] Vercel Analytics setup
- [ ] Custom performance dashboard
- [ ] Alert thresholds for error rates and latency

### Security
- [ ] Content Security Policy (CSP) headers
- [ ] Rate limiting tuning based on real traffic
- [ ] Input sanitization audit
- [ ] Dependency vulnerability scanning (Snyk/Dependabot)
- [ ] CORS policy review for Workers

---

## Feature Backlog

### High Priority

1. **User profile page** -- View/edit profile, avatar, bio, calculation stats
2. **Calculation sharing** -- Share calculations via URL with preview cards (share-button component exists but sharing backend is incomplete)
3. **Worksheet collaboration** -- Real-time collaborative worksheets (WebSocket subscriptions are schema-ready in GraphQL)
4. **Export to PDF/LaTeX** -- Export calculation sheets and plots (export-service Worker exists but full integration is not wired)
5. **Keyboard shortcut customization** -- Let users remap shortcuts
6. **Dark mode toggle** -- Manual dark/light/system theme switcher in navigation

### Medium Priority

7. **Offline support (PWA)** -- Service worker for offline calculator use (install-pwa component exists but service worker is not implemented)
8. **Calculation templates** -- Pre-built templates for common problems
9. **Step-by-step solutions** -- Show intermediate steps for symbolic operations (solver step detail exists but could be expanded)
10. **Formula library** -- Searchable reference of common formulas by topic
11. **Graph annotations** -- Add labels, arrows, and notes to plots
12. **Variable sliders** -- Interactive parameter sliders on plots (like Desmos)

### Lower Priority

13. **Mobile app (Capacitor/Expo)** -- Native mobile wrapper
14. **API rate limit dashboard** -- Show users their API usage
15. **Calculation history search** -- Full-text search across past calculations
16. **Custom unit definitions** -- Let users define their own unit conversions
17. **Matrix visualization** -- Visual matrix operations with step animations
18. **Statistical distribution plots** -- Interactive PDF/CDF/QQ plots
19. **Import from Wolfram/MATLAB** -- Parse and convert external notation
20. **Community problem sets** -- User-submitted practice problems with solutions

---

## Known Technical Debt

- WASM module requires Emscripten for native build; currently uses mock fallback
- `next-intl` is installed as a dependency but i18n is not configured
- Export service uses MathJax placeholder -- needs production-grade rendering
- Some WebGPU features have Canvas 2D fallback but not all browsers support WebGPU yet
- `vitest.setup.ts` still contains `React.forwardRef` in mocks (acceptable for test code)
- 4 biome-ignored `as any` casts remain in API package for adapter/handler type incompatibilities
