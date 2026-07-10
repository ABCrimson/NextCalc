# NextCalc Pro Web

The main product surface: a Next.js 16 App Router frontend serving the scientific calculator, 2D/3D plotting, symbolic math, algorithm visualizations, forum, and learning platform -- 48 page routes across 8 locales.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack dev / Webpack build), React 19.3
- **Language:** TypeScript 6.0.x -- this package is one of two in the monorepo still pinned to the classic compiler (not the TypeScript 7 native/Go compiler most other packages use), because Next.js's build-time type checker and `graphql-codegen` both need the TypeScript JS API, which only ships in TS 7.1 (see [DEVELOPMENT.md](../../DEVELOPMENT.md#typescript))
- **Styling:** Tailwind CSS 4 (CSS-first `@theme` config, OKLCH color tokens)
- **Components:** Radix UI (unified `radix-ui` package) + shadcn/ui (CLI-installed, lives in `components/ui/`)
- **Animation:** Motion (`motion/react`)
- **State:** Zustand
- **Data:** Apollo Client (GraphQL) + `@nextcalc/math-engine` + `@nextcalc/plot-engine` (client-side compute/render) + Server Components/Actions for persistence
- **i18n:** `next-intl`
- **PWA:** `@serwist/next` (service worker, offline fallback, precaching)

> Exact pinned versions live in [`package.json`](package.json).

## Project Structure

```
apps/web/
├── app/
│   ├── [locale]/            # All page routes, under the locale segment
│   │   ├── algorithms/      #   Algorithm hub + 10 sub-pages (A*, Dijkstra, ZKP, quantum, ...)
│   │   ├── auth/signin/     #   OAuth sign-in
│   │   ├── chaos/           #   Lorenz attractor + bifurcation (WebGPU)
│   │   ├── complex/         #   Complex number operations
│   │   ├── forum/           #   Community forum (GraphQL)
│   │   ├── fourier/         #   Fourier analysis
│   │   ├── game-theory/     #   Nash equilibrium solver
│   │   ├── graphs-full/     #   Full graph algorithm suite
│   │   ├── learn/           #   Interactive learning platform
│   │   ├── matrix/          #   Matrix operations
│   │   ├── ml-algorithms/   #   ML algorithm demos
│   │   ├── pde/             #   PDE solver (heat, wave, Laplace)
│   │   ├── plot/            #   2D/3D function plotter
│   │   ├── practice/        #   Practice problems
│   │   ├── problems/        #   Problem browser + number theory
│   │   ├── profile/         #   User profile
│   │   ├── settings/        #   User settings
│   │   ├── solver/          #   Equation + ODE solver
│   │   ├── stats/           #   Statistics calculator
│   │   ├── symbolic/        #   Symbolic differentiation/integration, Taylor series
│   │   ├── units/           #   Unit converter
│   │   ├── worksheet(s)/    #   Jupyter-like worksheets
│   │   ├── layout.tsx       #   Locale-scoped root layout
│   │   ├── page.tsx         #   Calculator home page (/)
│   │   ├── error.tsx / global-error.tsx / not-found.tsx / loading.tsx
│   │   └── ~offline/        #   Serwist offline fallback route
│   ├── api/graphql/         # Apollo Server route handler (injects real NextAuth via createHandler)
│   └── globals.css          # OKLCH design tokens, Tailwind 4 @theme
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── calculator/          # Calculator feature components
│   ├── plots/ plot/         # Plot visualization components
│   ├── algorithms/          # Algorithm visualization demos
│   ├── forum/ profile/ worksheet/ chaos/ fourier/ math/ practice/ problems/ layout/ providers/
│   └── install-pwa.tsx
├── lib/
│   ├── auth/                # NextAuth session hooks/adapters
│   ├── graphql/              # Apollo Client setup + generated codegen output
│   ├── hooks/                # Custom React hooks
│   ├── stores/               # Zustand stores (calculator, worksheet, bookmarks, settings)
│   ├── solvers/               # Client-side solver glue over @nextcalc/math-engine
│   ├── workers/                # Web Worker scripts
│   ├── cms/ monitoring/ validations/
│   └── redis.ts, prisma.ts, latex.ts, share.ts, export-client.ts, utils.ts
├── i18n/                    # next-intl routing, request config, navigation helpers
├── messages/                 # {locale}.json translation files (8 locales)
├── public/                   # Static assets, PWA icons, manifest.json
├── e2e/                       # Playwright end-to-end specs
├── __tests__/                 # Vitest unit + accessibility tests
├── codegen.ts                 # GraphQL Code Generator config
├── next.config.ts             # Next.js config (wraps withSerwist + withNextIntl + Sentry)
├── auth.ts / auth.config.ts   # NextAuth v5 setup
└── proxy.ts                   # Locale detection + redirect (Next.js 16 renamed middleware.ts -> proxy.ts)
```

## Commands

```bash
pnpm dev                 # Turbopack dev server on port 3005
pnpm build                # Production build (Webpack -- see next.config.ts)
pnpm start                 # Serve the production build
pnpm test                  # Vitest unit tests
pnpm test:e2e               # Playwright end-to-end tests
pnpm test:e2e:ui             # Playwright UI mode
pnpm typecheck                # tsc --noEmit against tsconfig.typecheck.json
pnpm lint / lint:fix            # Biome
pnpm db:seed                     # Seed the database (delegates to @nextcalc/database)
```

See [DEVELOPMENT.md](../../DEVELOPMENT.md) at the repo root for the full monorepo command set, environment setup, and code conventions.

## Internationalization

8 locales via `next-intl`: `en` (source of truth), `ru`, `es`, `uk`, `de`, `fr`, `ja`, `zh`. Routing lives in `i18n/routing.ts` (`defineRouting`), request-scoped message loading in `i18n/request.ts`, and locale detection/redirect in `proxy.ts`. Translation keys are not at full parity across all locales -- see [docs/wiki/Internationalization.md](../../docs/wiki/Internationalization.md) for the current per-locale key counts.

## GraphQL Codegen

Typed GraphQL documents are generated by `graphql-codegen` using the config at `codegen.ts`, reading the schema from `@nextcalc/api` and the operations under `lib/graphql/`. Output lands in `lib/graphql/generated/` (`graphql.ts`, `gql.ts`) and is what components import via the typed `graphql()` document helper -- see the codegen deps note in [DEVELOPMENT.md](../../DEVELOPMENT.md). There is no root `pnpm codegen` script; run the CLI directly (e.g. `npx graphql-codegen --config apps/web/codegen.ts`) when the schema or operations change.

## PWA

The app is an installable PWA via `@serwist/next`: `next.config.ts` wraps the Next config with `withSerwistInit`, which generates the service worker (precaching, `~offline/` fallback route) at build time. `components/install-pwa.tsx` handles the install prompt. See [docs/ROADMAP.md](../../docs/ROADMAP.md) for known gaps in offline-fallback verification.

## Further Reading

- [ARCHITECTURE.md](../../ARCHITECTURE.md) -- system-wide architecture and design decisions
- [DEVELOPMENT.md](../../DEVELOPMENT.md) -- monorepo developer guide
- [docs/SETUP.md](../../docs/SETUP.md) -- database and OAuth setup
- [docs/wiki](https://github.com/ABCrimson/NextCalc/wiki) -- full reference wiki
