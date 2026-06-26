# NextCalc Modernization — HANDOFF / PICKUP

**Branch:** `modernization/foundation` · **Date:** 2026-06-26 · **State:** clean tree, **30 commits ahead of `main`**, nothing pushed.
**This is the canonical resume doc — it supersedes `2026-06-24-modernization-RESUME.md`.**

> ## ▶ HOW TO RESUME (do these first, in order)
> 1. Read this whole file.
> 2. `git log --oneline main..HEAD` (see §4 for the annotated list).
> 3. Recreate the live task tracker from **§9** (TaskCreate) and keep it updated as you go.
> 4. **Re-verify "newest" versions** for any pending bump (§8) — versions move daily; the whole project targets the *absolute newest*.
> 5. Continue at **Wave 4** (§7).

---

## 0. TL;DR

- **Wave 3 — the entire push-to-newest dependency modernization — is COMPLETE** (9 items, each gate-green + committed this session), plus the **next-intl `useFormatter` i18n bug fix**.
- **NEXT (in order):** Wave 4 (Node 26 + TypeScript 7 `tsgo` side-by-side) → the ~500 lint-warning cleanup → minor visual-QA polish.
- **3 changes need browser/deploy QA** (can't be verified headlessly): Lorenz GPU particles, serwist PWA, modern-pdf-lib WASM. See §6.
- Recurring theme this session: parallel research + **adversarial verification + diff review caught 5 real bugs** that all compile cleanly and the gate alone would have shipped. Keep doing that.

---

## 1. EVERGREEN / BLEEDING-EDGE PRINCIPLES (non-negotiable — the soul of this project)

1. **Push-to-newest (absolute newest in ANY channel).** Target the newest published version in any channel — canary / beta / rc / dev / nightly / preview / alpha — NOT a GA/stable floor. This supersedes the old GA-first staging. When a stale dep blocks a newer one, build a custom unblock (e.g., the GraphQL-17 adoption via a `pnpm-workspace.yaml` peer override; no fork needed). "Think outside the box."
2. **Adopt-newest-IDIOMS, not just versions.** On every bump, *rewrite our code to that version's newest idioms, recommended APIs, new features, performance patterns, and (for UI libs) aesthetic capabilities* — do NOT stop at "make the old code compile." If code was written for vX and we move to vY, write it the vY way. **Pair two research passes per risky dep: (a) breaking-change/migration, (b) modernization-idioms.**
3. **Real fixes only.** No `as any` / `as unknown as` / `@ts-ignore` / `@ts-expect-error` / rule-disabling / silencing `!`. Fix root causes. (The only pre-existing `error`-level Biome rules are `noExplicitAny` + `noImplicitAnyLet`; everything else is `warn`.)
4. **Dynamic tracker, always.** Keep a live task tracker (TaskCreate/TaskUpdate) populated for all multi-step work; mark `in_progress` when starting, `completed` when gate-green + committed. Recreate it from §9 after `/clear`.
5. **Adversarially verify.** For anything that can break *silently* (compiles clean but wrong at runtime/visually), use independent verification (a skeptic sub-agent, cross-checking against the library's actual source/`.d.ts`, etc.) and review every sub-agent diff yourself. The gate (tsc/biome/build) does NOT catch behavior/visual regressions.
6. **Our own packages.** The user (GitHub **ABCrimson** / Albert Badalov) authored three npm packages — treat as ours: **modern-cmdk**, **modern-xlsx**, **modern-pdf-lib**. Only `modern-pdf-lib` is used here (export-service). `modern-cmdk` ↔ the hand-rolled command palette and `modern-xlsx` ↔ a future XLSX export are natural dogfood targets (not yet adopted).

---

## 2. THE VERIFICATION GATE (exact protocol — never claim done without it)

```
# Gate (must be 21/21). Terminates cleanly:
pnpm turbo run typecheck lint build --continue
# Then tests, per-package (the turbo-wide `test` HANGS on vitest cleanup — known; CI uses timeout 300 -> exit 124 = ok):
pnpm --filter @nextcalc/<pkg> exec vitest run
```

- **21/21** = all of {typecheck, lint, build} × workspaces. Lint = `biome check .` per workspace; it fails only on `error`-level diagnostics (warnings/infos are fine — there are ~870 warnings in web, that's expected and is the "c" backlog).
- **`apps/web/public/sw.js` (+ `.map`) regenerate on every `next build`** — `git restore apps/web/public/sw.js apps/web/public/sw.js.map` BEFORE committing (don't commit the churn). The committed snapshot is a stale serwist-9 artifact; CI/Vercel regenerate the real serwist-10 worker on deploy.
- **Stage explicit paths** (`git add <path>...`), never `git add -A` — sub-agents/verification can leave stray working-tree changes. `git status` + review the diff first.
- **Biome autofix is SAFE only without `--unsafe`**: `pnpm exec biome check --write <files>` (formatting + organizeImports + safe lint). **NEVER `--unsafe`** (it rewrites `arr[i]!`→`arr[i]?.` and index-signature access, breaking strict mode). For a hand-written file that fails lint on formatting/import-order, biome-fix just that file.
- **Commit trailer (every commit):** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Commit per logical item, gate-green, with a body explaining the *why* + the verification result.

---

## 3. OPERATIONAL ENVIRONMENT (Windows specifics)

- **pnpm is on PATH only in the PowerShell tool** (`pnpm@11.0.0-alpha.11`), NOT in the Bash tool. Node: `C:\Program Files\nodejs\node.exe` (v26 nightly) and `C:\nvm4w\nodejs\node.exe` (v24.8.0).
- **`pnpm install` mutates the shared lockfile + node_modules** — do NOT run it while a sub-agent is running typecheck/tests (race). Serialize installs; file-only edits can overlap a read-only agent on different files.
- **pnpm peer overrides live in `pnpm-workspace.yaml`** (`overrides:` / `peerDependencyRules:`), NOT package.json. **Current overrides:** `react`/`react-dom` `19.3.0-canary-99e86060-20260623`, `rxjs` `8.0.0-alpha.14`, `graphql` `17.0.1` (+ `peerDependencyRules.allowedVersions` for rxjs 8 / graphql 17).
- Monorepo: pnpm workspaces + Turborepo. Workspaces: `apps/web` (Next 16), `apps/api` (Apollo Server 5), `apps/workers/{cas-service,rate-limiter,export-service}` (Cloudflare Workers), `packages/{math-engine,plot-engine,database,types}`. (`packages/database` = shared Prisma 7.)
- Workers have NO `build` script (gate = typecheck + lint; bundling happens at `wrangler deploy`, NOT gated).
- After adding any devDependency, run `pnpm install` to refresh the lockfile before committing (CI uses `--frozen-lockfile`).

---

## 4. DONE THIS SESSION (annotated; SHAs)

All gate-green 21/21 + tests. Prior sessions: fake-fix initiative (26 findings) + push-to-newest Wave 1/R/2 (react 19.3-canary, vitest 5, rxjs 8, **GraphQL 17 via override**, mathjs RCE-CVE, ~60 pkgs).

| SHA | Item | What / why |
|---|---|---|
| `5173d01` | **lucide-react 0.575→1.21.0** | 1.x removed brand icons → inline GitHub mark + 4-color Google "G" in `auth/signin/page.tsx`. (lucide usage already idiomatic otherwise.) |
| `72ee1da` | **three 0.183.2→0.184.0** (+ @types/three 0.184.1) | r184 made GTAONode write AO to the **RED channel only (RedFormat)**; SSAO blend in `plot-engine/.../webgl-3d.ts` now reads `aoPass.getTextureNode().r` (was multiplying full RGBA → red-tinted/broken SSAO — **silent**, caught by adversarial verify). plot-engine now declares its own `@webgpu/types` (0.184 dropped the triple-slash ref). |
| `3e6ad48` | **Lorenz raw-WebGPU compute → TSL compute** | `instancedArray`+`Fn`+`renderer.computeAsync(node.compute())`+`PointsNodeMaterial`; removed CPU readback + the `renderer as unknown as {backend}` cast. **Review fix:** render nodes use `.toAttribute()` NOT `.element(instanceIndex)` (instanceIndex===0 for non-instanced `THREE.Points` → would collapse all particles). |
| `60bd384` | **turbo 2.8.13-canary→2.10.0, wrangler 4.69→4.104** | + turbo task `description`s. `$TURBO_ROOT$` is INVALID in `globalDependencies` (leading `$` = env var). wrangler.toml already modern. |
| `2c62397` | **katex 0.16.33→0.17.0, tailwind+postcss 4.2.1→4.3.1, next-intl 4.8.3→4.13.0** | **3 real bugs fixed:** (a) tailwind `dark:` was keyed to `prefers-color-scheme`, disconnected from the `[data-theme]` toggle → added `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`; (b) katex forced `output:'mathml'` → default `htmlAndMathml`; (c) next-intl: `hasLocale()`+`notFound()`, dropped `getMessages()`+`messages` prop, `<html lang>` via `getLocale()` in root layout. |
| `f6ec2df` | **@biomejs/biome 2.4.4→2.5.1** (5 manifests) | `biome migrate` emits `linter.rules.preset` which 2.5.1's own `check` REJECTS → kept `recommended:true`. 2.5.1 `organizeImports` now sorts `export {}` lists (auto-fixed 8 files). |
| `c6bc839` | **serwist 9.5.6→10.0.0-preview.14 + createSerwist** | `sw.ts` off the v10-deprecated `new Serwist(...)` to `createSerwist({precache:{entries,cleanupOutdatedCaches,concurrency},…,extensions:[new RuntimeCache(defaultCache,{fallbacks})]})`+`addEventListeners`. Verified build injects manifest (395 entries). |
| `bdb3510` | **modern-pdf-lib 0.15.1→0.28.1** (OUR pkg) | Major release (full WASM PDF engine). `embedPng` now async (awaited); `save({objectStreamThreshold:100, useWasm:true})`; `setLanguage('en')`; best-effort `initWasm({png,deflate})` (pure-JS fallback). Updated test mocks. |
| `5c9654e` | **i18n `useFormatter` sweep** | ~30 hardcoded `'en-US'` formats → `useFormatter()` (client) + optional `locale` param on pure utils. Caught + fixed a caller the sub-agent missed (`post-detail-client.tsx`). |

(Plus docs commits `89a856d`, `10362a3`, `ba4434c`, and earlier `bd4bb7e`/`6c061fc`.)

---

## 5. GOTCHAS CATALOG (traps already hit — don't rediscover them)

- **turbo:** `$TURBO_ROOT$` works in task `inputs`/`outputs` but NOT in `globalDependencies` (a leading `$` there is parsed as an env-var reference → "cannot contain an environment variable").
- **biome 2.5.1:** its own `migrate --write` produces `linter.rules.preset` which its own `check` rejects as an unknown key — **keep `recommended:true`** (deprecated but valid). Also `organizeImports` now sorts `export {}` member lists → surfaces as ERROR-level `assist/source/organizeImports` (auto-fixable via `biome check --write`).
- **three r184:** GTAONode AO is **red-channel only** (RedFormat) — read `.r`. And `@types/three` 0.184 dropped the triple-slash `@webgpu/types` reference, so any package using WebGPU globals (`GPUBufferUsage`, etc.) must declare `@webgpu/types` itself + add it to tsconfig `compilerOptions.types`.
- **three TSL Points:** for a non-instanced `THREE.Points`, the per-point index in `positionNode`/`colorNode` is the VERTEX index — use `storageBuffer.toAttribute()` (documented idiom) NOT `.element(instanceIndex)` (which is 0 for all points). `instanceIndex` IS correct inside the compute kernel.
- **serwist 10 createSerwist:** `createSerwist({ precache: { entries, cleanupOutdatedCaches, concurrency }, skipWaiting, clientsClaim, navigationPreload, disableDevLogs, extensions })`; runtime caching + fallbacks → `new RuntimeCache(entries: RuntimeCaching[], { fallbacks })`; then `addEventListeners(serwist)`. `@serwist/next` `withSerwistInit` + tsconfig typings unchanged in v10. v10 is a PREVIEW.
- **modern-pdf-lib 0.28:** `embedPng()` and `save()` are async; `PdfSaveOptions.objectStreamThreshold=100` for size; `setLanguage()`; `initWasm()` is a root export; the dist `.d.mts` re-exports types from `pdfDocument-*.mjs`. Always inspect the installed `.d.ts` (it's our pkg, no public changelog).
- **next-intl util pattern:** pure `.ts` helpers can't use hooks — give them an optional `locale?: string` param and have client callers pass `useLocale()`. Grep ALL callers when changing a shared helper's signature (optional param = no compile error if a caller is missed → silently un-localized).
- **vitest + next-intl:** components using `useFormatter`/`useTranslations` need a `vi.mock('next-intl', importOriginal …)` in `apps/web/vitest.setup.ts` that spreads `...actual` (preserve `NextIntlClientProvider`/`hasLocale`) and stubs only the hooks.

---

## 6. PENDING USER QA (cannot be verified headlessly — flag to user)

1. **Lorenz GPU particles** (`/[locale]/chaos` → "Particles" toggle): the raw-WebGPU→TSL-compute rewrite is typecheck/build-verified only. Confirm in a **WebGPU browser**: particle motion + speed-based coloring, the WebGPU 1px point-size clamp, first-frame init timing.
2. **serwist 10 PWA**: build injects the manifest (verified), but runtime PWA behavior (offline fallback `/~offline`, runtime caching) needs a browser smoke test. v10 is a preview.
3. **modern-pdf-lib WASM**: confirm `initWasm({png,deflate})` actually loads in the **deployed Cloudflare Worker** (auto-falls-back to pure-JS if not, so worst case = no acceleration, not a crash).

---

## 7. REMAINING WORK — IN ORDER (exhaustive)

### Wave 4 — Node 26 + TypeScript 7 `tsgo` (side-by-side; touches CI matrix; do FIRST)
- **@types/node → 26** (devDep in every workspace; currently 25.3.3). + Node 26 for dev/CI: bump `NODE_VERSION` in `.github/workflows/*`. **Keep `engines.node` at Node-24 on shipped apps** (`apps/web`, `apps/api`) — Vercel Functions cap at 24.x.
- **TypeScript 7 `tsgo` advisory typecheck:** add `@typescript/native-preview` (newest dev) as a devDep + a NON-blocking `typecheck:fast` turbo task (`tsgo --noEmit`) + a CI job. **The gate STAYS on `tsc` 6** — tsgo's programmatic API is incomplete and breaks typedoc/graphql-codegen; treat tsgo as advisory only. Add explicit `rootDir`+`types` to emitting tsconfigs first if needed.
- Also reconsider the **gate compiler**: repo is on `typescript@6.0.0-dev.20260301`; GA `6.0.3` now exists and `7.0.1-rc` exists. Per push-to-newest, evaluate bumping the 6.x dev → newest 6.x (or the rc), keeping the gate stable.

### "c" — the ~500 lint warnings (large; after Wave 4)
- Drive Biome warnings to zero with **real** fixes (a11y attributes, correct hook deps, remove dead code, `Number.isFinite`, stable keys). Inventory per workspace: `pnpm exec biome check --diagnostic-level=error .` (note: error-level now includes the 2.5.1 export-sort assist — auto-fixable).
- **`noNonNullAssertion` (the big bucket):** decision #21a = **hybrid** — fix the few genuine maskers; a scoped, documented `biome.json` override for provably-safe math hot-paths (`arr[i]!`). Do NOT blanket-suppress.
- 3 pre-existing suppressions to revisit: chaos mount-effect, practice-mode `handleComplete` circular-dep, `seed.ts` dynamic-createData `any`.

### Polish (visual-QA-dependent; lowest priority)
- **katex:** consolidate the duplicate `components/math/latex-renderer.tsx` into the cached `components/ui/math-renderer.tsx` (single renderer, shared import cache).
- **tailwind:** replace the hand-rolled scrollbar base CSS with v4.3 `scrollbar-*` utilities + `scrollbar-gutter-stable`; add `tabular-nums` to calculator numeric displays.
- **three:** `scenePass.setResolutionScale(0.5)` for half-res AO (perf); lower GTAO `radius`/`scale` to compensate for r184's darker physically-correct AO. (Both need visual QA.)
- **modern-pdf-lib (our pkg):** tagged-PDF *alt-text* for the math image (the LaTeX source) via the structure-tree/marked-content API; `deduplicateImages(doc)` in the batch path. (Optional enhancements.)

### Dogfood opportunities (optional; ask user)
- Migrate the hand-rolled command palette (`components/layout/command-palette.tsx`) → **modern-cmdk**.
- Add an XLSX export path (currently CSV/pdf/png/svg only) → **modern-xlsx**.

---

## 8. NEWEST-VERSION REFERENCE — **RE-VERIFY at pickup** (versions move daily)

Query the registry before any bump: `node -e 'fetch("https://registry.npmjs.org/<pkg>").then(r=>r.json()).then(j=>console.log(j["dist-tags"]))'` and pick the absolute-newest in any channel.

**Landed this session (for reference):** lucide-react 1.21.0 · three 0.184.0 / @types/three 0.184.1 / @webgpu/types 0.1.71 · turbo 2.10.0 · wrangler 4.104.0 (@cloudflare/workers-types 4.20260624.1) · katex 0.17.0 (@types/katex 0.16.8) · next-intl 4.13.0 · tailwindcss + @tailwindcss/postcss 4.3.1 · serwist + @serwist/next 10.0.0-preview.14 · @biomejs/biome 2.5.1 · modern-pdf-lib 0.28.1.

**Wave-4 targets (re-verify):** @types/node 26.0.1 · Node 26 · @typescript/native-preview 7.0.0-dev.20260624.1 · typescript (gate stays 6.x; GA 6.0.3 / rc 7.0.1-rc exist).

**Active pnpm overrides (don't drop):** react/react-dom 19.3.0-canary-99e86060-20260623 · rxjs 8.0.0-alpha.14 · graphql 17.0.1.

---

## 9. TASK TRACKER TO RECREATE (after /clear — dynamic tracker)

`/clear` wipes the live tracker. Recreate these via TaskCreate, then keep them updated (`in_progress` on start, `completed` on gate-green+commit):

1. **Wave 4a — @types/node → 26 (all workspaces) + Node 26 dev/CI** (keep engines.node 24 on shipped apps).
2. **Wave 4b — TS7 `tsgo` side-by-side** (`@typescript/native-preview` devDep + non-blocking `typecheck:fast` task + CI job; gate stays on tsc 6). Consider gate-compiler bump to newest 6.x.
3. **"c" — drive ~500 Biome warnings to zero** with real fixes (hybrid noNonNullAssertion).
4. **Polish — katex renderer dedup; tailwind scrollbar utils + tabular-nums; three half-res AO** (visual QA).
5. **(optional) dogfood modern-cmdk (command palette) + modern-xlsx (XLSX export).**

---

## 10. ARCHITECTURE MAP (where things live)

- `apps/web` — Next 16 frontend. i18n: 8 locales (`i18n/routing.ts`, `proxy.ts`); `app/[locale]/layout.tsx` (locale layout), `app/layout.tsx` (root `<html lang>`). Tailwind v4 CSS-first OKLCH tokens in `app/globals.css`. PWA: `app/sw.ts` + `next.config.ts` `withSerwistInit`.
- `apps/api` — Apollo Server 5.4 GraphQL (`src/graphql/`, `src/lib/`).
- `apps/workers/*` — 3 CF Workers; `export-service/src/handlers/pdf.ts` uses **modern-pdf-lib**; `wrangler.toml` per worker.
- `packages/plot-engine` — Three.js (WebGPU/TSL) renderers; `src/renderers/webgl-3d.ts` (surface/3D + SSAO), `webgpu-2d.ts`.
- `packages/math-engine`, `packages/database` (Prisma 7, `@nextcalc/database`), `packages/types`.

---

## 11. PENDING PROVISIONING (need user — not blockers for code work)

- **R2 secrets** (export-service) for private-export presigned URLs in prod: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL` (public exports work without).
- **MPFR WASM** (Emscripten in CI) to make high-precision real (currently honest-"unavailable").
- **i18n:** the 7 non-English locales likely hold English placeholders for the `forum.loadError`/`loadErrorHint` keys — real translations needed.

---

## 12. NOT YET DONE / EXPLICITLY DEFERRED
- The branch is **not pushed**; no PR. (User to decide: push / PR / keep local.)
- Lorenz/serwist/pdf-lib runtime QA (§6).
- Everything in §7.
