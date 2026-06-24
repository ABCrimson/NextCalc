# NextCalc Pro — Full Version Audit & Modernization Analysis
**Generated:** 2026-06-24 · **Method:** live npm registry (`registry.npmjs.org` dist-tags + version lists) + 29-agent changelog research workflow · **Repo state:** branch `main`, v1.2.2

> This is **Phase 1** (inventory + comparison) for your approval. **Phase 2** (the rewrite/upgrade) starts only after you sign off and pick a target policy. Nothing in the codebase has been changed.

---

## 0. Codebase scope (what "rewrite every line" actually means)

| Area | TS/TSX LOC |
|---|---:|
| `apps/web` (Next.js 16 frontend) | ~111,980 |
| `packages/math-engine` | ~67,750 |
| `packages/plot-engine` (Three.js) | ~14,840 |
| `apps/api` (Apollo Server 5) | ~11,770 |
| `apps/workers` (3 CF Workers) | ~8,320 |
| `packages/database` + `packages/types` | ~260 |
| **Total** | **~215,000 LOC** across **593** TS/TSX files |

Plus: 1 CSS file (`globals.css`, 370), 1 Prisma schema (812), 2 GraphQL SDL files (1,469), 38 JSON, 51 Markdown.

**Reality check on "rewrite every single line":** The research below shows that for **~80% of dependencies the codebase already uses the newest idioms** (React 19 ref-as-prop, no forwardRef, Zod 4 `.issues`, Tailwind v4 CSS-first, Apollo Client 4, Prisma 7 `prisma-client` generator, radix-ui unified import). A literal 215K-line rewrite would be mostly churn with high regression risk. The high-value work concentrates in a handful of files (Three.js TSL renames, lucide icon names, Zod strictness, the security bumps). My recommendation (§6) is a **targeted, package-by-package modernization** rather than a blind rewrite — but the call is yours.

---

## 1. Everything that has a version (full inventory)

**94 npm packages** across 10 manifests + the following non-npm versioned items:

| Non-npm item | Where | Current |
|---|---|---|
| Node.js runtime (engines) | all `package.json` `engines.node` | `>=24.0.0` |
| Node.js in CI | `.github/workflows/*.yml` | `24` |
| pnpm (packageManager) | root `package.json` | `11.0.0-alpha.11` |
| `actions/checkout` | both workflows | `v6` |
| `actions/setup-node` | both workflows | `v6` |
| `pnpm/action-setup` | both workflows | `v4` |
| `actions/cache` (+ save/restore) | `ci.yml` | `v5` |
| Emscripten emsdk | `packages/math-engine/Dockerfile.wasm` | `3.1.51` |
| Wrangler `compatibility_date` | 3× `wrangler.toml` | `2026-03-01` |
| `compatibility_flags` | 3× `wrangler.toml` | `["nodejs_compat"]` |
| Prisma generator | `schema.prisma` | `prisma-client`, `compilerBuild=fast` |
| TS target / lib | root `tsconfig.json` | `ESNext` / `ESNext,DOM` |
| Biome schema | `biome.json` | `2.4.4` |
| Turbo schema | `turbo.json` | `turbo.build/schema.json` (`ui: tui`) |

---

## 2. Tier A — STABILIZE: you're pinned to a pre-release *older than* the current stable

These are the most important and lowest-risk: you are sitting on canary/alpha/dev/rc builds that **predate the GA release**, so you're missing months of fixes (including security) for **zero feature gain**. Moving to stable is a pure win, trivial effort.

