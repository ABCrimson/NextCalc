# NextCalc Pro API

Backend GraphQL API for NextCalc Pro, built with Apollo Server, Prisma, and NextAuth.js.

## Tech Stack

- **Database:** Neon PostgreSQL with Prisma 7.5.0-dev.33
- **API:** GraphQL with Apollo Server 5.4.0
- **Authentication:** Auth.js v5 (NextAuth 5.0-beta.30) with OAuth + jose 6.1.3 JWT verification
- **Caching:** Upstash Redis
- **Rate Limiting:** Upstash Rate Limit
- **Connection Pooling:** Neon Serverless Driver
- **Linting/Formatting:** Biome 2.5.0

## Prerequisites

- Node.js 22+ (26 recommended)
- pnpm 11+
- PostgreSQL database (Neon recommended)
- Upstash Redis account (free tier)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

**Required:**
- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random 32+ character string
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET` - GitHub OAuth credentials
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` - Redis credentials

### 3. Set Up Database

```bash
# Generate Prisma Client
pnpm --filter @nextcalc/database db:generate

# Push schema to database
pnpm --filter @nextcalc/database db:push

# Seed database with sample data (optional)
pnpm --filter @nextcalc/database db:seed
```

### 4. Start Development Server

```bash
pnpm dev
```

GraphQL Playground will be available at: http://localhost:3005/api/graphql

## Project Structure

```
apps/api/
├── src/
│   ├── graphql/
│   │   ├── schema.ts          # GraphQL type definitions (SDL)
│   │   └── resolvers/
│   │       ├── index.ts       # Combined resolvers
│   │       ├── user.ts        # User queries/mutations
│   │       ├── worksheet.ts   # Worksheet CRUD
│   │       ├── folder.ts      # Folder organization
│   │       ├── calculation.ts # Calculation history
│   │       ├── forum.ts       # Forum posts
│   │       ├── profile.ts     # User profile + analytics
│   │       └── shared-calculation.ts  # Shared calculations
│   ├── lib/
│   │   ├── cache.ts           # Upstash Redis caching
│   │   ├── errors.ts          # Custom error classes
│   │   ├── validation.ts      # Zod input schemas
│   │   ├── subscription.ts    # Hybrid Redis + in-memory PubSub
│   │   ├── cursor-pagination.ts # Relay-style connections
│   │   ├── monitoring.ts      # Request logging
│   │   └── logger.ts          # Structured JSON logger
│   ├── plugins/
│   │   └── performance-monitoring.ts  # Apollo plugin
│   ├── server.ts              # Apollo Server setup + context
│   └── index.ts               # Next.js route handler exports
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

### Core Tables

- **users** - User accounts and profiles
- **accounts** - OAuth provider accounts (NextAuth)
- **sessions** - User sessions (NextAuth)
- **worksheets** - Calculator worksheets
- **folders** - Worksheet organization
- **forum_posts** - Community forum posts
- **comments** - Post comments
- **upvotes** - Post/comment voting
- **audit_logs** - Activity tracking

### Relationships

```
User
├── worksheets (1:N)
├── folders (1:N)
├── forum_posts (1:N)
├── comments (1:N)
└── upvotes (1:N)

Worksheet
├── user (N:1)
├── folder (N:1)
└── shares (1:N)

ForumPost
├── user (N:1)
├── comments (1:N)
└── upvotes (1:N)

Comment
├── user (N:1)
├── post (N:1)
├── parent (N:1, self-referential)
└── replies (1:N, self-referential)
```

## GraphQL API

### Queries

```graphql
# Get current user
query Me {
  me {
    id
    name
    email
    worksheets {
      id
      title
    }
  }
}

# List worksheets
query Worksheets($cursor: String, $limit: Int) {
  worksheets(cursor: $cursor, limit: $limit) {
    items {
      id
      title
      description
      updatedAt
    }
    pageInfo {
      hasMore
      nextCursor
    }
  }
}

# Search forum posts
query SearchPosts($query: String!, $tags: [String!]) {
  searchForumPosts(query: $query, tags: $tags) {
    items {
      id
      title
      content
      author {
        name
      }
      upvoteCount
    }
  }
}
```

### Mutations

```graphql
# Create worksheet
mutation CreateWorksheet($input: CreateWorksheetInput!) {
  createWorksheet(input: $input) {
    id
    title
  }
}

# Create forum post
mutation CreatePost($input: CreateForumPostInput!) {
  createForumPost(input: $input) {
    id
    title
  }
}

