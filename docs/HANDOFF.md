# Wave 1 Handoff — Competitive Feature Roadmap

> Status snapshot written 2026-07-12, immediately after wave 1 landed.
> Read this alongside `docs/ROADMAP.md` (the ranked backlog) when picking the work back up.

## State at a glance

Wave 1 of the competitive roadmap is **fully landed and deployed**: PRs #77–#81 merged to `main` on 2026-07-11 via a serial merge train, CI green, Vercel production deploy live. Worktrees and feature branches were deleted after landing. An infra fix (PR #82, see [Process notes](#process-notes)) landed en route.

## What shipped (and where it lives)

### 1. Implicit 2D curves + inequality shading — PR #77 (roadmap #1, #3)
Graph non-functions: `x^2 + y^2 = 25`, `y > x^2`, chained bands (`1 < x < 4`), and multi-relation systems with intersection shading. Strict inequalities get dashed boundaries.
- Engine: `packages/math-engine/src/parser/relation.ts` (`RelationalNode`, `parseRelationSystem`, `compileRelationField`)
- Rendering: `packages/plot-engine/src/utils/implicit-field.ts` + marching squares; `2d-relation` config renders on all three backends (WebGPU sign(F) fill / WebGL2 / Canvas2D). Convention: F = lhs − rhs; `<` shades F<0, `>` shades F>0 (documented on `Plot2DRelationEntry`).
- UI: "2D Relations" tab on `/plot` — `apps/web/components/plots/RelationInput.tsx`, `relation-config.ts`; i18n under `plots.relation.*`.

### 2. Data tables + tilde regression — PR #78 (roadmap #2)
"Data & Regression" tab on `/plot`: spreadsheet paste, draggable points, `y1 ~ a*exp(b*x1)` model fitting (six canned chips), R²/RMSE/std errors, residuals.
- Engine: `packages/math-engine/src/stats/fit.ts` (`parseTildeModel`, `fitModel` — damped Levenberg–Marquardt, analytic Jacobians, honest-failure contract)
- UI: `apps/web/components/plots/regression/`; i18n under `plots.regression.*`.

### 3. Free step-by-step for equations + limits — PR #79 (roadmap #4, phases 1–2)
StepTrace layer emits structured, rule-tagged steps from the solver's own rewrite rules; new Limit tab in the solver (±∞, one-sided). 57 rule explanations localized in all 8 languages, with a CI test that fails if a displayed rule ever lacks translations.
- Engine: `packages/math-engine/src/trace/step-trace.ts` (`DISPLAY_RULES`), `limitWithSteps()`
- UI: `apps/web/components/calculator/solver-panel.tsx`; i18n under `solver.stepRules.*` / `solver.limitTab.*` / `solver.stepCategories.*`; coverage test at `apps/web/__tests__/i18n/solver-step-rules.test.ts`.
- **Strategic note:** steps stay 100% free — this attacks Symbolab/Wolfram Pro's paywall. Keep it free.

### 4. Practice generator + Verify Solution — PR #80 (roadmap #5, #8)
"Infinite Drill" on `/practice` (`?mode=drill&template=&seed=` deep links): seeded generation over 22/24 templates, CAS-graded equivalent-form answers, progressive hints. "Check my work" panel in the solver verifies a student's own answer.
- Engine: `packages/math-engine/src/problems/templates/` (template engine, seeded RNG), `packages/math-engine/src/equivalence/equivalence.ts` (`checkEquivalence`, `checkGradedAnswer`)
- UI: `apps/web/components/math/drill-mode.tsx`, `check-work-panel.tsx`; i18n under `practice.drill.*` / `checkWork.*`.

