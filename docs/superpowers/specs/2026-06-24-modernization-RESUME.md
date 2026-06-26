# Modernization — RESUME / Handoff

**Branch:** `modernization/foundation` · **Status:** in progress — **Wave 3 (push-to-newest) COMPLETE** · **Last updated:** 2026-06-26

> **To resume:** read this + `git log --oneline main..HEAD` + the [design spec](./2026-06-24-modernization-design.md).
> Order is **b → a → c**: fake-fix (DONE) → push-to-newest (Wave 3 nearly done) → warnings.
> **PRINCIPLE (user, 2026-06-24):** adopt each new version's newest **idioms/features/perf/aesthetics**, not just bump the version + patch breakage. See memory `[[adopt-newest-idioms-not-just-versions]]`. Pair a breaking-change pass with a modernization-idioms pass per dep.

---

## ✅ Done

**Prior sessions:** fake-fix initiative (all 26 audit findings) + push-to-newest Wave 1/R/2 — react 19.3-canary, vitest 5, rxjs 8, **GraphQL 17 via pnpm override**, mathjs RCE-CVE, ~60 pkgs. (16 commits.)

**Wave 3 (this session) — every item gate-green 21/21, tests green, committed:**
- **3.1** lucide-react 0.575→**1.21.0** — inline GitHub mark + 4-color Google "G" in `auth/signin/page.tsx` (lucide 1.x dropped brand icons). `5173d01`
- **3.2** three 0.183.2→**0.184.0** + @types/three **0.184.1** — **r184 GTAONode writes AO to the RED channel only (RedFormat).** SSAO blend in `plot-engine/src/renderers/webgl-3d.ts` now reads `aoPass.getTextureNode().r` (was multiplying full RGBA → zeroed G/B → red-tinted/broken SSAO; SILENT, compiles clean — caught by an adversarial-verify subagent). plot-engine now declares its own `@webgpu/types` (0.184 dropped the triple-slash ref that had supplied the WebGPU globals to `webgpu-2d.ts`). `72ee1da`
- **3.2b** **Lorenz raw-WebGPU compute → three 0.184 TSL compute** — `instancedArray('vec4')` + `Fn` RK4 kernel + `renderer.computeAsync(node.compute(count))` + `PointsNodeMaterial`; removed per-frame CPU readback + the `renderer as unknown as {backend}` cast; gating via `renderer.backend instanceof WebGPUBackend`. **Review fix:** render nodes use `particleBuffer.toAttribute()` NOT `.element(instanceIndex)` — a non-instanced `THREE.Points` draw has `instanceIndex===0`, which would collapse every particle onto particle 0 (typechecks but renders wrong). `lorenz-compute-shaders.ts` trimmed to `LORENZ_DEFAULTS`. `3e6ad48` — **⚠️ VISUAL/GPU QA PENDING** (typecheck/build-verified only, no GPU headless): verify particle motion + speed-coloring, the WebGPU 1px point-size clamp, first-frame init timing.
- **3.3** turbo 2.8.13-canary→**2.10.0**, wrangler 4.69→**4.104.0** (×3 workers) + turbo.json task `description`s. ⚠️ `$TURBO_ROOT$` is INVALID in `globalDependencies` (turbo parses a leading `$` there as an env var). Worker `wrangler.toml`s already modern (no change). `60bd384`
- **3.4** katex 0.16.33→**0.17.0** (web + export-service), tailwindcss + @tailwindcss/postcss 4.2.1→**4.3.1**, next-intl 4.8.3→**4.13.0** + real bug/idiom fixes:
  - **tailwind dark-mode bug:** added `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` to `globals.css` — `dark:` utilities (24 files) were keyed to `prefers-color-scheme`, disconnected from the `[data-theme]` toggle.
  - **katex bug:** dropped `output:'mathml'` in `math-renderer.tsx` → default `htmlAndMathml` (HTML fidelity + MathML a11y).
  - **next-intl v4 idioms:** `hasLocale()`+`notFound()` (request.ts + [locale]/layout.tsx, removes casts); dropped legacy `getMessages()`+`messages` prop; `<html lang={locale}>` via `getLocale()` in the root layout (verified under SSG). `2c62397`
