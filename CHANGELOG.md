# Changelog

All notable changes to NextCalc Pro are documented in this file.

## [1.2.1] - 2026-03-04

### CI/CD Pipeline

- Fix 15 API test failures — add missing mocks for `hasUpvoted` DataLoader, `$transaction`, `invalidateByPrefix`, `updateMany` (`2405bb9`)
- Fix 35 web test failures — add `m` (lazy motion) proxy to framer-motion mock in vitest.setup.ts (`2405bb9`)
- Fix 3 export-service test failures — use valid UUID strings for userId in test data (`2405bb9`)
- Fix 1 rate-limiter test failure — adjust safety margin assertion (`2405bb9`)
- Fix Biome formatting across 170+ files — import organization, line wrapping, JSON formatting (`2405bb9`)
- Upgrade CI actions: `actions/checkout@v4` → `@v6`, `actions/setup-node@v4` → `@v6` (`2405bb9`)
- Provide `AUTH_SECRET` env var in CI build step — NextAuth requires it at build time (`3c9e476`)
- Add `@graphql-codegen/cli` and `@graphql-typed-document-node/core` devDependencies — required for typecheck (`8ef2f61`)
- Update lockfile for `typedoc` devDependency (`ca71852`)
- Update deploy-workers workflow — v6 actions, `pnpm-lock.yaml` path trigger, `workflow_dispatch` support (`b22cae5`)

### Comprehensive Audit (from v1.2.0)

- **78 issues fixed** across the entire monorepo (25 HIGH, 47 MEDIUM, 6 LOW)
- **Security**: path traversal guard in `getTopicPath`, GraphQL redirect sanitization, `importFromJSON` validation
- **Performance**: N+1 queries eliminated with `hasUpvoted` and `commentCountByPostId` DataLoaders, `invalidateByPrefix` cache method using SCAN
- **Code quality**: Redis SCAN cursor type fix, `alternateLocale` metadata fix, `setTimeout` ref type fix, dead state removal
- **Infrastructure**: Vitest `.spec` exclusion fix, `transpilePackages` cleanup, vacuous E2E test removal

---

## [1.2.0] - 2026-03-03

### Auth Fixes
- Fix signIn redirect from `/dashboard` (404) to `/` (`b441eb3`)
- Fix signOut to use CSRF token — NextAuth v5 requires CSRF on POST to `/api/auth/signout` (`b441eb3`)
- Add `onError` fallback to navbar avatar — broken provider images fall back to level icon (`b441eb3`)
- Sync OAuth provider name and image on every sign-in event (`b441eb3`)

### Forum
- Add `commentCount: Int!` field to GraphQL `ForumPost` type with dedicated resolver (`b441eb3`)
- Fix forum post listing and detail pages showing 0 comments (was fetching `comments(limit: 0)`) (`b441eb3`)
- Remove hardcoded fake top contributors, show i18n empty state message (`b441eb3`)

### Level System
- RS3-style XP formula: `sum(floor(i + 300 * 2^(i/7)) / 4)` — exponential curve with 100 levels (`b441eb3`)
- 10 named tiers: Novice, Apprentice, Journeyman, Adept, Expert, Master, Grandmaster, Legend, Mythic, Transcendent (`b441eb3`)
- Admin-only Architect tier (L101) for special users (`b441eb3`)
- OKLCH color progression per level, XP formatting helpers (`b441eb3`)

### Level Icons
- Programmatic crystal SVG component (`LevelIcon`) with 10 visual tiers of increasing geometric complexity (`b441eb3`)
- Pre-generated 103 SVG files via Node.js script (`generate-level-icons.ts`) (`b441eb3`)
- Static SVG loader component (`LevelIconStatic`) for `/icons/levels/level-NNN.svg` (`b441eb3`)
- 3 L101 special variants: Prismatic Crystal Crown, Cosmic Nexus, Phoenix Crystal (`b441eb3`)

### Profile
- Extract `HeroAvatar` component with `onError` image fallback + level icon default (`b441eb3`)
- XP bar with tier name display in profile HeroCard (`b441eb3`)
- Level icon as default avatar in navigation and profile when no provider image (`b441eb3`)

---

## [1.1.3] - 2026-03-02

### Performance
- Fix bookmarks store 5x re-render with `useShallow` selector ([`9acc00a`](https://github.com/ABCrimson/NextCalc/commit/9acc00a))
- Dynamic import KaTeX (~280 KB deferred from initial bundle)
- Add 4 new DataLoaders eliminating N+1 queries (`worksheetsByFolderId`, `forumPostById`, `commentById`, `repliesByParentCommentId`)
- Parallelize sequential DB queries with `Promise.all` in worksheet, forum, and profile resolvers
- Typed arrays (`Uint8Array`/`Float64Array`) in prime sieve and PageRank
- Memoize factorial computation in `series.ts`
- Batch Canvas2D grid draws into single path operations
- Fix GPU memory leak: dispose sprite textures/materials in `webgl-3d.ts`
- Add `loading.tsx` skeletons for `learn/[topic]`, `problems/[id]`, `share/[code]`

### Security
- Timing-safe admin key comparison via SHA-256 + XOR in rate-limiter
- CORS fallback returns empty string for non-matching origins
- Recursive query complexity analysis in GraphQL performance-monitoring plugin
- Remove `prettyJSON` middleware from all workers (prevents information leakage)

### Code Quality
- Fix all `exactOptionalPropertyTypes` violations across 3 Cloudflare Workers
- Fix 50+ pre-existing type errors in CAS service (`FactoryFunctionMap`, `SymbolNode`, null checks)
- Replace `React.EventType` namespace usage with named imports (6 files)
- Replace `slate-*`/`gray-*` Tailwind classes with semantic tokens (3 pages)
- Add `typecheck` scripts to all worker packages
- Create `tsconfig.typecheck.json` for standalone web typechecking

### Infrastructure
- Update Turbo 2.8.12 → 2.8.13-canary.8
- Update CI actions: checkout v4 → v6, setup-node v4 → v6, cache v4 → v5
- Update `compatibility_date` to `2026-03-01` for all workers
- Fix CORS port references 3020 → 3005 across all workers and configs
- Comprehensive documentation and wiki refresh

---

## [1.1.2] - 2026-03-02

### Bug Fixes
- Align API test mocks with security audit changes (IDOR, atomic counters, existence checks) (`4c197c0`)
- Add `account_id` to all 3 worker `wrangler.toml` configs — fixes Cloudflare `/memberships` auth error (`d5ccb91`)
- Set `fail-fast: false` in deploy-workers matrix so each worker deploys independently (`d5ccb91`)

### Infrastructure
- Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets for CI worker deploys (`d5ccb91`)

---

## [1.1.1] - 2026-03-01

### Bug Fixes
- Fix deploy-workers workflow: `pnpm deploy` → `pnpm run deploy` (pnpm 11 conflict) (`e0cabfd`)

---

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

[1.2.1]: https://github.com/ABCrimson/NextCalc/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/ABCrimson/NextCalc/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/ABCrimson/NextCalc/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/ABCrimson/NextCalc/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.1.1
[1.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.1.0
[1.0.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.0.0
[0.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v0.1.0
