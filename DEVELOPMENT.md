# NextCalc Pro - Development Guide

## Prerequisites

- **Node.js** 24+ (26 recommended; two installs exist on this machine: `C:\nvm4w\nodejs\node.exe` v24.8.0 and `C:\Program Files\nodejs\node.exe` v26.0.0-nightly)
- **pnpm** 11+ (packageManager field specifies `pnpm@11.0.0-alpha.5`)

> **Note (Windows):** If pnpm is not in PATH, invoke it via:
> ```bash
> powershell.exe -ExecutionPolicy Bypass -Command "& 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest <command>"
> ```

## Environment Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` with your credentials:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"
DIRECT_DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# OAuth (optional -- only include providers whose credentials you have)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."

# Redis (optional)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

See [docs/SETUP.md](./docs/SETUP.md) for step-by-step database and OAuth configuration.

### 3. Initialize Database

```bash
pnpm --filter @nextcalc/database db:generate
pnpm --filter @nextcalc/database db:push
```

## Commands

### Development

```bash
pnpm dev                           # Start all packages (web on port 3005)
pnpm dev --filter @nextcalc/web    # Start web only
pnpm dev --filter @nextcalc/api    # Start API only
```

### Building

```bash
pnpm build                         # Build all packages
pnpm build --filter @nextcalc/web  # Build web only
```

### Testing

```bash
pnpm test                          # Run all tests (Vitest)
pnpm test --filter @nextcalc/web   # Test web only
pnpm --filter @nextcalc/web test:e2e  # E2E tests (Playwright)
```

### Linting and Formatting

```bash
pnpm lint                          # Lint all (Biome)
pnpm lint:fix                      # Auto-fix lint issues
```

### Database (run from packages/database/)

```bash
pnpm --filter @nextcalc/database db:generate   # Generate Prisma client
pnpm --filter @nextcalc/database db:push       # Push schema to database
pnpm --filter @nextcalc/database db:migrate    # Run migrations (dev)
pnpm --filter @nextcalc/database db:studio     # Open Prisma Studio (port 5555)
pnpm --filter @nextcalc/database db:seed       # Seed sample data
```

### GraphQL Codegen

```bash
pnpm codegen                       # Generate TypeScript types from schema
pnpm codegen:watch                 # Watch mode
```

### Cloudflare Workers

```bash
# Each worker has its own dev/deploy scripts
cd apps/workers/cas-service && pnpm dev      # Port 8787
cd apps/workers/export-service && pnpm dev   # Port 8788
cd apps/workers/rate-limiter && pnpm dev     # Port 8789
```

### Math Engine

```bash
pnpm --filter @nextcalc/math-engine test     # Run math engine tests
pnpm --filter @nextcalc/math-engine build    # Build math engine
pnpm --filter @nextcalc/math-engine rebuild  # Clean + build
```

## Monorepo Package Map

```
apps/
  web/         -> @nextcalc/web          (Next.js frontend)
  api/         -> @nextcalc/api          (GraphQL API)
  workers/
    cas-service/    -> @nextcalc/cas-service
    export-service/ -> @nextcalc/export-service
    rate-limiter/   -> @nextcalc/rate-limiter
packages/
  math-engine/ -> @nextcalc/math-engine  (core math library)
  plot-engine/ -> @nextcalc/plot-engine  (visualization engine)
  database/    -> @nextcalc/database     (Prisma schema + client)
  types/       -> @nextcalc/types        (shared TypeScript types)
```

### Importing Workspace Packages

```typescript
import { evaluate } from '@nextcalc/math-engine';
import { WebGL2DRenderer } from '@nextcalc/plot-engine';
import type { Calculation } from '@nextcalc/types';
import { prisma } from '@nextcalc/database';
```

## Code Conventions

### React 19.3 Patterns

- No `forwardRef` -- use `ref` as a regular prop
- No `displayName` assignments
- Named imports only: `import { useState } from 'react'`
- Server Components by default; add `'use client'` only when needed

### TypeScript 6.0

- `exactOptionalPropertyTypes` is enabled -- cannot assign `undefined` to optional properties typed as `string`. Use the conditional spread pattern:
  ```typescript
  const obj = {
    ...(value ? { key: value } : {}),
  };
  ```
- Zero `as any` in production code (enforced across the entire monorepo)
- Use `NodeType` enum values for math-engine AST types, not string literals

### Styling (OKLCH + Tailwind 4)

- OKLCH color system (P3 gamut, perceptually uniform) defined in `apps/web/app/globals.css`
- Semantic color tokens: `text-foreground`, `bg-background`, `border-border`, `text-muted-foreground` -- never use `gray-*` or `slate-*` directly
- CSS variables store full `oklch()` values, referenced with `var(--color-*)` (not wrapped in `hsl()`)
- Focus rings: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`
- Canvas renderers use dynamic HSL for programmatic color -- this is acceptable
- `text-white` on gradient backgrounds is intentional contrast

### Radix UI (Unified Package)

- Import from `radix-ui` (not `@radix-ui/*`): `import { Slot } from 'radix-ui'`
- `Slot` is a namespace -- use `Slot.Root` as the component
- When using `asChild` with Button, Radix `Slot.Root` expects a single child

### Prisma 7

- Always import from `@nextcalc/database`, never from `@prisma/client`
- Schema lives at `packages/database/prisma/schema.prisma`
- Config at `packages/database/prisma.config.ts` (loads env from `apps/web/.env.local`)
- Generated client at `packages/database/src/generated/prisma/` (gitignored)

## Testing

### Unit Tests (Vitest)

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './component';

test('renders correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('...')).toBeInTheDocument();
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('calculator works', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-key="1"]');
  await expect(page.locator('.display')).toContainText('1');
});
```

### Accessibility Tests

```typescript
import { axe } from 'jest-axe';

test('no a11y violations', async () => {
  const { container } = render(<MyComponent />);
  expect(await axe(container)).toHaveNoViolations();
});
```

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Port in use | `npx kill-port 3005` |
| Prisma client missing | `pnpm --filter @nextcalc/database db:generate` |
| Type errors after package update | `pnpm clean && pnpm install && pnpm build` |
| Radix Slot expects single child | Don't wrap extra elements inside `Slot.Root` when using `asChild` |
| Zod 4: `.errors` not found | Renamed to `.issues` on `ZodError` |
| `@types/three` Line.material type | Use `!Array.isArray()` guard + `as THREE.LineBasicMaterial` |
| NextAuth `Configuration` error | Ensure OAuth provider credentials are set; conditionally push providers |
| PrismaNeon adapter error | Pass `{ connectionString }` config object, NOT a Pool instance |

## Debugging

- **React DevTools** -- standard browser extension
- **Zustand DevTools** -- built-in (enable in store config)
- **Prisma Studio** -- `pnpm --filter @nextcalc/database db:studio` (port 5555)
- **GraphQL Playground** -- `http://localhost:3005/api/graphql`

## Workflow

### Adding a Feature

1. Create branch: `git checkout -b feature/name`
2. Implement with tests
3. Run: `pnpm build && pnpm test && pnpm lint`
4. Commit and push

### Adding a shadcn/ui Component

```bash
cd apps/web
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### Adding a Route

Create `apps/web/app/[locale]/[route]/page.tsx`:

```tsx
import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('myRoute');
  return <div>{t('title')}</div>;
}
```

### Adding Translations

1. Add keys to `apps/web/messages/en.json`
2. Add the same keys to all other locale files (`ru.json`, `es.json`, etc.)
3. Use `useTranslations('namespace')` in components
