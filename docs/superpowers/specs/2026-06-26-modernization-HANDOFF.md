# NextCalc Modernization — HANDOFF / PICKUP

**Branch:** `modernization/foundation` · **Updated:** 2026-06-27 · **State:** clean tree, **ahead of `main`**, **pushed → PR #50 OPEN** (https://github.com/ABCrimson/NextCalc/pull/50).
**This is the active resume doc for PR #50.** The modernization narrative + per-package version delta now live canonically in [`CHANGELOG.md`](../../../CHANGELOG.md) (**[Unreleased]**) and the remaining QA/provisioning in [`docs/ROADMAP.md`](../../ROADMAP.md); the earlier working specs (RESUME / design / baseline) and `VERSION-AUDIT` were consolidated into those and removed. Delete this file when PR #50 merges.

> ## ▶ HOW TO RESUME (do these first, in order)
> 1. Read this whole file.
> 2. `git log --oneline main..HEAD` (see §4 for the annotated list).
> 3. Recreate the live task tracker from **§9** (TaskCreate) and keep it updated as you go.
> 4. **Re-verify "newest" versions** for any pending bump (§8) — versions move daily; the whole project targets the *absolute newest*.
> 5. The planned modernization is **functionally complete**; what remains is **deploy/provisioning + two broken upstream packages** (§6/§7). Pick the next item from §7.

---

## 0. TL;DR — modernization is FUNCTIONALLY COMPLETE (2026-06-27)

