# Changelog

All notable changes to NextCalc Pro are documented in this file.

## [1.5.0] - 2026-07-10

> Evergreen sweep 2026-07 (PR #74): every dependency pushed to its absolute-newest published version in any channel, every-package idiom audit + fixes, dead-code purge (net −9k lines), docs overhaul, and a competitive accuracy benchmark locked in as a regression suite — shipped through a pre-merge adversarial review pass whose confirmed findings (including two criticals) are all fixed below.

### Dependencies (headline bumps)
- **TypeScript 7.1.0-dev nightly (native Go compiler) is now the typecheck gate for 8 of 10 packages** — full-workspace typecheck dropped from ~6 min to ~22 s. `apps/web` and `packages/plot-engine` stay on tsc 6.0.3 (upstream blockers: Next's build checker + graphql-codegen need the TS JS API shipping in 7.1; three.js TSL node-union types hang typescript-go). `@typescript/native-preview`, the tsgo advisory CI job, and all `typecheck:fast` scripts removed — the gate itself is native now.
- **pnpm 11.0.0-alpha.11 → 11.11.0 GA** — supply-chain defaults on (`minimumReleaseAge` with recorded exclusions for <24 h pins), `.npmrc` deleted (alpha-era settings superseded), CI resolves pnpm from `packageManager`.
- next 16.3.0-canary.81, react/react-dom 19.3.0-canary (2026-07-08), graphql 17.0.2, @cloudflare/workers-types **v5**, vitest 5.0.0-beta.6, hono 4.12.28 (security fixes: SSR context leak, XSS, CORS bypass), immer 11.1.11 (prototype-pollution fix), radix-ui 1.6.3-rc, zod 4.5.0-canary, @apollo/client 4.3.0-alpha.2, prisma 7.9.0-dev.19, wrangler 4.110.0, turbo 2.10.5-canary.4, @sentry/nextjs 10.64.0, playwright 1.62.0-alpha, plus ~35 more. All remaining `^` ranges pinned exact.

### Added
- **React Compiler enabled** (`reactCompiler: true`, stable top-level option in Next 16.3) — automatic memoization at build time across the whole web app.
- **GraphQL fragment masking + `useFragment`** — the upstream blocker (client-preset "spread.directives is not iterable" under graphql 17) was fixed in client-preset 6.1.0; `UserSummary`/`PublicUserSummary` fragments now replace 10+ duplicated selection sets, with masked fragment types flowing to child components.
- **`Complex.pow` supports arbitrary real and complex exponents** (principal branch, `z^w = exp(w·Log z)`) — `i^i` now evaluates to `e^(−π/2)`; integer fast path unchanged.
- **Compound unit expressions** in the math engine — `findUnit`/`createQuantity` now parse `km/h`, `m/s^2`, `kg*m/s^2` etc., composing dimensions and linear conversion factors.
- **Competitive accuracy regression suite** — 16 ground-truth problems (hand-verified during the July 2026 competitive analysis vs Wolfram Alpha/Symbolab/GeoGebra), including edge cases where commercial solvers disagree; the engine passes 17/17 checks in ~6 ms total.
- **Real cross-instance GraphQL subscriptions** — Redis Streams events are now actually consumed (instance-tagged XADD + polling XRANGE merged into the local PubSub iterator); previously published events were never read, so multi-instance SSE delivery silently didn't exist. The poller is a self-scheduling loop (a slow round-trip can never overlap the next tick and double-deliver) with its cursor anchored to the stream's own tip ID rather than the local clock, and payloads round-trip through the Upstash client's own serializer — a pre-merge adversarial review caught the initial implementation double-parsing payloads (dropping every cross-instance event) with test mocks that encoded the wrong client contract.
- **Schema-parity regression test** — the executable schema (gql template in `schema.ts`) and the codegen source (`schema.graphql`) are two hand-maintained copies that had already drifted (`Worksheet.version` existed only in one); a new test asserts bidirectional type/field/argument/directive parity so the drift class is dead.
- **`WorksheetShare.worksheet` resolver + `worksheetById` DataLoader** — nested share queries previously crashed with a non-nullable field error.
- **N+1 elimination** — new batched DataLoaders (`worksheetsByUserId`, `foldersByUserId`, `forumPostsByUserId`, `commentsByPostId`); 16 loaders total.
- **Real Apollo cache control** — the no-op response-caching plugin replaced with `ApolloServerPluginCacheControl` + per-resolver hints on public listings, plus `@cacheControl(inheritMaxAge: true)` on the composite types those roots reach (without it, unhinted child fields forced every policy to maxAge 0 and the hints were inert). Viewer-specific `ForumPost.hasUpvoted` is explicitly `@cacheControl(maxAge: 0, scope: PRIVATE)`; user-scoped types stay unannotated so selecting them keeps responses uncacheable. `updateWorksheet` now increments `Worksheet.version` per the schema contract.
- **Worksheet `version` exposed in the GraphQL schema** — the SSE collab subscription had been selecting a field that didn't exist, failing schema validation at runtime and silently degrading to polling; caught by migrating the raw query strings to codegen-typed documents.

### Fixed
- **CAS polynomial division returned reversed quotients and could hang forever** (pre-existing, exposed while shipping this sweep): `dividePolynomials` built ascending coefficients and then `.reverse()`d them into the wrong convention, and a zero remainder in empty-array form sent `gcdPolynomials`→`dividePolynomials` into a synchronous infinite loop — `lcmPolynomials(x−2, x−3)` never returned. Division now canonicalizes polynomials (trailing zeros stripped, zero = `[0]`), throws on zero-polynomial divisors, and exact-value regression tests replaced the `toBeDefined()` assertions that let both bugs pass.
- **CI's vitest-hang guard could mask real hangs** — `timeout` exit 124 was unconditionally treated as success, which had been hiding the CAS infinite loop for the suite's entire lifetime; 124 is now accepted only when the captured log shows zero failures and zero worker errors.
- **Apollo Server double-start** — the module-scope default handler and the web route's `createHandler` both started the one shared server; every `next build` logged a startup error. Handlers now own their server instance (via `createApolloServer()`) and the stub-auth default is lazy; the orphaned singleton + SIGTERM block were removed.
- **Adaptive sampler refinement criterion was inverted** — straight segments subdivided to the 8193-point cap while sharp spikes were accepted as smooth; corrected, with the subdivision probe moved to the golden-ratio conjugate of each cell (kills all grid-commensurate resonance deterministically — `sin(10πx)` previously rendered as a flat line) and the initial budget raised 100→256.
- **Discontinuity breaks lost in shared sampling** — the sampler silently dropped non-finite/throwing samples, so all three 2D renderers drew chords across asymptotes and domain gaps (e.g. `sqrt(x²−1)` bridged (−1,1)); explicit break markers now split strokes/strips in canvas, WebGL, and WebGPU paths.
- **Unbounded sample cache** — every pan/zoom frame minted a new viewport key retained until dispose; now a 128-entry LRU.
- **WebGL3D type errors** — passing a 2D config surfaced an opaque WeakMap TypeError instead of the descriptive unsupported-type error; a `Plot3DConfig` guard now validates before hashing (and makes the mismatch a compile error).
- **Worksheets i18n namespace missing in half the locales** — the new worksheets page referenced keys that didn't exist: 2 keys missing in all 8 locales, and the entire 24-key `worksheets` namespace missing in ru/es/uk/de; all added, properly translated (ICU plurals for ru/uk).
- **Stale-geometry bug in the 3D renderer** — the render cache hash ignored the plotted function's identity, so editing a formula with unchanged viewport/resolution kept drawing the old surface.
- **WebGL2D VAO corruption** — cached vertex-array objects pointed at stale pooled buffers; multiple plotted functions could render garbage. Buffers are now rebound per use and VAOs keyed per function.
- **Sentry double-initialization** — legacy `sentry.server.config.ts` deleted (instrumentation.ts is the single init point; edge runtime init added).
- **`.gitignore` anchoring bug** — `public/sw.js` patterns never matched `apps/web/public/`, so the generated service worker churned through 18 commits; now untracked and correctly ignored.
- **Line endings normalized** — repo-wide `.gitattributes` (`eol=lf`) added; 339 CRLF working-tree files re-smudged.
- Canvas2D renderer now contains per-sample evaluation errors like the GPU renderers; PNG export uses async `toBlob`; blob URLs revoked safely after download.

### Changed
- **Worksheets page is a Server Component** — auth + Prisma query moved server-side (was a client `useEffect`+fetch waterfall); adds `metadata`, `loading.tsx`, and a real signed-out state.
- **10 algorithm pages converted to Server Components** via `getTranslations`, removing unnecessary client boundaries; breadcrumb/metadata components are now presentational.
- **Reference-data API routes adopt `use cache`** + `cacheLife`/`cacheTag` (algorithms catalog, knowledge topics) instead of `force-dynamic`.
- **2D renderers use shared adaptive sampling with per-function caching** (replacing fixed 1000-point resampling every frame); broken worker-serialization sampling path deleted.
- **Matrix hot loops rewritten** — LU decomposition/row-echelon no longer allocate an immutable Matrix per inner-loop step (was effectively O(n⁵) with O(n³) allocations); `inverse()` no longer computes a redundant determinant.
- Number-theory helpers (`gcd`/`modPow`/`isPrime`) consolidated to single canonical exports (were reimplemented 5-6×); `|| 0` → `?? 0` at 26 indexed-access fallbacks in transformer code (stops masking NaN).
- Workers migrated to `wrangler.jsonc` with `compatibility_date` 2026-07-08; hand-rolled R2/resvg ambient types deleted in favor of real package types.
- `chaos`/`game-theory` now export via standard `./chaos`, `./game-theory` subpaths with index barrels.
- Locale-aware `Link` everywhere; `size-*` utility adoption; icon-button aria-labels; difficulty badge + calculator/matrix feature cards translated (new keys in all 8 locales).
- Docs de-hardcoded from exact version strings repo-wide; ROADMAP rewritten forward-looking; new READMEs for `apps/web`, `packages/math-engine`, `packages/database`, `packages/types`, and the wiki sync process; DataLoader table deduplicated to one canonical copy.
- **Tailwind CSS 4.3.1 → 4.3.2** — patch bump to the latest release. The homepage tech badge now reads "Tailwind 4.3.2" (corrected from a stale "4.3.0").

### Removed
- ~115 dead files: orphaned static level-icon subsystem (103 SVGs + generator + component), favicon design explorations, unused generic components (`error-boundary`, `algorithm-visualizer`, `math/visualizers`, `calculator-animations`), dead hooks (`use-keyboard-shortcuts`, `use-math-worker`), duplicate `apps/api/prisma/seed.ts`, obsolete handoff spec, one-off PWA icon script, dead lib/auth duplicates, unused sampling worker, ~16 dead shader exports.
- typedoc (unreferenced by any pipeline; TS7-incompatible), `d3` + `@nextcalc/math-engine` from plot-engine (declared but never imported; −71 packages), `@types/react` from packages/types.
- Dead `deploy:staging` scripts from all three workers (they invoked a wrangler env that has never existed in any config) and the workers-README section documenting it.

## [1.4.0] - 2026-06-29

> Idiom modernization follow-up to the v1.3.0 push-to-newest. Every change adopts the newest idioms of an already-pinned dependency and is behavior-preserving — except one genuine user-facing fix (forum localization). The pre-push gate (typecheck, lint, build) and tests are green.

### Fixed
- **Forum content now renders in the user's selected locale.** Post view counts, upvote counts, and relative timestamps were formatted with the runtime default locale instead of the active request locale, so they appeared wrong across all 7 non-English locales (ru, es, uk, de, fr, ja, zh). All six forum components now use next-intl's `useFormatter`, which binds the active locale automatically. Output is otherwise unchanged (compact numbers, narrow relative times, long dates), and relative times are now hydration-stable via a server-stamped `now`.

### Changed
- **Zod 4 idioms** — chained string-format validators replaced with top-level helpers (`z.string().url()` → `z.url()`, `z.string().uuid()` → `z.uuid()`) and `z.ZodSchema` → `z.ZodType`.
- **`motion` package** — migrated all framer-motion imports (93 specifiers across 92 files) to the `motion/react` entry point that motion 12 mandates. Same API, no behavior change.
- **Prisma preview flags** — dropped three now-GA preview features (`fullTextSearchPostgres`, `nativeDistinct`, `relationJoins`); only `partialIndexes` remains required.
- **Tailwind v4 idioms** — deprecated `bg-gradient-to-*` utilities migrated to `bg-linear-to-*/oklab` (preserving the oklab interpolation byte-for-byte with an sRGB fallback), and equal width/height pairs collapsed to the `size-*` shorthand. No visual change.
- **React 19.3 `useEffectEvent`** — adopted for the two effects where it genuinely fits (theme-toggle keyboard shortcut, calculator share-param restore), removing their dependency-list suppressions outright.
- **shadcn/ui `data-slot` convention** — added to every standard UI primitive part; purely additive, no className, variant, or behavior changes.
- **Hono `zValidator` middleware** — all three Cloudflare Workers migrated from hand-rolled `req.json()` + `schema.parse()` to `@hono/zod-validator`, with byte-identical validation error responses.
- **TS7-forward tsgo advisory** — the non-blocking native-preview typecheck job now scopes past the two packages whose Three.js TSL types the Go compiler cannot yet resolve, keeping the advisory green and meaningful (7/7 packages pass).

### Added
- **Real Sentry capture** — manual error capture (`captureError`, `captureMessage`, breadcrumbs, error boundaries) and `onRequestError` are now wired to Sentry instead of only logging to the console, via a code-split adapter.
- **`instrumentation-client.ts` migration** — replaced the deprecated `sentry.client.config.ts` (which does not run under Turbopack, so client-side Sentry was dead in dev) with the Next 15.3+/16 convention, including `onRouterTransitionStart` navigation tracing.

## [1.3.0] — Modernization (push-to-newest) — 2026-06-29

> Branch `modernization/foundation` (PR #50). A bleeding-edge dependency modernization: every dependency pushed to its absolute-newest published version (canary/preview/dev where that is newest), code rewritten to each version's newest idioms, and a complete Biome lint sweep. The pre-push gate (`turbo run typecheck lint build`) is green; tests pass (see remaining browser/deploy QA in [docs/ROADMAP.md](docs/ROADMAP.md)).

### Dependencies (old → new)

| Package | Before | After |
|---|---|---|
| next | 16.2.0-canary.69 | 16.3.0-preview.3 |
| react / react-dom | 19.3 canary (Feb) | 19.3 canary (Jun, 20260623) |
| typescript | 6.0.0-dev | **6.0.3 (GA)** + `@typescript/native-preview` 7.0 (advisory tsgo typecheck) |
| graphql | 16.13.0 | **17.0.1** (via a `pnpm-workspace.yaml` peer override — no fork) |
| @apollo/server / @apollo/client | 5.4.0 / 4.2-alpha | 5.5.1 / 4.3.0-alpha.1 |
| prisma / @prisma/client / adapter-neon | 7.5.0-dev.33 | 7.9.0-dev.13 |
| @neondatabase/serverless | 1.0.2 | 1.1.0 |
| tailwindcss / radix-ui / framer-motion / zustand | 4.2 / 1.4-rc / 12.34 / 5.0.11 | 4.3.1 / 1.6.0 / 12.41.0 / 5.0.14 |
| three / katex / mathjs | 0.183.2 / 0.16.33 / (pre-CVE) | 0.184.0 / 0.17.0 / **15.2.0** |
| next-intl / lucide-react / serwist | — / — / 9.5.6 | 4.13.0 / 1.21.0 / 10.0.0-preview.14 |
| jose / @upstash/redis | 6.1.3 / 1.37 | 6.2.3 / 1.38.0 |
| turbo / @biomejs/biome / vitest | 2.8-canary / 2.4.4 / 4.1-beta | 2.10.0 / 2.5.1 / 5.0.0-beta.5 |
| wrangler / hono | 4.69.0 / 4.12.3 | 4.104.0 / 4.12.27 |
| modern-pdf-lib / modern-cmdk | 0.28.1 / — | 0.40.2 / 1.1.5 (adopted) |
| @types/node / Node (CI) | 25 / 24 | 26.0.1 / **26** (engines floor stays ≥24 for Vercel) |

### Security
- **mathjs → 15.2.0** picks up the RCE-CVE fix (the pinned canary predated it).
- Bumping the Next.js / React / Prisma canaries off the months-old pins pulls in their accumulated upstream security fixes.

### Newest-idiom rewrites (not just version bumps)
- **Three 0.184**: Lorenz GPU particles rewritten from raw-WebGPU to TSL compute; SSAO migrated to `GTAONode` (red-channel fix). Lorenz 50K-particle render verified in a WebGPU browser.
- **next-intl 4.13**: ~30 hardcoded `'en-US'` date/number formats → `useFormatter()`; adopted `hasLocale`/`notFound`.
- **katex 0.17 / tailwind 4.3**: fixed dark-variant wiring + katex output mode.
- **serwist 10**: migrated to `createSerwist` (preview).
- **modern-pdf-lib 0.40.2**: export-service emits tagged-PDF accessibility — the math image is wrapped in a `Figure` structure element via the new high-level `tagFigure()` helper, carrying the LaTeX as `/Alt`; plus `deduplicateImages` (now returning a logged `DeduplicationReport`) and max-FlateDecode (`compressionLevel: 9`) in the save path.
- **modern-cmdk 1.1.5**: replaced the ~820-line hand-rolled command palette with the library's compound `Command.Dialog` components.
- **lucide-react 1.x**: inline GitHub/Google marks for the removed brand icons.

### Lint sweep (Biome 2.5.1)
- **2,222 warnings + 221 infos → 0 warnings + 1 unavoidable info.** `noNonNullAssertion` 1,612 → 0 via a documented hybrid: a scoped override for provably-safe numeric/matrix hot-paths plus 22 genuine masker fixes. Correctness/a11y/array-key/perf-security rules all real-fixed or principled-override; `!**/*.svg` excluded; `useLiteralKeys` disabled (conflicts with `noPropertyAccessFromIndexSignature`). Principle throughout: real fixes, not suppression.

### Tooling / CI
- CI runs on **Node 26**; added a non-blocking `typecheck-fast` job (TS7 `tsgo`, `continue-on-error`).
- Gate compiler moved to `tsc` 6.0.3 GA.

### Accessibility
- ZKP commitment-cell grid restructured to a WAI-ARIA `grid` → `row` → `gridcell` pattern — a `role="row"` layer (`display: contents`, so the CSS-grid layout is untouched) gives the accessibility tree the containment axe-core requires; a new regression test asserts the hierarchy and a clean axe run.

### Auth
- Client session migrated to NextAuth's `SessionProvider` + a thin `useSession` adapter (`lib/auth/hooks.ts`) — replaces the per-component `fetch('/api/auth/session')` + interval poll with one shared session context (single fetch, focus revalidation); the `{ session, status }` shape is preserved so the 7 consumers are unchanged.

### Design
- Topic colors moved off hardcoded Tailwind palette utilities to semantic OKLCH category tokens (`--color-topic-*` in `globals.css` + clean token utilities in `ui/topic-tag.tsx`), with dark handled by the tokens; verified zero visual change. Part of a broader pass converting decorative `rgba()` box-shadows to `oklch()` (~130 colors across 36 files).

### math-engine
- `hasCycleDirected`/`hasCycleUndirected` rewritten from recursion to explicit-stack iterative DFS (3-colour marking / parent-tracking) — removes the recursion-depth ceiling on large graphs; behaviour preserved.
- `astEquals` deduped to a single canonical export in `simplify.ts` — three private copies (in `simplify-advanced`, `step-solver`, `cas-core`) that each omitted the `UnaryOperatorNode` branch were deleted and now import the unary-aware canonical.

### Tooling / Code quality
- Re-enabled `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, and `noUnusedLocals` in `apps/web` and `apps/api` (they had overridden the root tsconfig to `false`) — 143 real fixes across 21 files, no workarounds.
- Chore sweep: ESM `await import('react')` in the framer-motion vitest mock (was CommonJS `require`); GraphQL codegen now strips its dead `/* eslint-disable */` banner via an `afterOneFileWrite` hook (`scripts/codegen-strip-header.mjs`) so output stays Biome-native.

### Fixed
- `export-service`: aligned the `modern-pdf-lib` test mock with its tagged-PDF API (`accessibilityPlugin`/`tagFigure`/marked-content/`deduplicateImages`) — unblocks the CI Test job.

### Notes
- **modern-xlsx** was evaluated for an XLSX export path but **not adopted** — the published 1.0.0/rc.1 dist ships without its wasm-bindgen JS glue and fails to import/bundle. Tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
- Remaining browser/deploy QA and provisioning are tracked in [docs/ROADMAP.md](docs/ROADMAP.md).

---

## [1.2.2] - 2026-03-04

### Testing
- **Comprehensive test overhaul across the entire monorepo** (`9a06ce7`) — added `vitest.config.ts` to all three Cloudflare Workers, coverage thresholds, split the monolithic resolver test into focused `__tests__/lib` suites (cache, dataloaders, validation, cursor-pagination, errors), and added ~46 test files across API / web / math-engine / plot-engine.

### Performance
- Optimize `/symbolic` and `/algorithms/transformers` routes (`43d4893`).

### Documentation
- Sync documentation and wiki with v1.2.1 performance optimizations and codebase (`34a1f70`).

---

## [1.2.1] - 2026-03-04

### Performance

- Dynamic-import `SymbolicPanel` (~300KB deferred) via `next/dynamic` + `ssr: false` on `/symbolic` route (`43d4893`)
- Replace Framer Motion orb animations with CSS `@keyframes` on `/symbolic` (compositor thread, zero main-thread cost) (`43d4893`)
- Replace all `m.*` entry animations with plain HTML + CSS animation on `/symbolic` — removes framer-motion from page chunk entirely (~34KB saved) (`43d4893`)
- Add IntersectionObserver gate to TransformerVisualizer `requestAnimationFrame` loop — pauses 60fps canvas when scrolled out of view (`43d4893`)
- Replace Framer Motion pulsing overlays with CSS `@keyframes` on `/algorithms/transformers` — eliminates per-frame React reconciliation for 64+ heatmap cells (`43d4893`)
- Remove staggered entry delay from 64 heatmap cells in TransformerVisualizer — eliminates 64 separate animation timers (`43d4893`)
- Cache KaTeX dynamic import at module level in `MathRenderer` — avoids redundant async resolution across multiple instances (`43d4893`)

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

## [1.1.4] - 2026-03-02

### Branding / PWA
- Custom geometric crystal favicon with a full PWA icon suite (`94dc7e7`)

### Database
- Upgrade Prisma `7.5.0-dev.32` → `7.5.0-dev.33`, modernize the schema, and document the partial indexes (`1ecd5a1`, `ae99ab2`)

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
- Prisma 7.5.0-dev.32, Biome 2.4.4, Turborepo 2.8.12
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

[Unreleased]: https://github.com/ABCrimson/NextCalc/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/ABCrimson/NextCalc/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/ABCrimson/NextCalc/compare/v1.1.4...v1.2.1
[1.2.0]: https://github.com/ABCrimson/NextCalc/commit/b441eb3
[1.1.4]: https://github.com/ABCrimson/NextCalc/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/ABCrimson/NextCalc/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/ABCrimson/NextCalc/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.1.1
[1.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.1.0
[1.0.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.0.0
[0.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v0.1.0
