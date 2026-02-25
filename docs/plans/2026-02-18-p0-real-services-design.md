# P0: Replace Stubs With Real Services

**Date:** 2026-02-18
**Status:** Approved

## Summary

Replace auth-stub, prisma-stub, and redis-stub with real service integrations. Wire the frontend to the GraphQL API via Apollo Client.

## Decisions

- **Database:** Neon PostgreSQL (already coded, just needs credentials)
- **Auth:** NextAuth v5 with Google + GitHub OAuth (already fully implemented in `apps/web/auth.ts`)
- **Redis:** Upstash Redis REST (`@upstash/redis`) in both web and API (replacing ioredis in web, replacing no-op stub in API)
- **GraphQL Client:** Apollo Client in `apps/web`

## Step 1: Database (Neon)

- Consolidate Prisma schemas (web schema is source of truth, has learning platform models API schema lacks)
- Add missing `CalculationHistory` Prisma model (exists in GraphQL schema but not Prisma)
- User creates Neon project, sets `DATABASE_URL` + `DIRECT_DATABASE_URL`
- Run `prisma db push` to create tables
- Wire `saveCalculation` server action to persist

## Step 2: Authentication (NextAuth v5)

- User creates Google + GitHub OAuth apps (dev, localhost callbacks)
- Generate `AUTH_SECRET`, add to `.env.local`
- Fix API auth: import real `auth()` from web app instead of auth-stub (they share the same Next.js process)
- Test sign-in/sign-out end-to-end

## Step 3: Redis (Upstash)

- Rewrite `apps/web/lib/redis.ts` from ioredis to `@upstash/redis`, keep same exported interface
- Create real Redis implementation for API replacing redis-stub
- User creates Upstash Redis database, sets `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Unify env var naming across both apps

## Step 4: Frontend-API Integration (Apollo Client)

- Install `@apollo/client` in `apps/web`
- Create ApolloProvider wrapping the app
- Wire: auth-dependent UI, calculation history persistence, worksheet CRUD
- Keep math engine calls client-side (Web Worker), only persist results via GraphQL
- Forum and other features deferred to later phase