- **3.5** @biomejs/biome 2.4.4→**2.5.1** (root + web + 3 workers). ⚠️ **`biome migrate` emits `linter.rules.preset:'recommended'` which 2.5.1's own `check` REJECTS as unknown** (migrate tool ahead of schema) → kept valid `recommended:true`. 2.5.1 `organizeImports` assist now sorts `export {}` member lists → auto-fixed 8 ui/chaos files. `f6ec2df`
- **3.4** serwist + @serwist/next 9.5.6→**10.0.0-preview.14** + **createSerwist idiom** — `sw.ts` migrated off the v10-deprecated `new Serwist(...)` to `createSerwist({precache:{entries,cleanupOutdatedCaches,concurrency},skipWaiting,clientsClaim,navigationPreload,disableDevLogs,extensions:[new RuntimeCache(defaultCache,{fallbacks})]})` + `addEventListeners()` (verified vs installed `serwist@10` .d.ts, not docs). **Verified:** `next build --webpack` regenerates `public/sw.js` with the precache manifest injected (66 KB, 395 revision entries, no bare `self.__SW_MANIFEST`). `c6bc839`
- **modern-pdf-lib 0.15.1→0.28.1** (export-service) — **our own package's major release** (now a full WASM-accelerated PDF engine). Re-implemented `pdf.ts` against the installed 0.28.1 `.d.ts`: `embedPng` is now async (awaited, single + batch); `save({ objectStreamThreshold: 100, useWasm: true })` (size reduction via object streams + WASM deflate); `setLanguage('en')` (tagged-PDF a11y); best-effort `initWasm({ png, deflate })` lazily, swallowed on failure (identical pure-JS fallback). Updated both test mocks. `bdb3510` — ⚠️ the WASM runtime path needs a **deploy-time** check in the live Worker.

---

## ⏭️ Remaining

### Wave 3 tail — ✅ DONE
- **modern-pdf-lib → 0.28.1** done (`bdb3510`). Remaining optional enhancements for that file: tagged-PDF alt-text for the math image (the LaTeX source) via the structure-tree/marked-content API (bigger lift, not done); `deduplicateImages(doc)` in the batch path. And confirm the `initWasm` WASM path actually loads in the deployed Worker (deploy-time).

### Modernization follow-ups (from the idiom-research — genuine improvements, not done)
- **#6 next-intl `useFormatter` sweep** — ~30 hardcoded `'en-US'` date/number formats across ~9 files (profile-overview, practice-history-table, analytics-charts, achievement-grid, forum-shared, level-utils, worksheets/page, activity-calendar, calculator/history) defeat i18n for the 7 non-English locales. Replace with `useFormatter()`/`getFormatter()` + optional shared `formats` in `i18n/request.ts`. Medium effort, gate-verifiable.
- **Lorenz visual/GPU QA** (see 3.2b) — needs a real WebGPU browser.
- **three polish (visual QA):** `scenePass.setResolutionScale(0.5)` for half-res AO; lower GTAO `radius`/`scale` to compensate for r184's darker physically-correct AO.
- **katex:** consolidate the duplicate `components/math/latex-renderer.tsx` into the cached `components/ui/math-renderer.tsx`.
- **tailwind:** replace hand-rolled scrollbar base CSS with v4.3 `scrollbar-*` utilities + `scrollbar-gutter-stable`; `tabular-nums` on calculator numeric displays.

### Wave 4 — side-by-side (land last; touches CI matrix)
- **@types/node → 26** (devDep everywhere) + Node 26 for dev/CI (`.github/workflows/*` NODE_VERSION); keep `engines.node` 24 on shipped apps (Vercel cap).
- **TS7 `tsgo` side-by-side:** `@typescript/native-preview` 7.0.0-dev.20260624.1 + non-blocking `typecheck:fast` task. Gate STAYS on tsc 6 (tsgo's programmatic API breaks typedoc/graphql-codegen). Also: typescript 6.0.3 GA now exists (repo on 6.0.0-dev.20260301) — consider bumping the gate compiler.

### "c" — ~500 warnings (last)
Drive Biome warnings to zero with REAL fixes (a11y, hook deps, dead code, `Number.isFinite`, stable keys). noNonNullAssertion decision #21a = hybrid (fix maskers; scoped override for provably-safe math hot-paths). Inventory: `pnpm exec biome check --diagnostic-level=error .` per workspace. NOTE: error-level now also includes the 2.5.1 export-sort assist (auto-fixable via `biome check --write`).

---

## Operational facts (Windows / this repo)
- **pnpm** on PATH in the **PowerShell** tool (`pnpm@11.0.0-alpha.11`); NOT in Bash. Node at `C:\Program Files\nodejs\node.exe`.
- **Gate:** `pnpm turbo run typecheck lint build --continue` (must be 21/21), then per-package `vitest run` (turbo-wide `test` hangs on cleanup — CI uses `timeout 300 → 124=ok`).
- **`apps/web/public/sw.js` (+ `.map`)** regenerate on every `next build` — `git restore` them before committing (don't commit churn).
- **Verification/subagents can pollute the working tree** — always `git status` + stage explicit paths before committing.
- **pnpm peer overrides** live in `pnpm-workspace.yaml` (`overrides:` / `peerDependencyRules:`), NOT package.json. Current overrides: react/react-dom 19.3 canary, rxjs 8, graphql 17.
- **Biome:** safe autofix only — `biome check --write` (NEVER `--unsafe`; it breaks `arr[i]!` and index-signature access).

## Pending (need user / provisioning)
- **R2 secrets** (export-service) for private-export presigning in prod.
- **MPFR** WASM (Emscripten in CI) to make high-precision real.
- **i18n:** the 7 non-English locales likely hold English placeholders for the new `forum.loadError`/`loadErrorHint` keys.