# Upvote post
mutation UpvotePost($postId: ID!) {
  upvotePost(postId: $postId) {
    success
    upvoteCount
  }
}
```

## Authentication

### OAuth Providers

1. **Google OAuth**
   - Create project at: https://console.cloud.google.com
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Set authorized redirect URI: `http://localhost:3005/api/auth/callback/google`

2. **GitHub OAuth**
   - Register app at: https://github.com/settings/developers
   - Set authorization callback URL: `http://localhost:3005/api/auth/callback/github`

### Session Management

- **Strategy:** JWT (stateless)
- **Expiry:** 30 days
- **Storage:** HTTP-only cookies
- **Refresh:** Automatic on activity

## Caching

### Cache Layers

1. **Apollo Client** (client-side)
   - In-memory cache
   - Automatic cache updates

2. **Vercel Edge** (CDN)
   - Static content caching
   - ISR for worksheets

3. **Upstash Redis** (application)
   - User sessions
   - Rate limit counters
   - Hot data caching

### Cache TTLs

- User profiles: 30 minutes
- Worksheets: 1 hour
- Forum posts: 5 minutes
- Comments: 2 minutes

## Rate Limiting

### Limits by User Type

- **Anonymous:** 100 requests/minute (configurable via `RATE_LIMIT_ANON`)
- **Authenticated:** 1000 requests/minute (configurable via `RATE_LIMIT_AUTH`)

Rate limiting is Redis-backed (Upstash) with a 60-second sliding window. Fails open if Redis is unavailable.

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test --watch
```

## Database Management

```bash
# View database in browser
pnpm --filter @nextcalc/database db:studio

# Push schema changes
pnpm --filter @nextcalc/database db:push

# Generate Prisma client after schema changes
pnpm --filter @nextcalc/database db:generate

# Reset database (DANGER - dev only)
pnpm prisma migrate reset
```

## Performance

### Targets

- API latency (p95): < 200ms
- Database queries (p95): < 50ms
- Cache hit rate: > 80%
- Concurrent users: 1,000+

### Optimization Strategies

1. **DataLoaders** - Batch and cache database queries
2. **Indexes** - Optimize common query patterns
3. **Connection pooling** - Neon serverless driver
4. **Cursor pagination** - Efficient for large datasets
5. **Redis caching** - Reduce database load

## Monitoring

### Key Metrics

- Request rate and latency
- Database connection count
- Cache hit/miss ratio
- Rate limit violations
- Error rates by endpoint

### Tools

- Vercel Analytics (frontend)
- Neon Dashboard (database)
- Upstash Console (Redis)
- Prisma Studio (data browser)

## Security

### Features

- JWT session tokens (HTTP-only cookies) with jose signature verification
- IDOR protection on worksheet and profile resolvers
- Input validation with Zod on all mutations
- Rate limiting per user (sliding window + token bucket)
- CORS configuration
- SQL injection prevention (Prisma parameterized queries)
- Atomic view counters (forum posts, worksheets)
- Internal error messages never leaked to clients

### Best Practices

- Never expose internal errors to clients (error details stripped in workers and API)
- Use parameterized queries only
- Validate all user inputs
- Implement RBAC for sensitive operations (admin-only cross-user access)
- Log all authentication events
- Verify JWT signatures on WebSocket connections (jose jwtVerify)

## Deployment

### Vercel

```bash
# Deploy to production
vercel --prod

# Run database migrations
vercel env pull .env.production
pnpm --filter @nextcalc/database db:migrate:deploy
```

### Environment Variables

Set in Vercel dashboard:
- All variables from `.env.example`
- `NODE_ENV=production`
- Update URLs to production domains

## Troubleshooting

### Common Issues

1. **Connection pool exhausted**
   - Solution: Use Neon serverless driver with pooling
   - Check: Neon dashboard for connection count

2. **Slow queries**
   - Solution: Add indexes, use DataLoaders
   - Debug: Enable Prisma query logging

3. **Rate limit errors**
   - Solution: Implement backoff/retry logic
   - Check: Upstash console for limits

4. **Authentication errors**
   - Solution: Verify OAuth credentials
   - Check: NextAuth debug logs

## Support

- Architecture: [ARCHITECTURE.md](../../ARCHITECTURE.md)
- Development: [DEVELOPMENT.md](../../DEVELOPMENT.md)
- Issues: [GitHub Issues](https://github.com/ABCrimson/NextCalc/issues)

## License

MIT
