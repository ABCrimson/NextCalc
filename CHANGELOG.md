# Changelog

All notable changes to NextCalc Pro are documented in this file.

## [1.1.0] - 2026-03-01

### Dependency Updates
- Update 90+ packages across all 10 workspace packages (`86f3eb3`)
- Next.js 16.2.0-canary.69, React 19.3.0-canary, TypeScript 6.0.0-dev.20260301
- Prisma 7.5.0-dev.32, Biome 2.5.0, Turborepo 2.8.12
- Hono 4.12.3, Wrangler 4.68.0, Vitest 4.1.0-beta.5, KaTeX 0.16.33
- Three.js 0.183.2, jose 6.1.3 (new)

### Security
- JWT signature verification via `jose.jwtVerify()` for WebSocket auth (`86f3eb3`)
- IDOR protection on worksheet queries — enforce ownership, admin-only cross-user access (`86f3eb3`)
- Fix `unshareWorksheet` IDOR — validate shareId belongs to worksheetId (`86f3eb3`)
- Fix profile resolver using wrong field (`authorId` → `userId`) (`86f3eb3`)
- Remove `dangerouslySetInnerHTML` for plain-text problem statements (`86f3eb3`)
- Strip internal error messages from worker responses (`86f3eb3`)
- Atomic forum post view counter (replaces read-then-write) (`86f3eb3`)
- Add existence check to `incrementWorksheetViews` (`86f3eb3`)

### Bug Fixes
- BigInt-safe `modPow` and `lucasLehmer` — fixes silent overflow for large inputs (`86f3eb3`)
- RSA `randomBigIntBelow()` helper — fixes crash for key sizes >= 64 bits (`86f3eb3`)
- Limits copy-paste bug: `v1` → `v2` at evaluation boundary (`86f3eb3`)
- Infinite recursion guard in algebraic simplification (`_skipAlgebraic` flag) (`86f3eb3`)
- PDE `toggleAnimation` stale closure fixed with functional state update (`86f3eb3`)
- Bifurcation renderer stale `gpuParams` closure fixed (`86f3eb3`)

### Performance
- Iterative Tarjan SCC — no stack overflow on large graphs (`86f3eb3`)
- Topological sort uses index pointer instead of `Array.shift()` (O(V+E) vs O(V²)) (`86f3eb3`)
- Lazy-load `Lorenz3DRenderer` with `next/dynamic` + `ssr: false` (`86f3eb3`)
- Replace `Math.min/max(...largeArray)` with `.reduce()` — prevents stack overflow (`86f3eb3`)
- Rate limiter skips KV entirely for unlimited tiers (`86f3eb3`)

### Maintenance
- `isFinite()`/`isNaN()` → `Number.isFinite()`/`Number.isNaN()` across 12 files (`86f3eb3`)
- `node:` import protocol for Node.js builtins in 4 files (`86f3eb3`)
- Remove redundant `@@index([shortCode])` from Prisma schema (`86f3eb3`)
- Export `FavoriteType` enum from `@nextcalc/database` (`86f3eb3`)
- Add Sentry env vars to Turbo build cache keys (`86f3eb3`)
- Fix `test` task dependency: `["build"]` → `["^build"]` (`86f3eb3`)
- Bump all package versions to 1.1.0 (`86f3eb3`)

---

## [1.0.0] - 2026-02-28

### 2026-02-24

#### Features
- Seed Lorenz GPU particles along the attractor trajectory (`6aa3223`)
- 5 procedural space cubemap themes with configurable resolution (`6876731`)
- Add 5 colormaps (inferno, coolwarm, cividis, magma, spectral) and fix zoom sensitivity (`5e2c498`)
- Upgrade PageRank nodes to 3D spheres with proper lighting and size cap (`998631e`)

#### Bug Fixes
- Attention matrix multi-hue OKLCH colormap for dark theme readability (`bddf9f2`)
- Add cubic, Gauss, circle maps to bifurcation WebGPU shader (`6938f89`)
- Use SVG markers for eigenvector arrowheads to fix alignment (`115b2a7`)
- Improve box plot whisker visibility with dashed strokes (`118b708`)
- Symbolic integration of x*ln(x) via integration by parts (`070818f`)
- PDE solver re-runs on all parameter changes, fixing blank heatmap (`1bb87b9`)
- Use seeded PRNG in MetaLearningPlayground to prevent hydration mismatch (`5f7e3a1`)
- Body suppressHydrationWarning, favicon metadata, temperature icon overflow (`81df29d`)

#### Maintenance
- Bump biome 2.4.4, tailwind 4.2.1, hono 4.12.2, typescript 6.0.0-dev.20260223, workers-types 4.20260302.0 (`0ac9bd8`)

### 2026-02-21

#### Features
- Add 4 PDE initial condition presets (double Gaussian, sawtooth, square pulse, sinc) (`d5659f4`)
- Add 3 graph presets and detailed proof section for algorithm results (`53396a3`)
- Detailed rule explanations for integration and derivative solver steps (`58816d2`)
- Add polar plot analysis section (symmetry, petals, area) (`f9b1c31`)

#### Bug Fixes
- Update symbolic page to reflect full integration capabilities (`1490a47`)
- ML attention matrix readability and similarity matrix OKLCH colors (`707114e`)
- Box plot whiskers, end-caps, and hover tooltips (`57878f7`)
- Complex panel Unicode subscripts and conjugate overline rendering (`d29c5ee`)
- Fourier axis labels respect zoom/pan visible window (`746ec18`)
- Bifurcation DPR scaling, Y-axis pan, add 10 presets (`f927b2f`)
- Implement proper SSAO with GTAONode instead of empty AO slot (`aa3d565`)
- Resolve stale closure in Lorenz GPU particle toggle (`a06ceff`)
- Resolve WebGPU init race condition in PDE heatmap (`24cd16d`)
- Prevent PageRank crash when clearing graph (division by zero guard) (`af9228e`)

#### Maintenance
- Bump dependencies: next, biome, three, prisma, framer-motion, hono, etc. (`0465421`)

---

## [0.1.0] - 2025-10-16

### Initial Release

#### Features
- Complete Phase 1 MVP calculator with history, keyboard shortcuts, and LaTeX rendering (`62208ef`)
- Next.js 16.0.0-beta.0 with React 19.2.0 upgrade (`e1e8ba5`)
- Next.js app with App Router and shared types package (`1a9f33f`)

#### Infrastructure
- Initial project setup with Turborepo, TypeScript 5.9.3, and ESNext (`b195e60`)

---

_This changelog is generated from the git history. Commit hashes reference the short SHA for each change._

[1.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.1.0
[1.0.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.0.0
[0.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v0.1.0
