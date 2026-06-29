# Deployment

NextCalc Pro is deployed on Vercel (web app) + Cloudflare Workers (edge services).

**Production URL**: [nextcalc.io](https://nextcalc.io)

---

## Deployment Methods

| # | Method | Trigger | Speed | Use Case |
|:--|:-------|:--------|:------|:---------|
| 1 | `git push origin main` | Automatic | ~2-3 min | Standard workflow |
| 2 | Open Pull Request | Automatic | ~2-3 min | Preview + review |
| 3 | `vercel --prod` | Manual CLI | ~2-3 min | Emergency deploy |
| 4 | `gh workflow run deploy-workers.yml` | Manual Action | ~5-8 min | Deploy Cloudflare Workers |

---

## Web App (Vercel)

The GitHub repository is connected to Vercel. Push to `main` triggers a production deployment automatically.

### Vercel Settings

| Setting | Value |
|:--------|:------|
| Framework | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm build --filter=@nextcalc/web` |
| Install Command | `cd ../.. && pnpm install` |
| Node.js Version | 24.x |

### Environment Variables

Set in Vercel Dashboard > Project > Settings > Environment Variables:

- `DATABASE_URL` -- Neon PostgreSQL connection string
- `NEXTAUTH_URL` = `https://nextcalc.io`
- `NEXTAUTH_SECRET` / `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_ID`, `GITHUB_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## Cloudflare Workers

Deploy individually:

```bash
cd apps/workers/cas-service && pnpm run deploy
cd apps/workers/export-service && pnpm run deploy
cd apps/workers/rate-limiter && pnpm run deploy
```

Or via GitHub Actions: `.github/workflows/deploy-workers.yml` triggers on changes to `apps/workers/` and `pnpm-lock.yaml`, and supports `workflow_dispatch` for manual runs. Requires `CLOUDFLARE_API_TOKEN` GitHub secret. Each worker deploys independently (`fail-fast: false`). Uses `actions/checkout@v6` and `actions/setup-node@v6`.

### Worker URLs

| Worker | Production URL |
|:-------|:---------------|
| CAS Service | `cas.nextcalc.io` |
| Export Service | `export.nextcalc.io` |
| Rate Limiter | `ratelimit.nextcalc.io` |

---

## CI/CD Pipeline

`.github/workflows/ci.yml` runs on every push (6 jobs, all passing as of v1.2.2):

1. **Install** -- pnpm install + dependency caching
2. **Lint** -- Biome 2.5.1
3. **Typecheck** -- TypeScript 6.0.3
4. **Typecheck (TS7 tsgo, advisory)** -- `typecheck:fast` via tsgo; non-blocking (`continue-on-error`), surfaces TS7-forward issues without blocking merges.
5. **Test** -- Vitest
6. **Build** -- Turborepo (all packages). Requires `AUTH_SECRET` env var for NextAuth.

**CI tooling** (v1.2.2): `actions/checkout@v6`, `actions/setup-node@v6`, and `pnpm/action-setup@v6` (pnpm 11). CI runs on Node 26, while the Vercel runtime caps at Node 24.x.

---

## Database

```bash
# Push schema changes to production
pnpm --filter @nextcalc/database db:push

# Run migrations
pnpm --filter @nextcalc/database db:migrate:deploy
```

---

## Post-Deployment Checklist

- [ ] Homepage loads at nextcalc.io
- [ ] Calculator performs operations
- [ ] OAuth sign-in works (Google, GitHub)
- [ ] Plot engine renders 2D/3D
- [ ] GraphQL endpoint responds at `/api/graphql`
- [ ] Workers respond to health checks
- [ ] No console errors in browser
