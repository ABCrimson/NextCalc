# CI/CD Pipeline + PWA Serwist Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GitHub Actions CI with Turborepo `--affected` and Vercel remote cache, migrate the manual service worker to Serwist 9.5.6, update pnpm to 11.0.0-alpha.11 and Node to 25.7.0.

**Architecture:** Single CI job runs lint/typecheck/build/test via Turbo's `--affected` flag, caching artifacts through Vercel's remote cache. Serwist replaces the handwritten `sw.js` with a typed `app/sw.ts` that auto-precaches build output and provides runtime caching strategies + an offline fallback page.

**Tech Stack:** GitHub Actions, Turborepo 2.8.10, pnpm 11.0.0-alpha.11, Node 25.7.0, Serwist 9.5.6, Renovate Bot

**Design doc:** `docs/plans/2026-02-24-cicd-pwa-design.md`

---

### Task 1: Update pnpm and Node versions

**Files:**
- Modify: `package.json` (root)

**Step 1: Update packageManager field**

In `package.json`, change:
```json
"packageManager": "pnpm@11.0.0-alpha.5"
```
to:
```json
"packageManager": "pnpm@11.0.0-alpha.11"
```

**Step 2: Update engines field**

In `package.json`, change:
```json
"engines": {
  "node": ">=24.0.0",
  "pnpm": ">=10.0.0"
}
```
to:
```json
"engines": {
  "node": ">=25.0.0",
  "pnpm": ">=11.0.0"
}
```

**Step 3: Verify pnpm install still works**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@11.0.0-alpha.11 install 2>&1"`
Expected: Install completes without errors. Lockfile may update with new pnpm version metadata.

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: update pnpm to 11.0.0-alpha.11, node engines to >=25.0.0"
```

---

### Task 2: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  ci:
    name: Build, Lint & Test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '25.7.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter @nextcalc/database postinstall

      - name: Lint, typecheck, build & test
        run: pnpm turbo run lint typecheck build test --affected
```

**Step 2: Verify YAML is valid**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; node -e \"const fs=require('fs'); const y=require('C:/Users/alber/Desktop/Projects/NextCalc/node_modules/yaml/dist/index.js'); y.parse(fs.readFileSync('.github/workflows/ci.yml','utf8')); console.log('Valid YAML')\" 2>&1"`

If no yaml parser is available, just visually confirm the indentation is correct. GitHub Actions is very sensitive to YAML formatting.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow with Turbo --affected and Vercel remote cache"
```

---

### Task 3: Create Renovate Bot configuration

**Files:**
- Create: `renovate.json`

**Step 1: Create the config file**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "group:monorepos",
    "group:recommended",
    ":automergeMinor",
    ":automergePatch"
  ],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "groupName": "type definitions"
    },
    {
      "matchPackagePatterns": ["biome", "prettier"],
      "groupName": "linting tools"
    }
  ],
  "prConcurrentLimit": 5,
  "rangeStrategy": "bump"
}
```

**Step 2: Commit**

```bash
git add renovate.json
git commit -m "ci: add Renovate Bot config for automated dependency updates"
```

---

### Task 4: Install Serwist dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install @serwist/next and serwist**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@11.0.0-alpha.11 --filter @nextcalc/web add @serwist/next@9.5.6 2>&1"`

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@11.0.0-alpha.11 --filter @nextcalc/web add -D serwist@9.5.6 2>&1"`

**Step 2: Verify they appear in package.json**

Check `apps/web/package.json` contains:
- `"@serwist/next": "9.5.6"` in dependencies
- `"serwist": "9.5.6"` in devDependencies

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: install @serwist/next@9.5.6 and serwist@9.5.6"
```

---

### Task 5: Create typed service worker

**Files:**
- Create: `apps/web/app/sw.ts`

**Step 1: Write the service worker source**

```typescript
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        revision: crypto.randomUUID(),
      },
    ],
  },
});

