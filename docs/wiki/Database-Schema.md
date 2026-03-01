# Database Schema

Prisma 7 with Neon PostgreSQL serverless adapter. Schema: `packages/database/prisma/schema.prisma`.

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
