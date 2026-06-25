# Modernization — RESUME / Handoff

**Branch:** `modernization/foundation` · **Status:** in progress · **Last updated:** 2026-06-24

> **To resume in a fresh session:** read this file + `git log --oneline main..HEAD` + the
> [spec](./2026-06-24-modernization-design.md) and [Batch-0 baseline](./2026-06-24-foundation-batch0-baseline.md).
> The order is **b → a → c**: fake-fix (DONE) → push-to-newest (in progress) → warnings.

---

## ✅ Done (16 commits this far, every one gate-green)

**Fake-fix initiative (ALL of the 26 audit findings) — complete:**
ODE `new Function`→parser · rate-limiter→atomic Durable Object · R2→real presigned URLs ·
MPFR→honest "unavailable" · problems+ml-algorithms→real data · forum→real backend (mock removed) ·
batch-export discriminated result + CAS test assertions · #18a features (worksheet polling
fallback + forum "Load more") · web cleanup (auth casts, dead stubs, race hacks, fake tests,
~13 dead `eslint-disable`).

**Push-to-newest:**
- **Wave 1:** next 16.3.0-preview.3, prisma 7.9.0-dev.13, @apollo/client 4.3.0-alpha.1, framer-motion 12.41.0, typedoc 0.28.19
- **Wave R:** mathjs 15.2.0 (**RCE CVE-2026-40897 fixed**) + 49 routine GA bumps
- **Wave 2:** react/react-dom 19.3.0-canary-99e86060-20260623 · vitest+@vitest/ui 5.0.0-beta.5 · rxjs 8.0.0-alpha.14 · **GraphQL 17.0.1**

**Key mechanism — `pnpm-workspace.yaml` `overrides` + `peerDependencyRules`:**
react/react-dom (dedup single copy), `rxjs: 8.0.0-alpha.14`, `graphql: 17.0.1`. The graphql-17
adoption needed NO custom transport — graphql-sse/@apollo/server/graphql-ws consume graphql's
public API which is 17-compatible (app uses no @defer). Verified at runtime: api 491 + web 266 tests pass.

---

## ⏭️ Remaining — do in this order

### Wave 3 — code migrations (each needs care; gate + test each, commit per item)
1. **lucide-react → 1.21.0** (MAJOR): bump + replace 2 removed brand icons (`Github`, `Chrome`) with inline SVG in `apps/web/.../signin/page.tsx`.
2. **three → 0.184.0** (+ `@types/three` 0.184.1, bump together): **mandatory TSL renames** in `packages/plot-engine/src/renderers/webgl-3d.ts` (r184 renamed TSL nodes — check the three r184 migration notes).
3. **Transparent build-tool bumps** (likely zero-code): turbo 2.10.0, wrangler 4.104.0 (+ workers-types already at 4.20260624).
4. **App-facing minors (check for breaking changes):** katex 0.17.0, next-intl 4.13.0, tailwindcss 4.3.1 (+ @tailwindcss/postcss), modern-pdf-lib 0.26.0 (0.x — export worker), serwist + @serwist/next 10.0.0-preview.14 (regen `sw.js`).
5. **biome → 2.5.1** (CAUTION): may enable new lint rules → new errors. Bump, run `pnpm turbo run lint`, fix any new *errors* with real fixes (warnings go in "c").

### Wave 4 — side-by-side (touches CI matrix; land last)
6. **@types/node → 26** (devDep everywhere) + Node 26 for dev/CI (`.github/workflows/*` `NODE_VERSION`), keep `engines.node` Node-24 on shipped apps (Vercel Functions cap at 24.x).
7. **TypeScript 7 `tsgo` side-by-side:** add `@typescript/native-preview` devDep + a non-blocking `typecheck:fast` (`tsgo --noEmit`) turbo task + CI job. **Gate stays on tsc 6** (tsgo's programmatic API is incomplete → breaks typedoc/graphql-codegen; emit unvalidated). Add explicit `rootDir`+`types` to emitting tsconfigs first.

### "c" — warnings (~500 real fixes, last)
Drive Biome warnings to zero with REAL fixes (a11y attributes, correct hook deps, remove dead code, `Number.isFinite`, stable keys). For the **1,620 `noNonNullAssertion`**: decision #21a = **hybrid** — fix the few genuine maskers, scoped documented `biome.json` override for math hot-paths (provably-safe `arr[i]!`). Inventory: `pnpm exec biome check --diagnostic-level=error --reporter=github .` (per-workspace). 3 pre-existing suppressions noted to revisit: chaos mount-effect, practice-mode handleComplete circular-dep, seed.ts dynamic-createData `any`.

---

## Operational facts (Windows / this repo)
- **pnpm** is on PATH in the **PowerShell** tool (`pnpm@11.0.0-alpha.11`); NOT in the Bash tool. Node at `C:\Program Files\nodejs\node.exe`.
- **Gate:** `pnpm turbo run typecheck lint build --continue` (terminates) — must be 21/21. Then tests.
- **Tests hang on vitest cleanup** (known): a turbo-wide `test` finishes the suites but the process doesn't exit; CI uses `timeout 300 → exit 124 = success`. Run per-package `vitest run` (those exit 0) to confirm. math-engine's standalone run buffers; trust per-file ✓ + 0 failures.
- **`apps/web/public/sw.js` (+ `.map`)** regenerate on every `next build` — `git restore` them before committing (don't commit the churn).
- **Workflow/verification AGENTS can pollute the working tree** (install deps, write files). ALWAYS `git status` + review the diff before committing; stage explicit paths.
- **pnpm peer overrides** live in `pnpm-workspace.yaml` (`overrides:` / `peerDependencyRules:`), NOT package.json.

## Pending (need user / provisioning)
- **R2 secrets** (export-service Worker) for private-export presigning to function in prod: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL` (public exports work without).
- **MPFR** (#13b chosen = "honest unavailable"): to make high-precision REAL, build the WASM via Emscripten in CI (`pnpm --filter @nextcalc/math-engine build:wasm`).
- **i18n:** the 7 non-English locales likely hold English placeholder text for the new `forum.loadError`/`loadErrorHint` keys — real translations needed.
