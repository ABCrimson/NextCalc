# Test Overhaul Design — v1.1.4

## Date: 2026-03-04

## Problem Statement

NextCalc Pro has 288 production source files but only 57 test files (19.8% file coverage). Critical infrastructure — API caching, dataloaders, validation, auth middleware, Zustand stores, and all plot-engine renderers — has zero test coverage. The single monolithic API test file (2,382 lines) is fragile and hard to maintain.

## Current State

| Package | Source Files | Test Files | Coverage % |
|---------|-------------|-----------|-----------|
| math-engine | 106 | 45 | 42.5% |
| plot-engine | 26 | 8 | 30.8% |
| api | 26 | 1 | 3.8% |
| web/lib | 43 | 0 | 0.0% |
| web/components | 123 | 2 | 1.6% |
| **Total** | **288** | **57** | **19.8%** |

### Infrastructure Issues

- Only `apps/web` has coverage thresholds (80%); other packages have none
- Workers have no `vitest.config.ts` files
- `vitest.setup.ts` has dead code (unused `eventListeners` Map, `documentMocksInitialized` flag)
- Math-engine `typecheck` in vitest causes indefinite hang (CI uses timeout workaround)

## Approach: Prioritized Phased Delivery

### Phase 1: Infrastructure & Config Cleanup

1. Remove dead code from `apps/web/vitest.setup.ts`
2. Add `vitest.config.ts` to all 3 workers (cas-service, export-service, rate-limiter)
3. Add coverage thresholds to math-engine, plot-engine, api
4. Disable `typecheck` in math-engine vitest config (use separate `pnpm typecheck` instead)
5. Standardize test file naming: `*.test.ts` / `*.test.tsx`

### Phase 2: API Infrastructure Tests

Priority: highest risk — untested cache, dataloaders, validation serve every request.

| File | Test Focus |
|------|-----------|
| `dataloaders.ts` | Batch loading, deduplication, error propagation |
| `cache.ts` | Redis get/set/delete, TTL, `invalidateByPrefix` with SCAN |
| `validation.ts` | Input sanitization, length limits, XSS prevention |
| `cursor-pagination.ts` | Cursor encoding/decoding, edge cases |
| `errors.ts` | Error formatting, code mapping |
| `context.ts` | Context creation with auth + loaders |

Split `resolvers.test.ts` into per-domain files:
- `calculation.test.ts`
- `folder.test.ts`
- `forum.test.ts`
- `comment.test.ts`
- `profile.test.ts`
- `upvote.test.ts`
- `shared-calculation.test.ts`

### Phase 3: Web Library Tests

| Module | Test Focus |
|--------|-----------|
| `stores/calculator-store.ts` | State transitions, expression evaluation, history |
| `stores/bookmarks-store.ts` | Add/remove/persist bookmarks |
| `stores/settings-store.ts` | Theme, locale, preferences |
| `stores/worksheet-store.ts` | Cell CRUD, reordering |
| `stores/collab-store.ts` | Collaboration state management |
| `auth/hooks.ts` | Session hooks, auth guards |
| `auth/middleware.ts` | Route protection, redirects |
| `auth/roles.ts` | RBAC permission checks |
| `hooks/use-keyboard-shortcuts.ts` | Shortcut registration, cleanup |
| `hooks/use-reduced-motion.ts` | Media query detection |
| `cms/knowledge-base.ts` | Topic resolution, content loading |
| `cms/problem-manager.ts` | Problem CRUD, filtering |

### Phase 4: Math-Engine Gap Coverage

| Module | Files | Test Focus |
|--------|-------|-----------|
| `algebra/` | fields, groups, rings | Algebraic structure laws |
| `prover/` | inference-rules, natural-deduction, proof-search, theorem-database | Logical inference correctness |
| `symbolic/` | cas-core, expression-tree, integrate-improper/multi/numerical, step-solver | CAS operations, numerical integration |
| `content/` | katex-wrapper, markdown parser, problem-set loader/validator | Rendering, parsing, validation |

### Phase 5: Component Tests (High-Value)

| Component | Test Focus |
|-----------|-----------|
| `ui/code-block.tsx` | Rendering, copy button, syntax highlighting |
| `ui/math-renderer.tsx` | KaTeX rendering, error fallback |
| `ui/progress-ring.tsx` | SVG rendering, percentage |
| `calculator/display.tsx` | Expression display, LaTeX |
| `calculator/keyboard.tsx` | Button clicks, key mapping |
| `calculator/history.tsx` | History list, clear, selection |
| `forum/post-card.tsx` | Post rendering, vote display |
| `forum/comment-thread.tsx` | Nested comments, reply |
| `forum/upvote-button.tsx` | Toggle, count update |
| `worksheet/cell.tsx` | Cell editing, evaluation |

### Phase 6: Plot-Engine Renderers

| Renderer | Test Focus |
|----------|-----------|
| `canvas-2d.ts` | Draw calls with mock CanvasRenderingContext2D |
| `webgl-2d.ts` | Shader compilation, buffer creation (mock WebGL) |
| `webgl-3d.ts` | Scene setup, material disposal, memory management |
| `utils/buffer-pool.ts` | Pool allocation, reuse, growth |
| `utils/marching-squares.ts` | Contour extraction correctness |
| `utils/shader-cache.ts` | Cache hit/miss, eviction |

## Test Standards

- **Framework:** Vitest 4.1.0-beta.5 with `vi.*` APIs
- **React:** `@testing-library/react` 16.3.2, React 19.3 patterns
- **TypeScript:** 6.0 strict mode, `exactOptionalPropertyTypes`
- **Coverage provider:** v8
- **Property-based:** `fast-check` for mathematical invariants
- **No `as any`** in test code (use proper typing, `vi.fn<>()` generics)
- **Arrange-Act-Assert** pattern in all tests
- **Named imports** only (`import { describe, it, expect } from 'vitest'`)

## Target Coverage Thresholds

| Package | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| math-engine | 70% | 65% | 70% | 70% |
| plot-engine | 60% | 55% | 60% | 60% |
| api | 75% | 70% | 75% | 75% |
| web | 80% | 80% | 75% | 80% |
| workers | 80% | 75% | 80% | 80% |

## Estimated New Test Files

- Phase 1: 0 new files (config changes only)
- Phase 2: ~10 new files (6 resolver splits + 6 lib tests)
- Phase 3: ~12 new files
- Phase 4: ~8 new files
- Phase 5: ~10 new files
- Phase 6: ~6 new files

**Total: ~46 new test files, bringing total from 57 to ~103**

## What's NOT Changing

- Existing passing tests remain untouched (no rewrites for style alone)
- E2E test structure (28 Playwright specs) unchanged
- Test runner (Vitest) and assertion library unchanged
- CI pipeline structure unchanged (just passes more reliably)
