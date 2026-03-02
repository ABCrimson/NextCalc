# NextCalc Pro

**Scientific Calculator & Mathematical Visualization Platform**

> **Current Release: v1.1.3** (March 2, 2026) — [Release Notes](https://github.com/ABCrimson/NextCalc/releases/tag/v1.1.3)

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

## Latest Updates (v1.1.3)

- **Performance audit**: 9 DataLoaders eliminate N+1 queries across all GraphQL resolvers; recursive query complexity analysis prevents abusive deep queries
- **Security hardening**: IDOR protection on all mutations (ownership validation), timing-safe key comparison in rate-limiter, JWT verification for WebSocket subscriptions via `jose.jwtVerify()`
- **Type safety**: Zero `as any` in all production code across the entire monorepo; strict `exactOptionalPropertyTypes` enforced
- **Error sanitization**: Internal server errors are no longer leaked to API clients; structured error codes returned instead

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
| Linting | Biome 2.5.0 |
