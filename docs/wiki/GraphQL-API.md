# GraphQL API Reference

The API is served at `/api/graphql` via Apollo Server 5.4 integrated into the Next.js app.

**Playground**: `http://localhost:3005/api/graphql` (dev) or `https://nextcalc.io/api/graphql`

---

## Authentication

- OAuth providers: Google, GitHub (via NextAuth v5)
- Session: JWT (HTTP-only cookie, 30-day expiry)
- WebSocket JWT verification via `jose.jwtVerify()` with NEXTAUTH_SECRET
- Queries marked with `@auth` require a valid session
- IDOR protection: worksheet queries enforce ownership (admin-only cross-user access)

---

## Queries (33)

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

## Mutations (24)

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
  worksheets: [Worksheet!]!
  folders: [Folder!]!
  forumPosts: [ForumPost!]!
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
  upvoteCount: Int!
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

N+1 prevention via DataLoader instances:
- `userById`
- `folderById`
- `worksheetSharesByWorksheetId`
- `childFoldersByParentId`
- `upvoteCountByTargetId`

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

9 DataLoader instances batch and deduplicate database queries within each request:

| DataLoader | Keys | Resolves |
|:-----------|:-----|:---------|
| `userById` | User ID | `User` on Worksheet, ForumPost, Comment |
| `folderById` | Folder ID | `Folder` on Worksheet |
| `worksheetSharesByWorksheetId` | Worksheet ID | `[WorksheetShare]` on Worksheet |
| `childFoldersByParentId` | Parent Folder ID | `[Folder]` on Folder |
| `upvoteCountByTargetId` | Target ID | `Int` on ForumPost, Comment |
| `commentsByPostId` | Post ID | `[Comment]` on ForumPost |
| `worksheetsByUserId` | User ID | `[Worksheet]` on User |
| `forumPostsByUserId` | User ID | `[ForumPost]` on User |
| `foldersByUserId` | User ID | `[Folder]` on User |

### Query Complexity Analysis

A recursive selection set analyzer calculates depth-weighted complexity scores for incoming queries. Queries exceeding the configured threshold are rejected before execution:

- **Depth weight**: Each nesting level multiplies the field cost by 2
- **Default limit**: 1000 complexity points per query
- **Introspection**: Exempt from complexity analysis

### JWT Verification (WebSocket)

WebSocket subscriptions authenticate via `jose.jwtVerify()` using the `NEXTAUTH_SECRET` as the symmetric key. Invalid or expired tokens cause the connection to close with a `4401` WebSocket close code.

```typescript
const { payload } = await jwtVerify(
  token,
  new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
);
```

### Error Sanitization

Internal errors (database failures, unexpected exceptions) are caught and replaced with generic `INTERNAL_ERROR` codes before reaching the client. The original error is logged server-side but never exposed in GraphQL responses. Validation errors and business-logic errors retain their specific `ErrorCode` values.
