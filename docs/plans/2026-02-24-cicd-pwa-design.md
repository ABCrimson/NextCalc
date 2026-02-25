# CI/CD Pipeline + PWA Serwist Migration Design

**Date:** 2026-02-24
**Status:** Approved

## Overview

Two infrastructure improvements:
1. GitHub Actions CI/CD pipeline with Turborepo `--affected` and Vercel remote cache
2. PWA service worker migration from manual `sw.js` to Serwist 9.5.6

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Turbo cache | Vercel-coupled (`TURBO_TOKEN` + `TURBO_TEAM`) | Free with Vercel, shared between CI and local dev |
| CI structure | Single job with `--affected` | Turbo parallelizes internally; repo isn't large enough for matrix jobs |
| Triggers | Push to `main` + all PRs | Standard with branch protection requiring CI to pass |
| PWA approach | Full Serwist migration | Auto-precaching, typed SW, maintained; replaces manual sw.js |
| Offline fallback | Dedicated `~offline` page | Better UX than falling back to homepage |
| Dependency updates | Renovate Bot | Native monorepo grouping, automerge patches, pnpm-aware |
| Node version | 25.7.0 | Project-wide migration from >=24.0.0 |
| pnpm version | 11.0.0-alpha.11 | Project-wide update from 11.0.0-alpha.5 |

## Project-Wide Updates

### pnpm 11.0.0-alpha.11
- `package.json` → `"packageManager": "pnpm@11.0.0-alpha.11"`

### Node 25.7.0
- `package.json` → `"engines": { "node": ">=25.0.0" }`
- CI workflow → `node-version: '25.7.0'`

## CI/CD Pipeline

### Workflow: `.github/workflows/ci.yml`

Single job `ci` on `ubuntu-latest` (15min timeout):
1. Checkout with `fetch-depth: 2` (for `--affected` comparison)
2. pnpm setup via `pnpm/action-setup@v4` (reads version from `packageManager`)
3. Node setup via `actions/setup-node@v4` with `node-version: '25.7.0'`, `cache: 'pnpm'`
4. `pnpm install --frozen-lockfile`
5. `pnpm --filter @nextcalc/database postinstall` (Prisma generate — gitignored)
6. `pnpm turbo run lint typecheck build test --affected`

Environment variables:
- `TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}`
- `TURBO_TEAM: ${{ vars.TURBO_TEAM }}`

### Renovate: `renovate.json`

- Extends: `config:recommended`, `group:monorepos`, `group:recommended`
- Automerge minor + patch updates
- Groups: `@types/*`, linting tools
- `prConcurrentLimit: 5`, `rangeStrategy: "bump"`

### Post-Deployment Manual Steps
- Configure branch protection on `main` requiring `ci` job to pass
- Install Renovate Bot GitHub App
- Optionally install Socket.dev GitHub App
- Set `TURBO_TOKEN` secret and `TURBO_TEAM` variable in GitHub repo settings

## PWA Serwist Migration

### New Dependencies (`apps/web/package.json`)
- `@serwist/next@9.5.6` (dependency)
- `serwist@9.5.6` (devDependency)

### New Files

**`apps/web/app/sw.ts`** — Typed service worker:
- `Serwist` class with `precacheEntries: self.__SW_MANIFEST`
- `skipWaiting: true`, `clientsClaim: true`, `navigationPreload: true`
- `runtimeCaching: defaultCache` (cache-first assets, network-first API, SWR pages)
- Offline fallback to `/~offline`

**`apps/web/app/~offline/page.tsx`** — Offline fallback:
- "You're offline" message
- Links to core cached pages
- Uses existing OKLCH design tokens

### Modified Files

**`apps/web/next.config.ts`**:
- Wrap export with `withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', disable: process.env.NODE_ENV === 'development' })`

**`apps/web/tsconfig.json`**:
- Add `"@serwist/next/typings"` to `compilerOptions.types`
- Add `"webworker"` to `compilerOptions.lib`

**`.gitignore`**:
- Add `public/sw.js`, `public/swe-worker*`

### Deleted Files
- `apps/web/public/sw.js` — replaced by Serwist-generated output

### Unchanged
- `manifest.json` — already correct
- `install-pwa.tsx` — already works independently
- `layout.tsx` metadata — already has manifest + apple-touch-icon
