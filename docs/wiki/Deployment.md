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
| 4 | `gh workflow run ci.yml` | Manual Action | ~5-8 min | Full CI + deploy |

---

## Web App (Vercel)

The GitHub repository is connected to Vercel. Push to `main` triggers a production deployment automatically.

### Vercel Settings

| Setting | Value |
|:--------|:------|
| Framework | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm install && pnpm build --filter=@nextcalc/web` |
| Install Command | `pnpm install` |
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
cd apps/workers/cas-service && pnpm deploy
cd apps/workers/export-service && pnpm deploy
cd apps/workers/rate-limiter && pnpm deploy
```

Or via GitHub Actions: `.github/workflows/deploy-workers.yml` triggers on changes to `apps/workers/`. Requires `CLOUDFLARE_API_TOKEN` GitHub secret. Each worker deploys independently (`fail-fast: false`).

### Worker URLs

| Worker | Production URL |
|:-------|:---------------|
| CAS Service | `cas.nextcalc.io` |
| Export Service | `export.nextcalc.io` |
| Rate Limiter | `ratelimit.nextcalc.io` |

---

## CI/CD Pipeline

`.github/workflows/ci.yml` runs on every push:

1. **Lint** -- Biome 2.5.0
2. **Typecheck** -- TypeScript 6.0
3. **Test** -- Vitest
4. **Build** -- Turborepo (all packages)

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
