# NextCalc Pro — Bleeding-Edge Modernization: Design & Charter

**Date:** 2026-06-24
**Status:** Approved (brainstorming complete)
**Author:** modernization working session
**Supporting data:** [`VERSION-AUDIT-2026-06-24.md`](../../../VERSION-AUDIT-2026-06-24.md) (full inventory + live newest-version comparison + per-package changelog research)

---

## 1. Goal

Bring the entire NextCalc Pro monorepo (~215,000 LOC across 7 workspaces, 94 npm packages + infra) to the **bleeding edge** — newest available versions in *any* channel (GA/beta/canary/dev), newest code idioms, and an ambitious modern visual redesign — while keeping the product shippable and the test/build gate green throughout.

This is too large for a single spec, so it is **decomposed into 5 sub-projects** (§4). This document is the umbrella **Charter** plus the detailed spec for **Sub-project #1 (Foundation)**. Each later sub-project gets its own spec → plan → execute → verify cycle.

---

## 2. Governing standards (the Charter)

| # | Standard | Rule |
|---|---|---|
| **S1** | **Node** | Newest Node (26/27) for local dev, CI, build tooling, and the 3 Cloudflare Workers (they run on `workerd`, not Node — no limit). **Shipped `apps/web` + `apps/api` code stays Node-24-compatible** because **Vercel Functions cap at Node 24.x** (verified: Vercel supports only 24.x/22.x/20.x for Functions/builds; Node 26 exists only on the separate *Vercel Sandboxes* product). `engines.node = "24.x"` on deployables; `@types/node` pinned `~24` on shipped packages (26 allowed in tool-only packages). Stay on Vercel. |
| **S2** | **Versions: newest-with-effort** | Attempt the **absolute newest** version in any channel → if it breaks, **invest real effort to fix it and make it work** → fall back to the newest version that stays green **only if genuinely infeasible**, with a documented blocker + a concrete revisit trigger. Pin exact versions (no ranges) for reproducibility. |
| **S3** | **Verification gate** | `pnpm turbo run typecheck test lint build` must be **green at the end of every stage**. A green baseline is established *before* any change so breakage is attributable. No stage ends red. (Preserve the existing CI vitest cleanup-timeout workaround.) |
| **S4** | **Idiom adoption** | Adopt all *high-value* new idioms uniformly (React `<Activity>`/`<ViewTransition>`/`useEffectEvent`, Three.js r184 TSL, Tailwind logical/container/`tabular-nums`, Apollo TypedDocumentNode-first + RefetchEventManager, Zod 4.4 transform idioms, Prisma `queryPlanCacheMaxSize`, Turbo `query affected`). Tighten Biome/TS rules **incrementally per workspace** (fixing churn as we go), not one blanket flip. Drive remaining `as any` / biome-ignores toward zero where feasible. |
| **S5** | **Aesthetics** | Ambitious modern redesign (between "refresh" and "full redesign"), **product identity preserved**. Its own design sub-project: design language → design system → per-surface application, using the frontend-design skill. |
| **S6** | **Safety** | All work on feature branches; worktrees for risky spikes (GraphQL 17, TS 7); frequent commits per logical step; never skip hooks; never sweep pre-existing unrelated working-tree changes into commits. Every decision recorded. |
| **S7** | **Final deliverable** | A before→after **delta report**: per package, old version → new version + the new tech/features/idioms it introduced. |

---

## 3. Key constraints & facts (verified 2026-06-24)

- **Vercel Functions runtime:** Node 24.x (default) / 22.x / 20.x. **No Node 26** for Functions/builds. (`apps/web` deploys here.)
- **pnpm not in PATH** locally; invoke via `& 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest …` or equivalent. Node available at `C:\Program Files\nodejs\node.exe` (v26.3.1) and `C:\nvm4w\nodejs`.
- **Monorepo build order:** `math-engine`, `plot-engine` → `api`, `web` (parallel where possible); `database`, `types` shared.
- **pnpm 11 `allowBuilds`** lives in `pnpm-workspace.yaml` (not `onlyBuiltDependencies`).
- **Never** `biome check --write --unsafe` (breaks strict-mode non-null assertions / index access).
- **Tier-C blockers (from audit):** GraphQL 17 ↔ Apollo Server `^16` peer pin; TypeScript 7 `tsgo` programmatic API deferred to 7.1 (breaks typedoc/codegen); Node 26 native-ABI rebuilds.

---

## 4. Decomposition (Approach A — foundation-first, layered)

| # | Sub-project | Outcome | Spec |
|---|---|---|---|
| **1** | **Foundation** | Every dependency/tool to bleeding edge; green baseline; shared dep layer settled. | **This doc, §5** |
| 2 | **Code modernization** | Per workspace in dep order (`math-engine` → `plot-engine` → `api` → `workers` → `web`): adopt new idioms (S4) uniformly, behind tests. | own spec later |
| 3 | **Aesthetic redesign** | New design language → design system → per-surface application (S5). | own spec later |
| 4 | **Infra hardening** | GitHub Actions major tags (checkout v7, action-setup v6, cache v6), Emscripten 3.1.51 → 6.0.1, Wrangler `compatibility_date` → current, CI tuning. | own spec later |
| 5 | **Final delta report** | The before→after comparison (S7). | own spec later |

---

## 5. Sub-project #1 — Foundation (detailed spec)

### 5.1 Purpose
Get the shared dependency layer to bleeding edge (S2) with the gate green (S3), so all later work sits on settled deps. Foundation makes **only the code/config edits strictly required to compile and pass** under the new versions — *optional* idiom adoption (S4) is deferred to Sub-project #2.