| Package | Current (pre-release) | → Target (GA stable) | Effort | Why it matters |
|---|---|---|---|---|
| **next** | `16.2.0-canary.69` | **`16.2.9`** | trivial | canary.69 **predates 7+ high-severity security fixes** in 16.2.5/16.2.6 (DoS, cache-tag, form-data, server-action loops). Same minor; webpack build unaffected. |
| **prisma** / `@prisma/client` / `@prisma/adapter-neon` | `7.5.0-dev.33` | **`7.8.0`** | trivial | Pure additive (7.6/7.7/7.8). New `queryPlanCacheMaxSize`; Postgres jsonb/equality-filter bug fixes. No schema edits. |
| **pnpm** | `11.0.0-alpha.11` | **`11.9.0`** | low | Alpha predates GA fixes incl. `--ignore-workspace` overwriting `allowBuilds` (you hit this before). Pin exact GA in `packageManager` + CI. |
| **radix-ui** | `1.4.4-rc.176...` | **`1.6.0`** | trivial | Unified import API unchanged. React-19/RSC hardening, Slot 1.3 nested-slottable. |
| **@upstash/redis** | `1.37.0-rc.12` | **`1.38.0`** | trivial | Stabilize the rc across root/web/api. |
| **@apollo/client** | `4.2.0-alpha.0` | **`4.2.3`** | trivial | Off the alpha; codebase already AC4-idiomatic. 4.2.3 adds graphql v17 peer support. |
| **zod** | `4.4.0-canary.20260125` | **`4.4.3`** | low | **Your canary is a Jan snapshot that predates 4.4.0 GA (Apr 29)** — 2nd-oldest in the whole tail. See §4 for the stricter URL/base64/`.merge()` behavior to verify. |
| **vitest** / `@vitest/ui` | `4.1.0-beta.5` | **`4.1.9`** | trivial | Beta → GA + 9 patch releases. (v5 beta = Tier C.) |
| **turbo** | `2.8.13-canary.8` | **`2.9.18`** | trivial | Modern `tasks` schema already in use; `turbo query` now stable; up-to-96% faster startup. |
| **@vercel/analytics** | `2.0.0-canary.1` | **`2.0.1`** | trivial | Stabilize. |
| **@vercel/speed-insights** | `2.0.0-canary.1` | **`2.0.0`** | trivial | Stabilize. |
| **sharp** | `0.35.0-rc.0` | **`0.35.2`** | trivial | Off the rc. |
| **typescript** | `6.0.0-dev.20260301` | **`6.0.3`** | trivial | Dev → GA no-op; tsconfig already opts into all TS6 features. (TS7 RC = Tier C.) |
| **next-auth** | `5.0.0-beta.30` | **`5.0.0-beta.31`** | trivial | Only bumps `@auth/core` 0.41.0→0.41.2 (GitHub RFC-9207 issuer, stricter email validation). v5 has no GA yet, so newest beta is correct. |

---

## 3. Tier B — UPGRADE: real features / fixes, additive, low effort

