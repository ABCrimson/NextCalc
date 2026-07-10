# GraphQL API Reference

The API is served at `/api/graphql` via Apollo Server 5.5 integrated into the Next.js app.

**Playground**: `http://localhost:3005/api/graphql` (dev) or `https://nextcalc.io/api/graphql`

---

## Authentication

- OAuth providers: Google, GitHub (via NextAuth v5)
- Session: JWT (HTTP-only cookie, 30-day expiry)
- WebSocket JWT verification via `jose.jwtVerify()` with NEXTAUTH_SECRET
- Queries marked with `@auth` require a valid session
- IDOR protection: worksheet queries enforce ownership (admin-only cross-user access)

---

## Queries (22)

### User & Profile

| Query | Args | Returns |
|:------|:-----|:--------|
| `me` | -- | `User` |
| `user` | `id!` | `User` |
| `userProfile` | `userId!` | `UserProfile` |
| `userActivity` | `userId!, days=365` | `[ActivityDay!]` |
| `userAnalytics` | `userId!` | `UserAnalytics` |

### Worksheets

| Query | Args | Returns |
|:------|:-----|:--------|
| `worksheet` | `id!` | `Worksheet` |
| `worksheets` | `limit, offset, visibility, userId, folderId, searchQuery` | `WorksheetConnection` |
| `publicWorksheets` | `limit, offset, searchQuery` | `WorksheetConnection` |
| `worksheetsConnection` | `first, after, last, before, filtering` | `WorksheetCursorConnection` |
| `publicWorksheetsConnection` | `first, after, last, before, searchQuery` | `WorksheetCursorConnection` |

### Folders

| Query | Args | Returns |
|:------|:-----|:--------|
| `folder` | `id!` | `Folder` |
| `folders` | `userId` | `[Folder!]` |
| `foldersConnection` | `first, after, last, before, userId` | `FolderCursorConnection` |

### Forum

| Query | Args | Returns |
|:------|:-----|:--------|
| `forumPost` | `id!` | `ForumPost` |
| `forumPosts` | `limit, offset, tags, searchQuery` | `ForumPostConnection` |
| `forumPostsConnection` | `first, after, last, before, tags, searchQuery` | `ForumPostCursorConnection` |
| `comments` | `postId!, limit, offset` | `[Comment!]` |

### Calculations

| Query | Args | Returns |
|:------|:-----|:--------|
| `calculate` | `input!` | `CalculationResult` |
| `calculationHistory` | `limit=50, offset=0` | `[CalculationHistory!]` |
| `calculationHistoryConnection` | `first, after, last, before` | `CalculationHistoryCursorConnection` |
| `sharedCalculation` | `shortCode!` | `SharedCalculation` |

### System

| Query | Args | Returns |
|:------|:-----|:--------|
| `health` | -- | `HealthStatus` |

---

## Mutations (20)

### Profile
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `updateProfile` | `input!` | `User` |

### Worksheets
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `createWorksheet` | `input!` | `Worksheet` |
| `updateWorksheet` | `id!, input!` | `Worksheet` |
| `deleteWorksheet` | `id!` | `Boolean` |
| `shareWorksheet` | `input!` | `WorksheetShare` |
| `unshareWorksheet` | `worksheetId!, shareId!` | `Boolean` |
| `incrementWorksheetViews` | `id!` | `Boolean` |

### Folders
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `createFolder` | `input!` | `Folder` |
| `updateFolder` | `id!, input!` | `Folder` |
| `deleteFolder` | `id!` | `Boolean` |

### Forum
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `createForumPost` | `input!` | `ForumPost` |
| `updateForumPost` | `id!, input!` | `ForumPost` |
| `deleteForumPost` | `id!` | `Boolean` |

### Comments
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `createComment` | `input!` | `Comment` |
| `updateComment` | `id!, input!` | `Comment` |
| `deleteComment` | `id!` | `Boolean` |

### Interactions
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `toggleUpvote` | `targetId!, targetType!` | `UpvoteResult` |

### Calculations
| Mutation | Args | Returns |
|:---------|:-----|:--------|
| `saveCalculation` | `input!` | `CalculationHistory` |
| `clearCalculationHistory` | -- | `Boolean` |
| `shareCalculation` | `latex!, expression!, title, description, result` | `SharedCalculation` |

---

## Subscriptions (2)

| Subscription | Args | Returns |
|:-------------|:-----|:--------|
| `worksheetUpdated` | `worksheetId!` | `Worksheet` |
| `userWorksheetsChanged` | `userId!` | `[Worksheet!]` |

---

## Key Types