Everything planned is done, gate-green at every commit, and shipped to **PR #50**. Summary:
- **Waves 1/R/2/3** (push-to-newest deps + newest idioms) + **i18n `useFormatter`** — DONE (prior sessions; see git log).
- **Lint sweep P0–P5: 2,222 warnings + 221 infos → 0 warnings + 1 unavoidable info.** noNonNull 1612→0 (decision-#21a hybrid: scoped override for numeric hot-paths + 22 real masker fixes); all correctness / a11y / array-keys / perf-security real-fixed or principled-override; `!**/*.svg` excluded; `useLiteralKeys` disabled (conflicts with `noPropertyAccessFromIndexSignature`).
- **Wave 4** — `@types/node` → 26.0.1 + CI Node 24→26 (engines.node stays ≥24 for Vercel); **TS7 `tsgo` advisory `typecheck:fast`** (non-blocking CI job, 12/12 GREEN — the repo is already TS7-forward-compatible); gate compiler `tsc 6.0.0-dev → 6.0.3 GA`.
- **Polish** — katex renderer dedup (→ cached `ui/math-renderer`); real `.scrollbar-none` utility. SKIPPED with rationale: tailwind scrollbar-util migration (no plugin; the repo already uses standard `html{scrollbar-color/width}`), tabular-nums (calculator displays are already `font-mono`), three half-res AO (`scenePass.setResolutionScale(0.5)` halves the WHOLE pass, not just AO — needs a separate downsampled pass; deferred to visual QA).
- **Dogfood** — **command palette → modern-cmdk 1.1.5** ✅ (Playwright-verified in a real browser: opens, fuzzy-filters, glass styling, zero errors); **export-service tagged-PDF alt-text + `deduplicateImages`** via **modern-pdf-lib 0.40.2** ✅ (uses the new `tagFigure()` helper + `compressionLevel: 9`; runtime-verified the output carries `/MarkInfo` `/Marked true` `/StructTreeRoot` `/Figure` `/Alt` `/Lang`).
- Recurring theme: **adversarial verification caught real regressions the gate alone would have shipped** (an autofix rewriting procedural star-field seeds to `Math.PI`/`LN10`; a dropped `.map` index still used for animation delay; agent a11y fixes that satisfied biome but broke axe-core `role=grid`/`ul>li`). Keep doing that.

**⚠️ TWO of our own packages are BROKEN AS PUBLISHED (upstream blockers, not our code — §6):**
- **modern-xlsx 1.0.0 + 1.0.0-rc.1** — ship NO wasm-bindgen glue (`dist/../wasm/modern_xlsx_wasm.js` is missing; only the raw `.wasm`); they fail to import in Node AND fail to bundle in Turbopack via every entry (`.`/`./lite`/`./browser`). The XLSX-export dogfood is wired-correct but **REMOVED** until fixed. ACTION: ship the wasm-bindgen `.js` glue (or an all-JS build).
- **modern-pdf-lib (through 0.40.2)** — still ships NO `.wasm` and no inline WASM (`hasInlineWasmData()` === false), so `initWasm` ENOENTs and always falls back to pure-JS (valid output, no acceleration). ACTION: ship/inline the `.wasm` (e.g. `dist/wasm/libdeflate/modern_pdf_deflate_bg.wasm`) — our lazy `initWasm({png,deflate})` then upgrades for free.

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

## 6. BROWSER/DEPLOY QA — RESULTS (2026-06-27, via Playwright + `wrangler dev`)

1. **Lorenz GPU particles** — ✅ **FULLY VERIFIED.** The sandbox Chromium *has* WebGPU, so this was driven in a real browser: `/chaos` → "Particles" renders **50K particles** as a distributed cloud on a genuine WebGPU canvas, zero console errors. The distribution validates the Wave-3 `.toAttribute()` fix (the bug would collapse all 50K to vertex index 0).
2. **serwist 10 PWA** — ✅ **core verified**, ⚠️ **offline-fallback still UNVERIFIED.** SW registers, the 72 KB v10 worker is served, the `serwist-precache-v2` cache populates with revision-hashed entries. The offline-navigation fallback couldn't be reproduced **locally** because `git restore public/sw.js` desyncs the worker's precache manifest from the `next start` build (precache stalls → SW never activates). **Verify on the deployed site** (DevTools → Offline → reload). (Playwright MCP can emulate offline via `browser_run_code_unsafe` → `page.context().setOffline(true)`.)
3. **modern-pdf-lib WASM** — ✅ **characterized** via `wrangler dev` (local workerd = deploy runtime). The worker bundles + runs; `POST /export/pdf` returns a valid PDF. `initWasm` ALWAYS falls back to pure-JS because the package ships no `.wasm` (it does a filesystem `readAll`, impossible in workerd) — worst case = no acceleration, not a crash. The handler now logs WASM status for the deployed Worker's observability (`@cf-wasm/resvg`'s WASM *does* load — it's packaged for Workers).

---

## 7. REMAINING WORK (2026-06-27 — the big phases are DONE)

Waves 1–4, the full lint sweep, polish, dogfood, and QA are complete (PR #50). What's genuinely left needs **you / a deploy** or lives in **another repo**:

### Needs you / a deploy
- **serwist offline-fallback** — verify on the deployed PWA (§6.2).
- **modern-xlsx fix** (your pkg, BROKEN — §0) — ship the wasm-bindgen glue, then re-add the XLSX-export dogfood. Integration is documented in commit `bb9ef25`: `new Workbook()` → `wb.addSheet(name)` → `sheetAddAoa(ws, aoa)` → `writeBlob(wb)`, wired as an "XLSX spreadsheet" item in PlotExportToolbar's dropdown (one worksheet per function).
- **modern-pdf-lib WASM** (your pkg — §0) — ship/expose the `.wasm` for real acceleration (then pass `pngWasm`/`deflateWasm` bytes in `export-service/src/handlers/pdf.ts`).
- **Pre-existing provisioning** (§11): R2 secrets for private-export presigned URLs; MPFR/Emscripten in CI for real high-precision; real translations for the 7 non-English locales' placeholder keys.
- **Merge** PR #50 after CI + review.

### DONE this round (for reference)
- **Wave 4** ✅ — `@types/node` 26.0.1, CI Node 26 (engines stay 24), `tsgo` advisory `typecheck:fast` (non-blocking CI), gate `tsc 6.0.3`.
- **Lint sweep P0–P5** ✅ — 2222 warnings → 0; `noNonNullAssertion` hybrid override (decision #21a) landed in `biome.json`; the 3 old suppressions (chaos mount-effect / practice-mode / seed.ts) are subsumed by the now-clean sweep.
- **Polish** ✅ — katex dedup done; `.scrollbar-none` utility added; the rest descoped (§0).
- **Dogfood** ✅ — modern-cmdk command palette (verified); export-service tagged-PDF alt-text + `deduplicateImages` (modern-pdf-lib 0.29, verified). modern-xlsx blocked (§0).

### Optional / low priority (visual-QA-dependent)
- three half-res AO done *correctly* would need a separate downsampled AO pass (not `setResolutionScale` on the main pass); tailwind scrollbar utils + tabular-nums (low value).

---

## 8. NEWEST-VERSION REFERENCE — **RE-VERIFY at pickup** (versions move daily)

Query the registry before any bump: `node -e 'fetch("https://registry.npmjs.org/<pkg>").then(r=>r.json()).then(j=>console.log(j["dist-tags"]))'` and pick the absolute-newest in any channel.

**Landed (Wave 3, 2026-06-26):** lucide-react 1.21.0 · three 0.184.0 / @types/three 0.184.1 / @webgpu/types 0.1.71 · turbo 2.10.0 · wrangler 4.104.0 (@cloudflare/workers-types 4.20260624.1) · katex 0.17.0 (@types/katex 0.16.8) · next-intl 4.13.0 · tailwindcss + @tailwindcss/postcss 4.3.1 · serwist + @serwist/next 10.0.0-preview.14 · @biomejs/biome 2.5.1 · modern-pdf-lib 0.28.1.

**Landed (Wave 4 + dogfood, 2026-06-27):** @types/node 26.0.1 (all workspaces) · Node 26 in CI · @typescript/native-preview 7.0.0-dev.20260626.1 (advisory `tsgo`) · typescript 6.0.3 (gate) · modern-pdf-lib →**0.40.2** (export-service; `tagFigure`/`compressionLevel:9`) · **modern-cmdk 1.1.5** (command palette). NOT adopted: **modern-xlsx 1.0.0/rc.1** (broken dist — §0).

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
- `apps/api` — Apollo Server 5.5 GraphQL (`src/graphql/`, `src/lib/`).
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
- **Deferred to a deploy/merge:** the serwist offline-fallback smoke test (§6.2), the modern-xlsx / modern-pdf-lib upstream WASM fixes (§0), and the provisioning items (§11). The full remaining list is §7 — also mirrored in [`docs/ROADMAP.md`](../../ROADMAP.md).
- **Merge PR #50** after CI + review.