| Package | Current | → Target | Effort | Headline of what changed |
|---|---|---|---|---|
| **mathjs** | `15.1.1` | **`15.2.0`** | trivial | ⚠️ **SECURITY: patches CVE-2026-40897 (RCE in expression parser)** + unsafe array-index getter. Also `num()`/`den()`, `Ah` unit. **Do this regardless of everything else.** |
| **wrangler** | `4.69.0` | **`4.104.0`** | trivial | 35 releases. `wrangler types` codegen, `createTestHarness()`, more auto-enabled `node:` modules. No config breakage. |
| **@cloudflare/workers-types** | `4.20260305.0` | **`4.20260624.1`** | trivial | Track wrangler. |
| **@biomejs/biome** | `2.4.4` | **`2.5.1`** | trivial | New nursery rules (`useNullishCoalescing`, a11y), `--reporter=concise`, perf. Group-enable now respects domains (verify §4). |
| **tailwindcss** / `@tailwindcss/postcss` | `4.2.1` | **`4.3.1`** | trivial | `scrollbar-*`, `zoom-*`, `tab-*`, logical inset utils, `font-features-*`, container-size queries, 4 new OKLCH palettes. Additive. |
| **katex** | `0.16.33` | **`0.17.0`** | trivial | Rendering/MathML fixes; `\underbracket`/`\overbracket`. Only internal `__defineFunction` changed (no custom funcs here). |
| **lucide-react** | `0.575.0` | **`1.21.0`** | **low** | **Major 0→1** but mechanical. 119 files use root named imports (safe). **Brand icons & deprecated aliases removed** (`XCircle`→`CircleX`). Run `npx @lucide/codemod migrate-from-0.x`. `aria-hidden` now defaults true. |
| **three** / `@types/three` | `0.183.2` / `0.183.1` | **`0.184.0`** / **`0.184.1`** | **low** | ~3× faster TSL compile, fewer per-frame allocs — **but real TSL renames** confined to `plot-engine/src/renderers/webgl-3d.ts`: `label()`→`setName()`, blend funcs→`blendBurn/...`, `shadowWorldPosition`→`shadowPositionWorld`, `colorBufferType`→`outputBufferType`, `RGBELoader`→`HDRLoader`, loaders `.load()` no longer returns. See §4. |
| **framer-motion** | `12.34.3` | **`12.41.1`** | trivial | Additive: `animateView` graduated, OKLCH/`color-mix`/`light-dark()` interpolation, **fixes a Windows+Next OOM build bug**. (v13 alpha = Tier C; eventual `motion` package rename noted.) |
| **next-intl** | `4.8.3` | **`4.13.0`** | trivial | per-domain `localePrefix`, `transitionTypes` on `<Link>`, middleware hardening. For 1274×8 keys consider `precompile: true`. |
| **@apollo/server** | `5.4.0` | **`5.5.1`** | trivial | **CSRF hardening: GET requests now require `application/json`/`graphql+json` Content-Type** (verify your client GETs). Native `crypto.randomUUID`. |
| **@apollo/client-integration-nextjs** | `0.14.4` | **`0.14.5`** | trivial | Tracks client-react-streaming. |
| **@auth/prisma-adapter** | `2.11.1` | **`2.11.2`** | trivial | Patch. |
| **@sentry/nextjs** | `^10.40.0` | **`10.60.0`** | trivial | 20 minors: `dataCollection` option, R2 auto-instrumentation, array span attrs. `sendDefaultPii` deprecated (not used). |
| **nosecone** / `@nosecone/next` | `1.1.0` | **`1.5.0`** | trivial | arcjet-js version sync; no end-user API changes. |
| **modern-pdf-lib** | `0.15.1` | **`0.26.0`** | trivial | 11 minors, all additive for your usage: table engine, WebP/TIFF decoders, AES-256, sub-path exports. `embedPng` stays sync at 0.26 (becomes async at 0.27 — don't jump past 0.26 blindly). |
| **serwist** / `@serwist/next` | `9.5.6` | **`9.5.11`** | trivial | Pure patch. (v10 preview = Tier C.) |

---

## 4. ⚠️ Behavior changes to verify during upgrade (low effort, but not no-op)

These don't need rewrites but **could change runtime behavior** — worth a targeted test pass:

1. **Zod 4.4.x stricter validators** — `z.url()` rejects malformed URLs (e.g. `https:/example`), `base64` rejects whitespace, **`.merge()` now THROWS** if the receiving schema has refinements, required props declared via `z.undefined()` now require the key present. Audit all schemas in web/api/workers.
2. **Three.js r184 TSL renames** — concentrated in one file (`plot-engine/src/renderers/webgl-3d.ts`); also WebGPU shadow improvements may make existing `shadow.bias` values look wrong (likely remove them). Background/env-map rotation convention changed (visual).
3. **Apollo Server 5.5 CSRF** — GraphQL `GET` requests now require a JSON-ish Content-Type. Confirm the web client's persisted/GET queries send the right header.
4. **lucide-react v1** — removed brand icons + deprecated aliases; `aria-hidden` defaults to `true` (could silence icons you intended to announce).
5. **Biome 2.5 group-enable semantics** — setting a whole rule group now respects domain dependencies; re-run lint and diff the findings.
6. **next-intl 4.10.1** — sets redirect domain from `x-forwarded-host` if present (behind proxies).

---

## 5. Tier C — HOLD (newest exists, but adopting now is risky / blocked)

| Package | Newest available | Recommendation | Why hold |
|---|---|---|---|
| **graphql** | `17.0.1` (GA, 2026-06-16) | **Stay `16.13.0`** | **Ecosystem peer-dep blocker, not a code blocker.** Your own usage is already v17-shaped (options-object `GraphQLError`, no custom scalars, no removed APIs). But `@apollo/server@5.4.0` declares `graphql ^16.11.0` and only pinned experimental incremental-delivery to `17.0.0-alpha.2`. **Revisit when Apollo Server widens its peer range to `^17`** — then it's a low-effort bump. |
| **typescript** | `7.0.1-rc` (native Go compiler) | **Stay on 6.0.3** | TS 7's programmatic/compiler API is **deferred to 7.1** (not in the RC) — `typedoc`, `ts-` tooling, and codegen would break. Can install side-by-side (`@typescript/typescript6`) to trial `tsgo` (~10× faster typecheck) without committing. |
| **@types/node** + Node runtime | `26.0.0` / Node `26.3.1` | **Stay Node 24.18 LTS** (`@types/node ~24`) | Node 26 removes `_stream_*`, `writeHeader()`, `--experimental-transform-types`; **`NODE_MODULE_VERSION` 147 → all native addons (sharp, workerd, prisma engines) must rebuild**; raised toolchain floor. Pin `@types/node` to the runtime you actually run. |
| **framer-motion** | `13.0.0-alpha.0` | **Stay 12.41.1** | No published changelog/upgrade guide for v13 yet. |
| **vitest** / `@vitest/ui** | `5.0.0-beta.5` | **Stay 4.1.9** | v5 removes `vitest/coverage|reporters|environments` entry points, rewrites bench API, `test.sequential` removed, raises Node floor. Wait for GA. |
| **rxjs** | `8.0.0-alpha.14` | **Stay 7.8.2** (already latest stable) | v8 is alpha-only. *(Side note: worth checking whether rxjs is still needed at all in web.)* |
| **serwist** / `@serwist/next` | `10.0.0-preview.14` | **Stay 9.5.11** | Preview only; v10 direction (Turbopack-native `@serwist/turbopack`) not stable. |
| **modern-pdf-lib** | `0.27.0` | **Target 0.26.0** | 0.27 makes `embedPng()` async — a real signature change. Stop at 0.26. |

---

## 6. Infrastructure

### GitHub Actions (3 of 4 are behind)
| Action | Current | Newest | Note |
|---|---|---|---|
| `actions/checkout` | `v6` | **`v7`** (2026-06-18) | Major: ESM migration + **fork-checkout security change** — review any `pull_request_target`/`workflow_run` jobs before bumping. |
| `actions/setup-node` | `v6` | `v6.4.0` | ✅ Already newest major. |
| `pnpm/action-setup` | `v4` | **`v6`** (`v6.0.9`) | **Two majors behind.** v6.0.9 bundles pnpm 11.7.0 — aligns with your pnpm 11 toolchain. |
| `actions/cache` (+save/restore) | `v5` | **`v6`** (2026-06-23) | Major: ESM migration. Apply to all three uses. |

### Emscripten — **2.5 years / 3 major versions behind**
`emscripten/emsdk:3.1.51` (late 2023) → **`6.0.1`** (2026-06-22). Crossed 4.0 → 5.0 → 6.0; LLVM ~17 → **21.1.8**. For the plain-C MPFR/GMP → WASM build here, migration risk is **low** (compile path stable; main changes are default-on WASM features + browser baseline Safari 14.1/Chrome 85). **Pin `6.0.1`** (not `:latest`) for reproducible builds.

### Wrangler `compatibility_date`
`2026-03-01` → **`2026-06-18`** (Cloudflare recommends current-as-of-deploy). **Keep `nodejs_compat`** — it auto-enables `nodejs_compat_v2` (date ≥ 2024-09-23); do **not** add `nodejs_compat_v2` manually. Newer dates auto-enable more `node:` modules (`readline`, `perf_hooks`, `child_process`, etc.).

---

## 7. Routine patch/minor bumps (low-risk, batch together)

`@axe-core/playwright` 4.11.2→4.12.1 · `axe-core` 4.11.1→4.12.1 · `@playwright/test` 1.59-alpha→1.61.1 · `@types/react` 19.2.14→19.2.17 · `hono` 4.12.3→4.12.27 · `jose` 6.1.3→6.2.3 · `ws` 8.19.0→8.21.0 · `tsx` 4.21.0→4.22.4 · `happy-dom` 20.7.0→20.10.6 · `immer` 11.1.4→11.1.8 · `fast-check` 4.5.3→4.8.0 · `zustand` 5.0.11→5.0.14 · `dotenv` 17.3.1→17.4.2 · `tailwind-merge` 3.5.0→3.6.0 · `@tanstack/react-virtual` 3.13.19→3.14.3 · `lighthouse` 13.0.3→13.4.0 · `@neondatabase/serverless` 1.0.2→1.1.0 · `@cf-wasm/resvg` 0.3.3→0.3.4 · `graphql-tag` 2.12.6→2.12.7 · `graphql-ws` 6.0.7→6.0.8 · `@webgpu/types` 0.1.69→0.1.70 · `typedoc` 0.28.17→0.28.19 · `@graphql-codegen/cli` alpha→7.1.3 · `@graphql-codegen/typescript(-resolvers)` alpha→6.0.2 · `@graphql-tools/*` (merge 9.1.9, schema 10.0.33, utils 11.1.0, graphql-file-loader 8.1.14, load 8.1.10).

**Already newest (no action):** `@as-integrations/next` 4.1.0 · `@graphql-typed-document-node/core` 3.2.0 · `@testing-library/{react,jest-dom,user-event}` · `@types/{d3,jest-axe,katex,react-dom,ws}` · `@upstash/ratelimit` 2.0.8 · `chrome-launcher` · `class-variance-authority` · `clsx` · `d3` 7.9.0 · `dataloader` · `graphql-{scalars,sse,subscriptions}` · `gray-matter` · `jest-axe`.

---

## 8. Security callouts (do these even if you upgrade nothing else)

1. **mathjs → 15.2.0** — RCE (CVE-2026-40897) in the expression parser. Used in api + cas-service + math-engine + web.
2. **next → 16.2.9** — your canary.69 predates 7+ high-severity fixes (DoS, server-action loops).
3. **react/react-dom** — RSC security hardening landed on the 19.3 canary line since your Feb pin.

---

## 9. Recommended Phase 2 approach

A **staged, verifiable upgrade**, not a blind 215K-line rewrite:

- **Stage 1 — Security + stabilize (½ day, near-zero risk):** mathjs, next→16.2.9, prisma→7.8.0, pnpm→11.9.0, radix-ui→1.6.0, all the canary/alpha/rc→GA pins (Tier A), routine bumps. One `pnpm install`, typecheck, test, lint.
- **Stage 2 — Feature upgrades w/ behavior verification (1–2 days):** Tier B + the §4 verification items. lucide codemod, Three.js TSL renames in the one renderer file, Zod strictness audit, Apollo Server CSRF check, Biome 2.5 re-lint.
- **Stage 3 — Infra (½ day):** GitHub Actions majors, Emscripten 6.0.1, Wrangler compat date + `wrangler types`.
- **Stage 4 — Selective idiom modernization (optional, scoped):** adopt new idioms where they add value (React `<Activity>`/`<ViewTransition>` on heavy plot/solver routes, `useEffectEvent`, Tailwind logical/scrollbar utils, Turbo `query affected` in CI, Prisma `queryPlanCacheMaxSize`). This is the only part that touches many files — and should be done per-package with review, not all at once.
- **Hold (Tier C):** graphql 17, TS 7, Node 26, vitest 5, framer-motion 13, rxjs 8, serwist 10 — revisit when their blockers clear.

Every stage gated by `turbo run typecheck test lint build`.