serwist.addEventListeners();
```

**Step 2: Commit**

```bash
git add apps/web/app/sw.ts
git commit -m "feat(pwa): add typed Serwist service worker source"
```

---

### Task 6: Create offline fallback page

**Files:**
- Create: `apps/web/app/~offline/page.tsx`

**Step 1: Write the offline page**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline — NextCalc Pro',
  description: 'You are currently offline.',
};

const cachedPages = [
  { name: 'Calculator', href: '/' },
  { name: 'Plot', href: '/plot' },
  { name: 'Matrix', href: '/matrix' },
  { name: 'Solver', href: '/solver' },
  { name: 'Units', href: '/units' },
  { name: 'Stats', href: '/stats' },
  { name: 'Symbolic', href: '/symbolic' },
];

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-6xl" role="img" aria-label="No connection">
          &#x1F4F4;
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mb-8 text-muted-foreground">
          Check your internet connection and try again. Some pages may still be
          available from cache:
        </p>
        <nav aria-label="Cached pages">
          <ul className="space-y-2">
            {cachedPages.map((page) => (
              <li key={page.href}>
                <a
                  href={page.href}
                  className="inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {page.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/~offline/page.tsx
git commit -m "feat(pwa): add offline fallback page"
```

---

### Task 7: Wrap next.config.ts with Serwist

**Files:**
- Modify: `apps/web/next.config.ts`

**Step 1: Add Serwist wrapper**

At the top of the file, add the import:
```typescript
import withSerwistInit from '@serwist/next';
```

After the `nextConfig` object (before `export default`), add:
```typescript
const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});
```

Change the export from:
```typescript
export default nextConfig;
```
to:
```typescript
export default withSerwist(nextConfig);
```

The final file should look like:
```typescript
import { resolve } from 'node:path';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

/**
 * Next.js 16.2.0 Configuration
 * ...existing comment...
 */
const nextConfig: NextConfig = {
  // ...all existing config unchanged...
};

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
```

**Step 2: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(pwa): wrap next.config.ts with Serwist plugin"
```

---

### Task 8: Update tsconfig.json for service worker types

**Files:**
- Modify: `apps/web/tsconfig.json`

**Step 1: Add Serwist types and webworker lib**

The current `compilerOptions` has no `types` or `lib` fields (inherits from root which has `"lib": ["ESNext", "DOM", "DOM.Iterable"]`).

Add to `compilerOptions`:
```json
"types": ["@serwist/next/typings"],
"lib": ["ESNext", "DOM", "DOM.Iterable", "WebWorker"]
```

The full `compilerOptions` section becomes:
```json
"compilerOptions": {
  "verbatimModuleSyntax": true,
  "types": ["@serwist/next/typings"],
  "lib": ["ESNext", "DOM", "DOM.Iterable", "WebWorker"],
  "plugins": [
    {
      "name": "next"
    }
  ],
  "paths": {
    ...existing paths unchanged...
  },
  "noEmit": true
}
```

**Step 2: Commit**

```bash
git add apps/web/tsconfig.json
git commit -m "chore: add Serwist typings and WebWorker lib to tsconfig"
```

---

### Task 9: Update .gitignore and delete old sw.js

**Files:**
- Modify: `.gitignore` (root)
- Delete: `apps/web/public/sw.js`

**Step 1: Add Serwist generated files to .gitignore**

Append to the root `.gitignore`:
```
# Serwist generated service worker (built from apps/web/app/sw.ts)
public/sw.js
public/sw.js.map
public/swe-worker*
```

**Step 2: Delete the old handwritten service worker**

Run: `rm apps/web/public/sw.js`

**Step 3: Commit**

```bash
git add .gitignore
git rm apps/web/public/sw.js
git commit -m "chore: gitignore Serwist output, remove handwritten sw.js"
```

---

### Task 10: Verify the build works

**Step 1: Run full build**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@11.0.0-alpha.11 turbo run build 2>&1"`

Expected: Build completes. Serwist should log that it generated `public/sw.js` from `app/sw.ts`. The `~offline` page should be included in the build output.

**Step 2: Verify sw.js was generated**

Check that `apps/web/public/sw.js` exists (created by Serwist build, gitignored).

**Step 3: Run lint and typecheck**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@11.0.0-alpha.11 turbo run lint typecheck 2>&1"`

Expected: No new errors from the changes.

**Step 4: Run tests**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@11.0.0-alpha.11 turbo run test 2>&1"`

Expected: Existing tests still pass.

**Step 5: Final commit if any fixes were needed**

Only if prior steps required adjustments:
```bash
git add -A
git commit -m "fix: resolve build issues from CI/CD and PWA migration"
```
