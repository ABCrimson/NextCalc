# NextCalc Pro - Setup Guide

This guide covers setting up the database (Neon PostgreSQL) and OAuth authentication (Google, GitHub) for NextCalc Pro.

## Table of Contents
- [Database Setup (Neon PostgreSQL)](#database-setup-neon-postgresql)
- [OAuth Setup (Google & GitHub)](#oauth-setup-google--github)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Database Setup (Neon PostgreSQL)

### Why Neon?

- **Serverless**: Scales to zero when idle
- **Free Tier**: Generous free plan for development
- **Fast**: Global edge locations
- **Branching**: Database branches for dev/staging

**Alternatives**: Supabase, Railway, AWS RDS, or any PostgreSQL instance.

### Step 1: Create a Neon Account

1. Go to [neon.tech](https://neon.tech) and sign up
2. Click **New Project** with name `nextcalc-pro`
3. Choose PostgreSQL 15+ and your closest region
4. Copy the **pooled connection string** (recommended for serverless)

### Step 2: Configure Environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Update `apps/web/.env.local`:
```env
DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"
DIRECT_DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"
```

### Step 3: Initialize Database

```bash
pnpm install
pnpm --filter @nextcalc/database db:generate
pnpm --filter @nextcalc/database db:push        # Development
# OR
pnpm --filter @nextcalc/database db:migrate  # Production
```

### Step 4: Verify

```bash
pnpm --filter @nextcalc/database db:studio  # Opens at http://localhost:5555
```

### Step 5: Seed Data (Optional)

Seed the database with starter content (50+ problems, the topic hierarchy, algorithms, theorems, and achievements) via the seed script in `packages/database/prisma/seed.ts`:

```bash
pnpm --filter @nextcalc/web db:seed
```

This requires `DATABASE_URL` to be set (see above). You can also create records through the app or Prisma Studio instead.

---

## OAuth Setup (Google & GitHub)

### Prerequisites

- Database setup complete (above)
- App running locally at `http://localhost:3005`

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named `NextCalc Pro`
3. Enable **Google+ API** (APIs & Services > Library)
4. Configure **OAuth consent screen** (External):
   - App name: `NextCalc Pro`
   - Scopes: `userinfo.email`, `userinfo.profile`
   - Add your email as test user
5. Create **OAuth client ID** (Credentials > Create > Web application):
   - Authorized origins: `http://localhost:3005`
   - Redirect URI: `http://localhost:3005/api/auth/callback/google`
6. Copy Client ID and Client Secret

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) > OAuth Apps
2. Click **New OAuth App**:
   - Homepage URL: `http://localhost:3005`
   - Callback URL: `http://localhost:3005/api/auth/callback/github`
3. Click **Register application**
4. Generate and copy Client Secret (shown only once)

### Add Credentials to Environment

```env
# apps/web/.env.local
NEXTAUTH_URL="http://localhost:3005"
AUTH_SECRET="generate-with-openssl-rand-base64-32"   # NEXTAUTH_SECRET accepted as a legacy fallback

AUTH_GOOGLE_ID="xxxxx.apps.googleusercontent.com"    # GOOGLE_CLIENT_ID / GOOGLE_ID accepted as fallbacks
AUTH_GOOGLE_SECRET="GOCSPX-xxxxx"                     # GOOGLE_CLIENT_SECRET / GOOGLE_SECRET accepted as fallbacks

AUTH_GITHUB_ID="xxxxx"                                # GITHUB_CLIENT_ID / GITHUB_ID accepted as fallbacks
AUTH_GITHUB_SECRET="xxxxx"                            # GITHUB_CLIENT_SECRET / GITHUB_SECRET accepted as fallbacks
```

> NextAuth v5 reads the `AUTH_*` names first and falls back to the legacy `*_CLIENT_*` / `*_ID` / `*_SECRET` and `NEXTAUTH_SECRET` names. The `.env.example` ships the legacy `*_CLIENT_*` names, which still work.

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 32
# Windows PowerShell:
[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))
```

### Test OAuth Flow

1. `pnpm dev` and open `http://localhost:3005`
2. Click Sign In > Sign in with Google/GitHub (the custom sign-in page is at `/auth/signin`)
3. Authorize and verify redirect back to app
4. Verify user record created in database via Prisma Studio

### Production OAuth

Create **separate** OAuth apps for production:
- Google: redirect URI `https://nextcalc.io/api/auth/callback/google`
- GitHub: callback URL `https://nextcalc.io/api/auth/callback/github`
- Update `NEXTAUTH_URL` to production domain

---

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Application URL |
| `AUTH_SECRET` | NextAuth v5 encryption secret (`NEXTAUTH_SECRET` accepted as legacy fallback) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (`GOOGLE_CLIENT_ID` / `GOOGLE_ID` accepted as fallbacks) |
| `AUTH_GOOGLE_SECRET` | Google OAuth secret (`GOOGLE_CLIENT_SECRET` / `GOOGLE_SECRET` accepted as fallbacks) |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID (`GITHUB_CLIENT_ID` / `GITHUB_ID` accepted as fallbacks) |
| `AUTH_GITHUB_SECRET` | GitHub OAuth secret (`GITHUB_CLIENT_SECRET` / `GITHUB_SECRET` accepted as fallbacks) |

### Optional

| Variable | Description |
|----------|-------------|
| `DIRECT_DATABASE_URL` | Direct (non-pooled) connection |
| `UPSTASH_REDIS_REST_URL` | Redis for rate limiting/caching |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `NEXT_PUBLIC_ENABLE_PLOT_ENGINE` | Reserved/unused — declared as a Turbo env passthrough but no code currently reads it |

---

## Troubleshooting

### Database

| Error | Solution |
|-------|----------|
| "Can't reach database server" | Check connection string, ensure `?sslmode=require`, wake Neon project |
| "P3014: Could not create shadow database" | Use `prisma db push` instead of `migrate dev` for Neon |
| Connection pooling issues | Use pooled connection string: `?sslmode=require&pgbouncer=true` |
| Missing Prisma client | Run `pnpm --filter @nextcalc/database db:generate` |

### OAuth

| Error | Solution |
|-------|----------|
| `redirect_uri_mismatch` | Verify redirect URI exactly matches OAuth app config |
| `invalid_client` | Double-check credentials, restart dev server |
| "Access blocked: invalid request" | Complete OAuth consent screen setup, add test users |
| Session not persisting | Check DATABASE_URL, verify Session model in schema, run `prisma db push` |

---

## Stack Versions

Exact dependency versions live in each package's `package.json`; see the Tech Stack table in the root [README](../README.md).

## Next Steps

1. Continue to [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
2. Start development: `pnpm dev`
