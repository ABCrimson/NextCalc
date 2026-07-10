# NextCalc Pro

**Scientific Calculator & Mathematical Visualization Platform**

> **Current Release: v1.4.0** (June 29, 2026) — [Release Notes](https://github.com/ABCrimson/NextCalc/releases/tag/v1.4.0)

[Live Demo](https://nextcalc.io) | [GitHub Repository](https://github.com/ABCrimson/NextCalc) | [Releases](https://github.com/ABCrimson/NextCalc/releases)

---

## Overview

NextCalc Pro is a comprehensive scientific calculator and mathematical visualization platform built as a monorepo with Next.js 16, React 19, TypeScript (7 native for most packages, 6 for `web` and `plot-engine`), and GPU-accelerated rendering.

### Key Numbers

- **48** page routes
- **8** languages (en, ru, es, uk, de, fr, ja, zh)
- **20** math engine modules
- **3** Cloudflare Workers
- **22** GraphQL queries + **20** mutations + **2** subscriptions
- **9** colormaps + **5** HDR cubemap themes

---

## Latest Updates (v1.4.0)

- **Forum localization fix**: post views, upvotes, and relative timestamps now render in your selected locale — they were using the runtime default across all 7 non-English locales (ru, es, uk, de, fr, ja, zh)
- **Idiom modernization** (behavior-preserving): code rewritten to the newest idioms of each pinned dependency — Zod 4 (`z.url()`/`z.uuid()`), `motion/react`, Tailwind v4 `bg-linear-*/oklab` + `size-*`, React 19.3 `useEffectEvent`, shadcn `data-slot` across all UI primitives, Hono `zValidator` across all 3 Workers
- **Observability**: real Sentry capture wired (manual errors + error boundaries were console-only) and `instrumentation-client.ts` migration (restores client-side Sentry/navigation tracing under Turbopack)
- **TS7-forward**: the advisory `tsgo` (TypeScript 7 native preview) typecheck shipped green in v1.4.0 across the non-Three.js-TSL packages. It has since graduated: TypeScript 7 native is now the real, blocking `typecheck` gate for 8 of the 10 packages (the standalone advisory job was removed). `@nextcalc/web` and `@nextcalc/plot-engine` remain on classic TypeScript 6.0.x pending upstream fixes -- see [[Architecture]]

### Previously (v1.3.0)

- **Push-to-newest modernization**: every dependency upgraded to its absolute-newest channel — Next.js 16.3, React 19.3, TypeScript 6.0.3, Apollo Server 5.5.1 / Client 4.3, Prisma 7.9, Tailwind 4.3, Three.js 0.184, Biome 2.5.1, Vitest 5, next-intl 4.13 — with code migrated to each version's current idioms
- **Stricter TypeScript**: re-enabled `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, and `noUnusedLocals` across web + api (143 real fixes, zero `as any`)
- **Accessibility**: ZKP commitment-cell grid restructured to a WAI-ARIA `grid`/`row`/`gridcell` pattern (axe-core verified)
- **Auth**: client session migrated to NextAuth (Auth.js v5) `SessionProvider` + a `useSession` adapter — one shared session context replaces per-component fetch/poll
- **Design**: topic colors and box-shadows moved to semantic OKLCH tokens (verified pixel-identical, zero visual change)
- **math-engine**: iterative cycle-detection DFS (no recursion-depth limits); `astEquals` deduplicated to a single canonical, unary-aware implementation
- **Documentation**: codebase-verified audit of all 38 Markdown files; the GitHub wiki re-synced to match

---

## Quick Links

| Topic | Description |
|:------|:------------|
| [[Getting Started]] | Install, configure, and run locally |
| [[Architecture]] | System design, data flow, and design decisions |
| [[Math Engine]] | 20 computation modules with usage examples |
| [[Plot Engine]] | GPU rendering pipeline and colormaps |
| [[GraphQL API]] | Full API reference (queries, mutations, types) |
| [[Cloudflare Workers]] | Edge microservices (CAS, export, rate limiter) |
| [[Database Schema]] | Prisma models, relationships, and enums |
| [[Internationalization]] | i18n setup and translation workflow |
| [[Deployment]] | Vercel, Cloudflare, and CI/CD |
| [[FAQ]] | Common issues and solutions |

---

## Tech Stack

| Category | Technology |
|:---------|:-----------|
| Framework | Next.js 16.3 canary + React 19.3 canary |
| Language | TypeScript 7 native (8/10 packages); TypeScript 6 for `web` + `plot-engine` -- see [[Architecture]] |
| Styling | Tailwind CSS 4.3 (OKLCH) |
| State | Zustand 5.0 |
| 3D | Three.js 0.185-line |
| ORM | Prisma 7.9 dev |
| GraphQL | Apollo Server 5.5 / Client 4.3 |
| Cache | Upstash Redis |
| Workers | Hono 4.12 on Cloudflare |
| Build | Turborepo 2.10 canary |
| Linting | Biome 2.x |

> Exact pinned versions live in each package's `package.json`.
