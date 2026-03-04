# Test Overhaul Implementation Plan — v1.1.4

## Phase 1: Infrastructure & Config Cleanup

### Step 1.1: Clean vitest.setup.ts
- Remove unused `eventListeners` Map
- Remove unused `documentMocksInitialized` flag
- Keep all working mocks intact

### Step 1.2: Add worker vitest configs
- `apps/workers/cas-service/vitest.config.ts`
- `apps/workers/export-service/vitest.config.ts`
- `apps/workers/rate-limiter/vitest.config.ts`

### Step 1.3: Add coverage thresholds
- math-engine: 70/65/70/70
- plot-engine: 60/55/60/60
- api: 75/70/75/75
- workers: 80/75/80/80

### Step 1.4: Fix math-engine typecheck hang
- Remove `typecheck` from math-engine vitest.config.ts

## Phase 2: API Infrastructure Tests

### Step 2.1: Create API test utilities
- `apps/api/src/__tests__/helpers/mock-context.ts` — shared mock context factory
- `apps/api/src/__tests__/helpers/mock-prisma.ts` — typed Prisma mock

### Step 2.2: API lib tests
- `apps/api/src/__tests__/lib/dataloaders.test.ts`
- `apps/api/src/__tests__/lib/cache.test.ts`
- `apps/api/src/__tests__/lib/validation.test.ts`
- `apps/api/src/__tests__/lib/cursor-pagination.test.ts`
- `apps/api/src/__tests__/lib/errors.test.ts`

### Step 2.3: Split resolver tests
- `apps/api/src/__tests__/resolvers/calculation.test.ts`
- `apps/api/src/__tests__/resolvers/folder.test.ts`
- `apps/api/src/__tests__/resolvers/forum.test.ts`
- `apps/api/src/__tests__/resolvers/comment.test.ts`
- `apps/api/src/__tests__/resolvers/profile.test.ts`
- `apps/api/src/__tests__/resolvers/upvote.test.ts`
- `apps/api/src/__tests__/resolvers/shared-calculation.test.ts`

## Phase 3: Web Library Tests

### Step 3.1: Zustand store tests
- `apps/web/__tests__/lib/stores/calculator-store.test.ts`
- `apps/web/__tests__/lib/stores/bookmarks-store.test.ts`
- `apps/web/__tests__/lib/stores/settings-store.test.ts`
- `apps/web/__tests__/lib/stores/worksheet-store.test.ts`
- `apps/web/__tests__/lib/stores/collab-store.test.ts`

### Step 3.2: Auth module tests
- `apps/web/__tests__/lib/auth/roles.test.ts`
- `apps/web/__tests__/lib/auth/hooks.test.ts`

### Step 3.3: Hook tests
- `apps/web/__tests__/lib/hooks/use-keyboard-shortcuts.test.ts`
- `apps/web/__tests__/lib/hooks/use-reduced-motion.test.ts`

### Step 3.4: CMS tests
- `apps/web/__tests__/lib/cms/knowledge-base.test.ts`
- `apps/web/__tests__/lib/cms/problem-manager.test.ts`

## Phase 4: Math-Engine Gap Coverage

### Step 4.1: Algebra tests
- `packages/math-engine/src/__tests__/algebra/fields.test.ts`
- `packages/math-engine/src/__tests__/algebra/groups.test.ts`
- `packages/math-engine/src/__tests__/algebra/rings.test.ts`

### Step 4.2: Prover tests
- `packages/math-engine/src/__tests__/prover/inference-rules.test.ts`
- `packages/math-engine/src/__tests__/prover/natural-deduction.test.ts`
- `packages/math-engine/src/__tests__/prover/proof-search.test.ts`

### Step 4.3: Symbolic gap tests
- `packages/math-engine/src/__tests__/symbolic/cas-core.test.ts`
- `packages/math-engine/src/__tests__/symbolic/integrate-numerical.test.ts`
- `packages/math-engine/src/__tests__/symbolic/step-solver.test.ts`

## Phase 5: Component Tests

### Step 5.1: UI primitive tests
- `apps/web/__tests__/components/ui/math-renderer.test.tsx`
- `apps/web/__tests__/components/ui/code-block.test.tsx`
- `apps/web/__tests__/components/ui/progress-ring.test.tsx`

### Step 5.2: Calculator tests
- `apps/web/__tests__/components/calculator/display.test.tsx`
- `apps/web/__tests__/components/calculator/keyboard.test.tsx`
- `apps/web/__tests__/components/calculator/history.test.tsx`

### Step 5.3: Forum tests
- `apps/web/__tests__/components/forum/post-card.test.tsx`
- `apps/web/__tests__/components/forum/upvote-button.test.tsx`

## Phase 6: Plot-Engine Renderer Tests

### Step 6.1: Renderer tests
- `packages/plot-engine/src/__tests__/renderers/canvas-2d.test.ts`
- `packages/plot-engine/src/__tests__/renderers/webgl-2d.test.ts`

### Step 6.2: Utility tests
- `packages/plot-engine/src/__tests__/utils/buffer-pool.test.ts`
- `packages/plot-engine/src/__tests__/utils/marching-squares.test.ts`
- `packages/plot-engine/src/__tests__/utils/shader-cache.test.ts`

## Verification

After each phase:
1. `pnpm turbo run test` — all tests pass
2. `pnpm turbo run build` — no build regressions
3. `pnpm turbo run lint` — no lint errors
4. `pnpm turbo run typecheck` — no type errors

## Final Steps

1. Bump all package versions to 1.1.4
2. Update CHANGELOG.md
3. Update README.md
4. Update all docs and wiki
5. Commit, tag, push
