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

## Next Steps

- Read the [[Architecture]] page to understand the system design
- Check [[Deployment]] for production setup
- See the [[GraphQL API]] for backend documentation
