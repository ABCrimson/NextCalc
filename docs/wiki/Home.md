# NextCalc Pro

**Scientific Calculator & Mathematical Visualization Platform**

> **Current Release: v1.2.1** (March 3, 2026) — [Release Notes](https://github.com/ABCrimson/NextCalc/releases/tag/v1.2.1)

[Live Demo](https://nextcalc.io) | [GitHub Repository](https://github.com/ABCrimson/NextCalc) | [Releases](https://github.com/ABCrimson/NextCalc/releases)

---

## Overview

NextCalc Pro is a comprehensive scientific calculator and mathematical visualization platform built as a monorepo with Next.js 16, React 19, TypeScript 6, and GPU-accelerated rendering.

### Key Numbers

- **47** page routes
- **8** languages (en, ru, es, uk, de, fr, ja, zh)
- **18** math engine modules
- **3** Cloudflare Workers
- **33** GraphQL queries + **24** mutations
- **6** colormaps + **5** HDR cubemap themes

---

## Latest Updates (v1.2.1)

- **CI/CD pipeline fixes**: All 5 jobs now pass (Install, Lint, Typecheck, Build, Test)
- **54 test failures fixed**: API (15), web (35), export-service (3), rate-limiter (1)
- **Biome formatting**: 170+ files reformatted (import organization, line wrapping)
- **New DataLoaders**: `hasUpvoted`, `commentCountByPostId` for efficient forum queries
- **Redis cache**: Added `invalidateByPrefix` (SCAN-based pattern deletion)
- **Comprehensive audit**: 78 issues fixed from v1.2.0 (security, performance, code quality)
- **CI improvements**: `AUTH_SECRET` env var for NextAuth, `actions/checkout@v6` + `actions/setup-node@v6`
- **Workers deploy**: Triggers on `pnpm-lock.yaml` changes, supports `workflow_dispatch`
- **Dependencies**: Added `@graphql-codegen/cli`, `@graphql-typed-document-node/core`; updated lockfile for typedoc

---

## Quick Links

| Topic | Description |
|:------|:------------|
| [[Getting Started]] | Install, configure, and run locally |
| [[Architecture]] | System design, data flow, and design decisions |
| [[Math Engine]] | 18 computation modules with usage examples |
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
| Framework | Next.js 16.2 + React 19.3 |
| Language | TypeScript 6.0 |
| Styling | Tailwind CSS 4.2 (OKLCH) |
| State | Zustand 5.0 |
| 3D | Three.js 0.183 |
| ORM | Prisma 7.5 |
| GraphQL | Apollo Server 5.4 / Client 4.2 |
| Cache | Upstash Redis |
| Workers | Hono 4.12 on Cloudflare |
| Build | Turborepo 2.8 |
| Linting | Biome 2.4.4 |