### 5.2 Success criteria
- Every package + tool at its newest-with-effort target; each marked **adopted** (newest, green) or **fallback** (newest-green) with a documented blocker + revisit trigger.
- `pnpm turbo run typecheck test lint build` green across all 7 workspaces.
- `pnpm-lock.yaml` regenerated; `pnpm install --frozen-lockfile` passes.
- A **Foundation result table** (per package: target / adopted-vs-fallback / blocker) — feeds S7.

### 5.3 Approach — ordered batches, gate after each
> **Staging philosophy:** reach a **green GA floor first** (Batches 1–2 — a safe, known-good checkpoint, getting off pre-releases that are *older* than current GA), **then climb to bleeding edge** (Batch 3). End state is newest-in-channel per S2, with the GA floor as the documented fallback when a climb is infeasible.

- **Batch 0 — Green baseline.** Run the full gate on the branch point; record pass/fail per workspace (distinguish pre-existing failures). Preserve the CI vitest cleanup-timeout workaround.
- **Batch 1 — GA floor for stale pre-releases (Tier A).** Pure wins onto a known-good floor: `next`→16.2.9, prisma stack→7.8.0, `pnpm`→11.9.0, `radix-ui`→1.6.0, `@upstash/redis`→1.38.0, `@apollo/client`→4.2.3, `zod`→4.4.3, `vitest`/`@vitest/ui`→4.1.9, `turbo`→2.9.18, `@vercel/*`→GA, `sharp`→0.35.2, `typescript`→6.0.3, `next-auth`→beta.31. Manifests + lockfile, gate. *(These then climb to newest-in-channel in Batch 3.)*
- **Batch 2 — Feature + routine bumps (Tier B + routine).** `biome`→2.5, `wrangler`+workers-types→4.104, `tailwindcss`→4.3, `katex`→0.17, **`lucide-react`→1.x (run `@lucide/codemod`)**, **`three`→r184 (mandatory TSL renames in `packages/plot-engine/src/renderers/webgl-3d.ts`)**, `framer-motion`→12.41, `@sentry/nextjs`→10.60, `next-intl`→4.13, **`@apollo/server`→5.5 (verify GET CSRF Content-Type)**, **`mathjs`→15.2 (RCE CVE-2026-40897 — priority)**, `serwist`→9.5.11, `nosecone`→1.5, `modern-pdf-lib`→0.26, + all routine patch/minors (see audit §7). **Mandatory compile-fix edits only** (TSL renames, lucide icon renames, Zod strictness, Apollo GET header). Gate.
- **Batch 3 — Climb to newest-in-channel (S2).** Push every package whose newest build exceeds the GA floor up to its newest channel version:
  - **(a) Easy climbs** (no known blocker): `react`/`react-dom`→newest 19.3 canary, `next`→16.3 canary, `zod`→4.5 canary, `turbo`→2.9.19 canary, `@vercel/*` canary, and any other package whose newest > GA without breakage. Bump, gate.
  - **(b) Blocked spikes** (in worktrees, hardest last): GraphQL 17 (+`pnpm` overrides; runtime-test subscriptions/`@defer`); TypeScript 7 `tsgo` (**side-by-side; 6.0.3 stays the gate compiler**, tsgo trialed for fast local typecheck only); `vitest` 5; `framer-motion` 13; `rxjs` 8; `serwist` 10; `modern-pdf-lib` 0.27. Each: attempt → fix hard → adopt if green, else fall back to the GA floor + document blocker + revisit trigger.
- **Batch 4 — Node toolchain.** Local + CI `NODE_VERSION` → 26; rebuild native addons (`sharp`/prisma-engines/`workerd`); `engines.node = "24.x"` on deployables; `@types/node ~24` on shipped pkgs (26 in tool-only). If a native dep can't build on 26, keep that step on 24 and note it.
- **Batch 5 — Finalize.** `pnpm install`, verify `allowBuilds`, frozen-lockfile check, full gate green, write the Foundation result table.

### 5.4 Components touched
10 `package.json`; `pnpm-lock.yaml`; `pnpm-workspace.yaml` (`allowBuilds`); root + per-pkg `tsconfig`; `biome.json`; minimal compile-fix sites (the one `webgl-3d.ts` renderer; lucide call sites via codemod; a few Zod/Apollo spots); CI `NODE_VERSION` env.

### 5.5 Risks & handling
- Pre-release churn → pin exact versions.
- GraphQL 17 & TS 7 isolated in worktrees so they can't redden `main`.
- Node 26 native-ABI → rebuild + validate in Batch 4; fall back per-step to 24 if a native dep can't build.
- Vitest cleanup timeout (known) → keep CI workaround.
- Attribution → baseline first (Batch 0).

### 5.6 Out of scope (later sub-projects)
Optional idiom adoption beyond compile-needs (#2); visual redesign (#3); GitHub Action tag majors / Emscripten 6.0.1 / Wrangler `compatibility_date` (#4); the final cross-project delta report (#5).

---

## 6. Testing strategy
- The **gate** (`typecheck` + `test` + `lint` + `build` via Turbo) after each batch.
- Targeted runtime smoke checks for risky upgrades: GraphQL subscriptions/`@defer`, Apollo Server GET CSRF, PWA service worker registration, a 3D-render smoke for the Three.js TSL renames, KaTeX render, PDF export.
- Property tests (`fast-check`) and existing vitest suites must pass unchanged except where a dependency's *documented* behavior change requires a test update (recorded in the result table).
