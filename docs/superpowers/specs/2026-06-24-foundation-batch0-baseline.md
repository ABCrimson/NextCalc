# Foundation — Batch 0: Green Baseline Record

**Date:** 2026-06-24
**Branch:** `modernization/foundation`
**Spec:** [`2026-06-24-modernization-design.md`](./2026-06-24-modernization-design.md) §5.3 Batch 0
**Purpose:** Establish a **green** verification gate before any dependency change, so all later breakage is attributable (Charter **S3**).

---

## 1. Initial baseline (as committed at branch point `6c061fc`) — RED

Running `pnpm turbo run typecheck lint build` + `test` on the untouched branch point (working tree clean, **0 source changes**) revealed the committed baseline was **not green**. These failures are **pre-existing** — they predate this modernization work and the machine reboot that interrupted an earlier `next build`.

| Gate task | Result at branch point | Root cause |
|---|---|---|
| **build** (7 ws) | ✅ green | — |
| **lint** | ❌ 7/8 workspaces fail (43 error-level diagnostics) | **`format` + `assist/source/organizeImports` only** — test files added by the v1.2.2 test overhaul were never Biome-formatted. (No `any`-rule errors; those rules are `warn`.) |
| **typecheck** | ❌ `@nextcalc/web` (72 errors) | `tsconfig.typecheck.json` includes test files; `__tests__/lib/stores/*.test.ts` had `noUncheckedIndexedAccess` undefined access (TS2532/TS18048) + un-narrowed `WorksheetCell` union access (TS2339). |
| **test** | ⚠️ `@nextcalc/math-engine` 2 flaky | `differential-privacy.test.ts` property tests: `fc.float()` without `noNaN:true` injected `NaN` into Laplace mechanism → assertions failed nondeterministically. (1 property also asserted nothing — latent bug.) |

Per-workspace lint error counts: plot-engine 10, web 12, api 8, math-engine 6, export-service 3, rate-limiter 3, cas-service 1; `types` clean.

> Decision (user): **green the baseline first** (vs. proceeding on a documented red baseline), to keep S3 attribution clean and do the S4 quality cleanup up front.

---

## 2. Greening actions

1. **Lint (43 → 0):** safe `biome check --write` per workspace — **`--unsafe` NOT used** (per repo guidance: it breaks strict-mode `!`/index access). Changes are exclusively whitespace/line-collapsing (`format`) and import alphabetization/regrouping (`organizeImports`). Verified diff-by-diff: **no logic, no symbols dropped**. Two production source files touched (`symbolic/symbolic-page-client.tsx`, `algorithms/TransformerVisualizer.tsx`) — formatting only.
2. **Web typecheck (72 → 0):** added `!` on provably-present array indexing in the three store test files and relied on the **already-present** `if (cell.kind === …)` union guards. **No** `as any` / `as unknown` / `@ts-ignore` / tsconfig changes / production-type changes. (Result: 41 `noNonNullAssertion` *warnings* — acceptable; rule is `warn`.)
3. **Flaky DP tests (2 → 0):** added `noNaN:true` to the `fc.float` generators (root cause), increased sample counts (100→500 / single→200-avg) with statistically-justified tolerances, and rewrote the "smaller epsilon = stronger privacy" property to actually verify the guarantee (it previously asserted only generator ordering). DP source implementation **unchanged**. Verified **5/5 consecutive green runs**.

---

## 3. Green baseline (final) — attributable starting point for Batch 1

| Gate task | Result |
|---|---|
| **typecheck** | ✅ all workspaces (turbo `21/21` incl. lint+build, exit 0) |
| **lint** | ✅ all 8 (turbo exit 0; only `warn`-level diagnostics remain) |
| **build** | ✅ all 7 |
| **test** | ✅ math-engine (all 55 files, incl. fixed DP) · web 266/266 · api 491 · plot-engine 323 · cas 62 · export 95 · rate-limiter 92 |

**Note — vitest cleanup hang:** a *single* `pnpm turbo run test` across all workspaces does not exit cleanly; the suites finish green but the vitest process hangs on cleanup (a known issue). This is the same condition CI handles with `timeout 300 → exit 124 = success`. Individual workspace runs (`vitest run`) exit 0. This is **not** a test failure.

**Remaining (intentional, documented) debt:** lint `warn`-level diagnostics (incl. ~41 test-file `noNonNullAssertion`, plus `noExplicitAny`/`a11y`/etc. warnings) are out of scope for Batch 0 and are addressed incrementally per **S4** during Sub-project #2 (code modernization).

---

## 4. Next

Proceed to **Batch 1 — GA floor for stale pre-releases (Tier A)** per spec §5.3.
