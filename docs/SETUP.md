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
pnpm --filter web prisma generate
pnpm --filter web prisma db push        # Development
# OR
pnpm --filter web prisma migrate dev --name init  # Production
```

### Step 4: Verify

```bash
pnpm --filter web prisma studio  # Opens at http://localhost:5555
```

### Step 5: Seed Data (Optional)

```bash
pnpm --filter web prisma db seed
```

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
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"

GITHUB_ID="xxxxx"
GITHUB_SECRET="xxxxx"
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
# Windows PowerShell:
[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))
```

### Test OAuth Flow

1. `pnpm dev` and open `http://localhost:3005`
2. Click Sign In > Sign in with Google/GitHub
3. Authorize and verify redirect back to app
4. Verify user record created in database via Prisma Studio

### Production OAuth

Create **separate** OAuth apps for production:
- Google: redirect URI `https://yourdomain.com/api/auth/callback/google`
- GitHub: callback URL `https://yourdomain.com/api/auth/callback/github`
- Update `NEXTAUTH_URL` to production domain

---

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Application URL |
| `NEXTAUTH_SECRET` | NextAuth encryption secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GITHUB_ID` | GitHub OAuth client ID |
| `GITHUB_SECRET` | GitHub OAuth secret |

### Optional

| Variable | Description |
|----------|-------------|
| `DIRECT_DATABASE_URL` | Direct (non-pooled) connection |
| `UPSTASH_REDIS_REST_URL` | Redis for rate limiting/caching |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `NEXT_PUBLIC_ENABLE_PLOT_ENGINE` | Enable plot engine (default: true) |

---

## Troubleshooting

### Database

| Error | Solution |
|-------|----------|
| "Can't reach database server" | Check connection string, ensure `?sslmode=require`, wake Neon project |
| "P3014: Could not create shadow database" | Use `prisma db push` instead of `migrate dev` for Neon |
| Connection pooling issues | Use pooled connection string: `?sslmode=require&pgbouncer=true` |
| Missing Prisma client | Run `pnpm --filter web prisma generate` |

### OAuth

| Error | Solution |
|-------|----------|
| `redirect_uri_mismatch` | Verify redirect URI exactly matches OAuth app config |
| `invalid_client` | Double-check credentials, restart dev server |
| "Access blocked: invalid request" | Complete OAuth consent screen setup, add test users |
| Session not persisting | Check DATABASE_URL, verify Session model in schema, run `prisma db push` |

---

## Next Steps

1. Continue to [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
2. Start development: `pnpm dev`
