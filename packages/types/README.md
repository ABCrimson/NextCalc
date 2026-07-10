# @nextcalc/types

Shared TypeScript type definitions used across the monorepo -- keeps the calculator's state shape consistent between `apps/web`, `apps/api`, and `packages/math-engine` without a runtime dependency between them.

## Contents

`src/index.ts` re-exports everything from `src/calculator.ts`:

- `AngleMode` -- `'deg' | 'rad'`
- `ComputeMode` -- `'exact' | 'approximate'`
- `CalculatorState` -- shape of the calculator's persisted/working state
- `HistoryEntry` -- a single calculation history record
- `CalculatorAction` -- the discriminated-union action type for the calculator reducer/store

## Usage

```typescript
import type { Calculation, HistoryEntry } from '@nextcalc/types';
```

## Commands

```bash
pnpm --filter @nextcalc/types typecheck  # tsc --noEmit (TypeScript 7 native)
pnpm --filter @nextcalc/types lint       # Biome
```

This package has no build step -- it's consumed directly as TypeScript source (`main`/`types` both point at `src/index.ts`), like the other workspace packages.
