# Database Schema

Prisma 7.5.0-dev.33 with Neon PostgreSQL serverless adapter. Schema: `packages/database/prisma/schema.prisma`.

---

## Core Models

### Authentication

| Model | Key Fields | Notes |
|:------|:-----------|:------|
| **User** | id, email (unique), name, image, bio, role, tokenVersion | Relations to all content models |
| **Account** | userId, provider, providerAccountId, tokens | NextAuth OAuth accounts |
| **Session** | sessionToken (unique), userId, expires | NextAuth sessions |
| **VerificationToken** | identifier, token, expires | Email verification |

### Content

| Model | Key Fields | Notes |
|:------|:-----------|:------|
| **Worksheet** | title, description, content (JSON), visibility, views, version | Soft-deletable, folder-organized |
| **Folder** | name, description, parentId | Nested hierarchy, unique per user+name+parent |
| **WorksheetShare** | worksheetId, sharedWith, permission | Unique per worksheet+user |
| **CalculationHistory** | expression, result, mode, latex | User calculation history |
| **SharedCalculation** | shortCode (unique, 8 chars), latex, expression, title, result, expiresAt | Anonymous sharing supported |

### Forum

| Model | Key Fields | Notes |
|:------|:-----------|:------|
| **ForumPost** | title, content, tags[], views, isPinned, isClosed | Soft-deletable |
| **Comment** | content, postId, parentId | Self-referential for replies, soft-deletable |
| **Upvote** | userId, targetId, targetType (POST/COMMENT) | Unique per user+target |

### Audit

| Model | Key Fields | Notes |
|:------|:-----------|:------|
| **AuditLog** | userId, action, entity, entityId, metadata (JSON), ipAddress | Activity tracking |

---

## Learning Platform Models

### Problems

| Model | Key Fields |
|:------|:-----------|
| **Problem** | title, slug (unique), difficulty, content, solution, points, successRate |
| **Hint** | problemId, content, order, pointCost |
| **TestCase** | problemId, input, expected, isHidden |
| **Example** | problemId, topicId, title, code, explanation |
| **Topic** | name, slug (unique), category, parentId (hierarchy) |
| **ProblemTopic** | problemId, topicId (junction) |
| **Theorem** | name, statement, proof, topicId |
| **Resource** | title, url, type (VIDEO/ARTICLE/BOOK/PAPER), topicId |

### Algorithms

| Model | Key Fields |
|:------|:-----------|
| **Algorithm** | name, slug, timeComplexity, spaceComplexity, category |
| **Implementation** | algorithmId, language, code, explanation |

### User Progress

| Model | Key Fields |
|:------|:-----------|
| **UserProgress** | userId (unique), problemsSolved, totalPoints, streak, level, experience |
| **TopicProgress** | topicId, masteryLevel (0.0-1.0), timeSpent |
| **Attempt** | problemId, correct, timeSpent, hintsUsed, pointsEarned |
| **PracticeSession** | topic, difficulty, score, accuracy, totalTime |
| **Achievement** | name, type, icon, requirement (JSON), points |
| **UserAchievement** | userProgressId, achievementId, earnedAt |
| **Favorite** | resourceType (PROBLEM/DEFINITION), problemId |

---

## Enums

| Enum | Values |
|:-----|:-------|
| `UserRole` | USER, MODERATOR, ADMIN |
| `WorksheetVisibility` | PRIVATE, UNLISTED, PUBLIC |
| `SharePermission` | VIEW, EDIT |
| `CellType` | CALCULATION, TEXT, HEADING, IMAGE, PLOT |
| `UpvoteTargetType` | POST, COMMENT |
| `Difficulty` | BEGINNER, INTERMEDIATE, ADVANCED, MASTER |
| `Category` | CALCULUS, ALGEBRA, TOPOLOGY, ANALYSIS, GEOMETRY, NUMBER_THEORY, ALGORITHMS, GAME_THEORY, CHAOS_THEORY, CRYPTOGRAPHY, QUANTUM, OPTIMIZATION, PROBABILITY, STATISTICS |
| `AlgorithmCategory` | SORTING, SEARCHING, GRAPH, DYNAMIC_PROGRAMMING, GREEDY, DIVIDE_CONQUER, ML_OPTIMIZATION, CRYPTOGRAPHIC, QUANTUM, NUMERICAL, STRING |
| `AchievementType` | PROBLEM_SOLVING, STREAK, MASTERY, SPEED, EXPLORATION, SOCIAL |
| `FavoriteType` | PROBLEM, DEFINITION |

---

## Connection Details

- **Provider**: Neon PostgreSQL (serverless)
- **Adapter**: `@prisma/adapter-neon` with `PrismaNeon({ connectionString })`
- **Config**: `packages/database/prisma.config.ts` (loads env from `apps/web/.env.local`)
- **Generated**: `packages/database/src/generated/prisma/` (gitignored)

Always import from `@nextcalc/database`, never from `@prisma/client`.

---

## Patterns & Conventions

### Soft Delete Pattern

Models that support deletion use a `deletedAt: DateTime?` field instead of hard deletes. Queries filter `WHERE deletedAt IS NULL` by default. This applies to `Worksheet`, `ForumPost`, and `Comment`. To include deleted records (e.g., for admin views), explicitly remove the filter.

### Atomic Counters

Forum post views and upvote counts use Prisma `increment` operations to prevent race conditions:

```typescript
await prisma.forumPost.update({
  where: { id: postId },
  data: { views: { increment: 1 } },
});
```

This avoids the read-then-write pattern that can lose increments under concurrent requests.

### Indexing

Key indexes for query performance:

| Index | Model | Purpose |
|:------|:------|:--------|
| `userId` | Worksheet, Folder, ForumPost, Comment, Upvote, CalculationHistory | Filter content by owner |
| `folderId` | Worksheet | List worksheets in a folder |
| `worksheetId` | WorksheetShare | Find shares for a worksheet |
| `postId` | Comment | List comments on a post |
| `parentId` | Folder, Comment | Traverse nested hierarchies |
| `shortCode` | SharedCalculation | Unique lookup for shared links |

### Partial Indexes (Prisma 7.4+)

Filtered indexes that only include non-deleted records. PostgreSQL automatically prefers these smaller indexes when queries include `WHERE deletedAt IS NULL`, dramatically reducing I/O for the vast majority of reads.

| Index Name | Model | Columns | Filter |
|:-----------|:------|:--------|:-------|
| `worksheets_userId_visibility_active_idx` | Worksheet | userId, visibility | `deletedAt IS NULL` |
| `worksheets_createdAt_active_idx` | Worksheet | createdAt DESC | `deletedAt IS NULL` |
| `forum_posts_createdAt_active_idx` | ForumPost | createdAt DESC | `deletedAt IS NULL` |
| `forum_posts_isPinned_createdAt_active_idx` | ForumPost | isPinned, createdAt DESC | `deletedAt IS NULL` |
| `comments_postId_active_idx` | Comment | postId | `deletedAt IS NULL` |
| `comments_parentId_active_idx` | Comment | parentId | `deletedAt IS NULL` |
| `problems_difficulty_popularity_active_idx` | Problem | difficulty, popularity DESC | `deletedAt IS NULL` |
| `problems_createdAt_active_idx` | Problem | createdAt DESC | `deletedAt IS NULL` |

Defined in schema using Prisma 7.4's type-safe syntax: `@@index([field], map: "name", where: { deletedAt: null })`
