# NextCalc Pro - Deployment Guide

This guide covers deploying NextCalc Pro to production: the web app on Vercel and the three Cloudflare Workers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Web App Deployment (Vercel)](#web-app-deployment-vercel)
- [Cloudflare Workers Deployment](#cloudflare-workers-deployment)
- [Database Setup (Neon PostgreSQL)](#database-setup-neon-postgresql)
- [Redis Setup (Upstash)](#redis-setup-upstash)
- [Environment Variables Reference](#environment-variables-reference)
- [CI/CD Considerations](#cicd-considerations)
- [Post-Deployment Verification](#post-deployment-verification)
- [Custom Domain Setup](#custom-domain-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

1. Code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
2. Production Neon PostgreSQL database with `DATABASE_URL` configured
3. Production OAuth apps (Google + GitHub) with correct redirect URIs
4. Upstash Redis database (optional but recommended for caching/rate limiting)
5. Cloudflare account (for Workers deployment)
6. Local build verified: `pnpm build`

---

## Web App Deployment (Vercel)

### Method 1: Vercel Dashboard

1. Sign up at [vercel.com](https://vercel.com) with GitHub
2. Click "Add New..." then "Project"
3. Import your Git repository
4. Configure project settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm install && pnpm build --filter=@nextcalc/web` |
| Install Command | `pnpm install` |
| Output Directory | `.next` |

5. Add environment variables (see [reference below](#environment-variables-reference))
6. Click "Deploy"

### Method 2: Vercel CLI

```bash
npm install -g vercel
vercel login

# From project root
cd apps/web
vercel          # Preview deployment
vercel --prod   # Production deployment
```

Add environment variables:

```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
# ... repeat for all variables
```

### Continuous Deployment

Once connected, Vercel deploys automatically:

- **Push to `main`** -- Production deployment
- **Push to other branches** -- Preview deployment
- **Pull requests** -- Automatic preview with unique URL

---

## Cloudflare Workers Deployment

Three workers need individual deployment:

### Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### Create Required Resources

```bash
# For rate-limiter: create KV namespace
wrangler kv:namespace create "RATE_LIMITS"
# Copy the namespace ID to apps/workers/rate-limiter/wrangler.toml

# For export-service: create R2 bucket
wrangler r2 bucket create nextcalc-exports-public
# Update bucket name in apps/workers/export-service/wrangler.toml
```

### Deploy Each Worker

```bash
# CAS Service (symbolic math)
cd apps/workers/cas-service
pnpm deploy

# Export Service (LaTeX conversion)
cd apps/workers/export-service
pnpm deploy

# Rate Limiter (API quotas)
cd apps/workers/rate-limiter
pnpm deploy
```

### Worker Configuration

Each worker's `wrangler.toml` needs:

- Correct KV namespace IDs (rate-limiter)
- Correct R2 bucket names (export-service)
- `ALLOWED_ORIGINS` set to your production domain
- Environment variables for any secrets

### Health Checks

After deployment, verify each worker:

```bash
curl https://your-cas-worker.workers.dev/health
curl https://your-export-worker.workers.dev/health
curl https://your-rate-limiter.workers.dev/health
```

---

## Database Setup (Neon PostgreSQL)

### 1. Create Neon Project

1. Sign up at [neon.tech](https://neon.tech)
2. Create project named `nextcalc-pro`
3. Choose PostgreSQL 15+ and your closest region
4. Copy the **pooled connection string** (recommended for serverless)

### 2. Configure Connection Strings

```env
DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"
DIRECT_DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"
```

For production with connection pooling:

```
postgresql://user:pass@host.neon.tech/db?sslmode=require&pgbouncer=true
```

### 3. Apply Schema

```bash
# From project root
pnpm --filter @nextcalc/database db:push
```

For production migrations:

```bash
pnpm --filter @nextcalc/database db:migrate:deploy
```

### 4. Verify

```bash
pnpm --filter @nextcalc/database db:studio
```

---

## Redis Setup (Upstash)

### 1. Create Upstash Database

1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Choose the region closest to your Vercel deployment
4. Copy the REST URL and token

### 2. Configure

```env
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

### Usage

Redis is used for:

- API rate limiting (Upstash Ratelimit in `apps/api`)
- Application caching (hot data, user sessions)

---

## Environment Variables Reference

### Required (Web App)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host.neon.tech/db?sslmode=require` |
| `NEXTAUTH_URL` | Production URL of your app | `https://nextcalc.com` |
| `NEXTAUTH_SECRET` | Encryption secret (32+ chars) | Generate with `openssl rand -base64 32` |

### OAuth (Required for Authentication)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GITHUB_ID` | GitHub OAuth client ID |
| `GITHUB_SECRET` | GitHub OAuth secret |

> **Important:** Only include OAuth providers whose credentials you have configured. Empty credentials cause NextAuth `Configuration` errors.

### Optional

| Variable | Description | When Needed |
|----------|-------------|-------------|
| `DIRECT_DATABASE_URL` | Non-pooled Neon connection | Prisma migrations |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | Rate limiting, caching |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | With Redis |
| `NEXT_PUBLIC_ENABLE_PLOT_ENGINE` | Enable plot engine | Default: true |

### Production OAuth Redirect URIs

Create **separate** OAuth apps for production:

- **Google:** `https://yourdomain.com/api/auth/callback/google`
- **GitHub:** `https://yourdomain.com/api/auth/callback/github`

---

## CI/CD Considerations

### GitHub Actions (Example)

```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm lint
```

### Vercel Integration

Vercel handles CI/CD automatically when connected to your Git repository. Configure in Vercel Dashboard under Settings > Git:

- **Production Branch:** `main`
- **Preview Branches:** All branches or specific pattern

---

## Post-Deployment Verification

After deploying, verify:

- [ ] Homepage loads correctly
- [ ] Calculator performs operations
- [ ] Sign in with Google works (correct redirect URI)
- [ ] Sign in with GitHub works (correct redirect URI)
- [ ] User session persists across page reloads
- [ ] Plot engine renders 2D/3D plots
- [ ] GraphQL endpoint responds at `/api/graphql`
- [ ] No console errors in browser
- [ ] Cloudflare Workers respond to health checks

---

## Custom Domain Setup

### Vercel

1. Go to Project > Settings > Domains
2. Add your domain (e.g., `nextcalc.com`)
3. Configure DNS:
   - **A Record:** `76.76.21.21`
   - **CNAME (www):** `cname.vercel-dns.com`
4. Update `NEXTAUTH_URL` to `https://nextcalc.com`
5. Update OAuth redirect URIs to use the new domain
6. SSL is provisioned automatically by Vercel

### Cloudflare Workers

Configure custom domains via Cloudflare Dashboard or `wrangler.toml`:

```toml
routes = [
  { pattern = "cas.nextcalc.com/*", zone_name = "nextcalc.com" }
]
```

---

## Troubleshooting

### Build Failures

| Error | Solution |
|-------|----------|
| "Module not found" | `vercel --force` or clear cache in dashboard |
| Turborepo cache issues | Set `TURBO_FORCE=true` in Vercel env |
| Prisma client missing | Ensure `postinstall` runs `prisma generate` |

### Runtime Errors

| Error | Solution |
|-------|----------|
| Database connection fails | Check `DATABASE_URL`, ensure `?sslmode=require`, wake Neon project |
| OAuth redirect mismatch | Verify `NEXTAUTH_URL` matches deployment URL exactly |
| 404 on API routes | Check root directory setting in Vercel |
| KV namespace not found | Create with `wrangler kv:namespace create` and update IDs |
| R2 bucket not found | Create with `wrangler r2 bucket create` |

### Security Checklist

- [ ] `NEXTAUTH_SECRET` is strong and unique (not reused from dev)
- [ ] Database uses SSL (`sslmode=require`)
- [ ] OAuth apps use HTTPS redirect URIs
- [ ] Environment variables are not committed to code
- [ ] CORS origins configured in Workers
- [ ] Rate limiting enabled