### User
```graphql
type User {
  id: ID!
  email: String!
  name: String
  image: String
  bio: String
  role: UserRole!
  worksheets(limit: Int = 20, offset: Int = 0, visibility: WorksheetVisibility): [Worksheet!]!
  folders: [Folder!]!
  worksheetCount: Int!
  forumPosts(limit: Int = 20, offset: Int = 0): [ForumPost!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Worksheet
```graphql
type Worksheet {
  id: ID!
  title: String!
  description: String
  content: JSON!
  visibility: WorksheetVisibility!
  views: Int!
  user: User!
  folder: Folder
  shares: [WorksheetShare!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### ForumPost
```graphql
type ForumPost {
  id: ID!
  title: String!
  content: String!
  tags: [String!]!
  views: Int!
  isPinned: Boolean!
  isClosed: Boolean!
  user: User!
  comments: [Comment!]!
  commentCount: Int!
  upvoteCount: Int!
  hasUpvoted: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Pagination

Both offset-based and Relay-style cursor pagination are supported:

```graphql
# Cursor-based (recommended)
type CursorPageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

---

## Error Handling

```graphql
enum ErrorCode {
  UNAUTHORIZED
  FORBIDDEN
  NOT_FOUND
  VALIDATION_ERROR
  INTERNAL_ERROR
  RATE_LIMIT_EXCEEDED
}
```

## Rate Limiting

- **Anonymous**: 100 req/min (configurable via `RATE_LIMIT_ANON`)
- **Authenticated**: 1000 req/min (configurable via `RATE_LIMIT_AUTH`)
- Backed by Upstash Redis, fails open if Redis unavailable

## DataLoaders

This is the canonical, up-to-date list of DataLoader instances (defined in `apps/api/src/lib/dataloaders.ts`, created fresh per-request for N+1 prevention). Other docs (root `ARCHITECTURE.md`, `apps/api/README.md`, `docs/wiki/Architecture.md`) link here instead of duplicating this table -- update it first if the loader set changes.

| DataLoader | Batches |
|:-----------|:--------|
| `userById` | `User` lookups by ID |
| `folderById` | `Folder` lookups by ID |
| `worksheetById` | `Worksheet` lookups by ID |
| `worksheetSharesByWorksheetId` | Share records per worksheet |
| `childFoldersByParentId` | Child folders per parent folder |
| `upvoteCountByTargetId` | Upvote counts per target |
| `commentCountByPostId` | Comment counts for post listings |
| `forumPostById` | Forum post lookups by ID |
| `commentById` | Comment lookups by ID |
| `repliesByParentCommentId` | Nested comment replies |
| `worksheetsByFolderId` | Worksheets per folder |
| `foldersByUserId` | Folders per user (capped at 200) |
| `forumPostsByUserId` | Forum posts per user (capped at the default page size, 20) |
| `commentsByPostId` | Top-level comments per post (capped at 20; excludes replies, which come from `repliesByParentCommentId`) |
| `worksheetsByUserId` | Worksheets per user for `User.worksheets` default-args listing. Composite key `userId:scope`, where `scope` is `all` (owner/admin, every non-deleted worksheet) or `public` (any other viewer, `PUBLIC` only) -- the scope must be part of the key so a restricted viewer never misses public worksheets that fall outside the target's most recent rows |
| `hasUpvoted` | Current user's upvote status. Composite key `userId:targetId:targetType` |

---

## Security & Performance (v1.1.0+)

This section documents the security and performance measures introduced in the v1.1.x audit cycle.

### IDOR Protection

All mutations that modify resources validate `userId` ownership before executing. Attempting to update or delete another user's worksheet, folder, forum post, or comment returns a `FORBIDDEN` error. Admin users (`role: ADMIN`) can bypass this check for moderation purposes.

```graphql
# Example: deleteWorksheet checks ctx.user.id === worksheet.userId
mutation {
  deleteWorksheet(id: "ws_abc123")  # FORBIDDEN if not owner
}
```

### Atomic View Counters

The `incrementWorksheetViews` and forum post view mutations use Prisma's `increment` operator to prevent race conditions:

```typescript
await prisma.worksheet.update({
  where: { id },
  data: { views: { increment: 1 } },
});
```

This translates to `UPDATE ... SET views = views + 1` at the SQL level, which is atomic even under concurrent access.

### DataLoader Optimization

DataLoader instances batch and deduplicate database queries within each request. See the canonical table in [DataLoaders](#dataloaders) above for the full, current list and what each batches.

### Query Complexity Analysis

A recursive selection set analyzer calculates depth-weighted complexity scores for incoming queries. Queries exceeding the configured threshold are rejected before execution:

- **Leaf field cost**: A leaf field (no nested selection set) contributes a base cost of 1
- **Depth penalty**: A field with a nested selection set adds a fixed `depthFactor` of 10 plus the cost of its children (additive, not multiplicative)
- **Default limit**: 1000 complexity points per query (`queryComplexityPlugin(1000)`)
- **Introspection**: Not separately exempt; introspection is only enabled in development

### JWT Verification (WebSocket)

WebSocket subscriptions authenticate via `jose.jwtVerify()` using the `NEXTAUTH_SECRET` (or `AUTH_SECRET`) as the symmetric key. Invalid or expired tokens do not reject the connection by default — `onConnect` returns `true` and the connection proceeds with an unauthenticated context (`user: null`). The optional require-auth check in `onConnect` is commented out. Resolver-level subscription filters (e.g. `userWorksheetsChanged`) still enforce that `context.user` is present and matches the subscription target.

```typescript
const { payload } = await jwtVerify(
  token,
  new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
);
```

### Error Sanitization

Internal errors (database failures, unexpected exceptions) are caught by the `formatError` hook (and the `sanitizeError` helper) and, in production, replaced with a generic `INTERNAL_SERVER_ERROR` response before reaching the client. The original error is logged server-side but never exposed in GraphQL responses. Validation errors and business-logic errors retain their specific error codes.

> **Note:** The runtime `extensions.code` values are Apollo's defaults set by the custom error classes — `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_USER_INPUT`, `RATE_LIMIT_EXCEEDED`, `CONFLICT`, `INTERNAL_SERVER_ERROR`, etc. Both `formatError` and `sanitizeError` mask on `INTERNAL_SERVER_ERROR` (or a missing code). The `ErrorCode` enum shown above (`UNAUTHORIZED`, `INTERNAL_ERROR`, `VALIDATION_ERROR`, …) is declared in the schema for documentation but is not the literal set emitted at runtime.