### 5. GPU Lab — PR #81 (roadmap #6 + slider animation)
WebGPU sims (PDE heat/wave/laplace, Lorenz, direction fields) as slider-driven worksheet cells persisting through autosave/share codes; public `/gpu-lab` gallery with fork-on-open; Desmos-style play/pause/speed animation on plot sliders.
- UI: `apps/web/components/worksheet/simulation-cell.tsx`, `apps/web/lib/simulation/registry.ts` (param specs; `sanitizeSimParams` clamps untrusted stored params — keep using it for any new param path), `apps/web/app/[locale]/gpu-lab/`, `apps/web/components/plot/variable-sliders.tsx` (`stepSliderValue`)
- Server: `setWorksheetVisibility` action (atomic ownership check) in `apps/web/app/actions/worksheet.ts`; i18n under `gpuLab.*` / `worksheet.simulation.*` / `plots.sliders.*`.

## Quality/review state

Adversarial review before merge found and fixed **17 real bugs**, including two critical grader bugs (equation-mode Check-my-work compared against the wrong canonical; canned-model chips + colliding column names produced vacuous "converged, R²=1" fits) and a browser-hang vector via crafted GPU-Lab worksheet params.

⚠️ **Uneven review depth:** t2 (regression) and t4 (practice/verify) got the full multi-agent review (multi-lens finders + skeptic verification). t1 (relations), t3 (steptrace), t6 (gpu-lab) got a lighter single-reviewer pass because the monthly spend limit cut the parallel review mid-run. **A full multi-agent review sweep of the #77/#79/#81 diffs is a recommended first task when budget allows.**

## Deferred from wave 1 (designs exist, not built)

- **ODE step-by-step** — roadmap #4 phase 3; the StepTrace layer is built for it, extend `DISPLAY_RULES` + ODE solver tracing.
- **GPU Lab clip export** — design documented in `simulation-cell.tsx` header: client-side `canvas.captureStream(30)` + MediaRecorder → WebM download; deliberately NOT via export-service.
- **Multi-regressor fit visualization** — `fitModel` already handles `z ~ a*x + b*y`; only single-regressor curves are plotted (contour/3D surface would close it).
- **CSV/XLSX file-upload import** for the data table (paste-only today).
- **Canonical answers for linear-inequality and prime-factorization templates** (currently excluded from the drill picker as ungradeable).

## Remaining ranked backlog (see docs/ROADMAP.md for sketches)

| # | Feature | Notes |
|---|---------|-------|
| 7 | **Distribution explorer** (PDF/CDF, interval shading, t/χ² tests) | Recommended next: highest remaining value and it reuses wave 1's region-fill pass + StepTrace-style output |
| 9 | **Public embed API** (`@nextcalc/embed` + `/embed/[type]`) | Medium effort; rate-limiter worker exists for future commercial keys |
| 10 | **Classroom-lite** (class codes, live teacher dashboard) | Largest effort; collab channel plumbing already works cross-instance |
| — | Unranked: a11y sonification/Braille (revisit now that #1–3 shipped), exact/arbitrary precision (blocked on WASM build), implicit/parametric 3D surfaces | |

## Process notes

- **Serial merge train works well:** land one branch, merge `main` into the next, resolve, verify, repeat. The 8 locale files conflict every time but **union-merge cleanly** (all branches only add keys — a deep-merge script beats textual resolution; scalar conflicts = a real problem).
- **Vercel deploys (fixed, but know why):** the Prisma client generates via `postinstall` into `packages/database/src/generated`; pnpm **skips lifecycle scripts on cached installs**, so any commit without a lockfile change used to fail deploy. PR #82 made `vercel.json`'s buildCommand run `db:generate` explicitly (same pattern as `ci.yml`). If deploys mysteriously break again, look here first.
- **Vercel previews can die silently in the TypeScript phase** (resource death, no diagnostic). If GitHub CI is green and the log just stops, `npx vercel redeploy <url>` — it was flaky both times it happened.
- Stale `packages/*/dist` in a worktree makes web typecheck report phantom missing exports — rebuild the engine package (`pnpm --filter @nextcalc/math-engine build`) after merging engine changes.
- Release convention: single version bump across all ~10 workspace `package.json`s + CHANGELOG + wiki pointers in one `chore(release)` commit (see 703f022). **Wave 1 has not been version-bumped/released yet** — cutting v1.6.0 with a CHANGELOG entry is an open follow-up.
