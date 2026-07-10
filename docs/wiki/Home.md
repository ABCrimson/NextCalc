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

## Latest Updates (v1.5.x)

**v1.5.1 hotfix** — restored the level-icon avatars (they were data-referenced, not dead code), fixed comment upvotes (a schema defect dating to February — they had never worked), comment posting no longer collapses the thread, Lorenz GPU particles render again (upright, in their cage), ODE view auto-fits the solution, PDE 3D colormap works in the default view, and the profile owner gained an admin-only avatar icon picker.

- **Evergreen dependency sweep**: every dependency at its absolute-newest published version in any channel — Next.js 16.3 canary, React 19.3 canary, graphql 17, Vitest 5, Prisma 7.9, pnpm 11 GA — and **TypeScript 7.1 (native Go compiler) is now the blocking typecheck gate for 8 of the 10 packages** (full-workspace typecheck ~6 min → ~22 s); `@nextcalc/web` and `@nextcalc/plot-engine` remain on classic TypeScript 6.0.x pending upstream fixes -- see [[Architecture]]
- **React Compiler enabled** across the web app, plus GraphQL fragment masking with `useFragment`
- **Real cross-instance GraphQL subscriptions**: Redis Streams events are actually consumed (overlap-proof, tip-anchored polling) — multi-instance SSE delivery now works
- **Plot correctness**: adaptive-sampling fixes (grid-resonance aliasing that flattened functions like sin(10πx), lost discontinuity breaks at asymptotes, an inverted refinement criterion), bounded sample cache, stale-geometry and VAO fixes — see [[Plot-Engine]]
- **Math engine**: `Complex.pow` for arbitrary exponents, compound unit expressions (`km/h`, `kg*m/s^2`), a 16-problem competitive-accuracy regression suite, and CAS polynomial-division fixes including a long-masked infinite loop in `lcmPolynomials` — see [[Math-Engine]]
- **Localization**: the full worksheets namespace now exists, properly translated, in all 8 locales
- **Dead-code purge**: ~115 dead files removed (net −9k lines), shipped through a pre-merge adversarial review (42 agents; 19/20 findings confirmed and fixed)

### Previously (v1.4.0)

- **Forum localization fix**: post views, upvotes, and relative timestamps now render in your selected locale — they were using the runtime default across all 7 non-English locales (ru, es, uk, de, fr, ja, zh)
- **Idiom modernization** (behavior-preserving): code rewritten to the newest idioms of each pinned dependency — Zod 4 (`z.url()`/`z.uuid()`), `motion/react`, Tailwind v4 `bg-linear-*/oklab` + `size-*`, React 19.3 `useEffectEvent`, shadcn `data-slot` across all UI primitives, Hono `zValidator` across all 3 Workers
- **Observability**: real Sentry capture wired (manual errors + error boundaries were console-only) and `instrumentation-client.ts` migration (restores client-side Sentry/navigation tracing under Turbopack)
- **TS7-forward**: the advisory `tsgo` (TypeScript 7 native preview) typecheck shipped green across the non-Three.js-TSL packages — the groundwork for v1.5.0's native gate

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
