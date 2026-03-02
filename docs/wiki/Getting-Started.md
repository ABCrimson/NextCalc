# Getting Started

## Prerequisites

- **Node.js** >= 20.0.0 (recommended: 26.x)
- **pnpm** >= 11

## Installation

```bash
git clone https://github.com/ABCrimson/NextCalc.git
cd NextCalc
pnpm install
```

## Environment Setup

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host.neon.tech:5432/db?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# OAuth (optional -- only include providers with credentials)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."

# Redis (optional)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

## Database Initialization

```bash
pnpm --filter @nextcalc/database db:generate
pnpm --filter @nextcalc/database db:push
```

## Start Development

```bash
pnpm dev
# Open http://localhost:3005
```

## Useful Commands

| Command | Description |
|:--------|:------------|
| `pnpm dev` | Start all packages in dev mode |
| `pnpm build` | Build everything (Turborepo) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | Lint with Biome |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm --filter @nextcalc/database db:studio` | Open Prisma Studio |

## Troubleshooting

### Prisma 7 client not generated

If you see errors about missing Prisma client or unresolved `@nextcalc/database` imports, the generated client needs to be created:

```bash
pnpm --filter @nextcalc/database db:generate
```

This runs Prisma's `prisma-client` generator and outputs to `packages/database/src/generated/prisma/`.

### pnpm not found

On Windows machines where pnpm is not in PATH, use npx as a wrapper:

```bash
npx --yes pnpm@latest <command>
```

For example: `npx --yes pnpm@latest install` or `npx --yes pnpm@latest dev`.

### Neon connection timeout

If you see `"No database host or connection string"` or connection timeout errors:

1. Verify `DATABASE_URL` is set correctly in `apps/web/.env.local`
2. Ensure your Neon project is active (free-tier projects suspend after 5 minutes of inactivity)
3. Confirm the connection string uses `?sslmode=require`
4. Note: Prisma 7's `PrismaNeon` adapter takes a config object `{ connectionString }`, **not** a Pool instance

### Build fails with allowBuilds error

pnpm 11 requires an `allowBuilds` map in `pnpm-workspace.yaml` for packages with postinstall scripts:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  esbuild: true
  prisma: true
```

The older `pnpm.onlyBuiltDependencies` field in `package.json` is not reliably supported in pnpm 11.

---

## Next Steps

- Read the [[Architecture]] page to understand the system design
- Check [[Deployment]] for production setup
- See the [[GraphQL API]] for backend documentation
