# Problem Submission & Grading + Practice Mode Metrics Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the corresponding plan task-by-task.

**Goal:** Wire the fully-built Problem Submission and Practice Mode UIs to a real persistence layer using Server Actions and a new PracticeSession Prisma model.

**Architecture:** Server Actions (not GraphQL) for all write mutations. New PracticeSession model for session grouping. useActionState (React 19) for pending/error UI. Auth-optional graceful degradation.

**Tech Stack:** Server Actions, useActionState, Prisma 7 (@nextcalc/database), Zod 4, NextAuth v5 auth()

---

## Feature 1: Problem Submission & Grading Backend

### Server Actions

**New file: `apps/web/app/actions/problems.ts`**

Three server actions replacing the existing API routes:

1. **`submitAnswer(prevState, formData)`**
   - Validates via `AnswerSubmissionSchema` (Zod)
   - Calls `auth()` — returns `{ error: 'unauthenticated' }` if no session (doesn't block, just doesn't persist)
   - Loads problem with test cases from Prisma
   - Validates answer against test cases (string comparison, case-insensitive trim)
   - Creates `Attempt` record with `correct`, `timeSpent`, `hintsUsed`, `pointsEarned`
   - Points formula: `problem.points - (hintsUsed * hintCost)` (minimum 0)
   - On first correct attempt: updates `UserProgress.problemsSolved`, `totalPoints`, `experience`
   - Updates `TopicProgress.masteryLevel` (+0.05 per solve, capped at 1.0)
   - Calls `revalidatePath('/problems/[id]')` for instant UI refresh
   - Returns `{ correct, pointsEarned, feedback, attemptId }`

2. **`requestHint(prevState, formData)`**
   - Validates `problemId` and `hintOrder`
   - Calls `auth()` — unauthenticated users get hints without tracking
   - Loads hint by `(problemId, order)`
   - For authenticated users: records hint usage on the latest in-progress attempt
   - Returns `{ content, pointCost, order }`

3. **`toggleFavorite(prevState, formData)`**
   - Requires auth (favorites are user-specific)
   - Toggles `Favorite` record (upsert/delete pattern)
   - Calls `revalidatePath('/problems')` for list refresh
   - Returns `{ isFavorite }`

### Deleted API Routes

- `apps/web/app/api/problems/[id]/submit/route.ts` — replaced by `submitAnswer` action
- `apps/web/app/api/problems/[id]/hints/route.ts` — replaced by `requestHint` action
- `apps/web/app/api/progress/attempt/route.ts` — replaced by `savePracticeAttempt` action

### Kept API Routes (read-only)

- `apps/web/app/api/problems/route.ts` (GET listing)
- `apps/web/app/api/problems/[id]/route.ts` (GET detail)
- `apps/web/app/api/progress/route.ts` (GET progress)
- `apps/web/app/api/achievements/route.ts` (GET achievements)

### UI Wiring

**Modify: `apps/web/app/problems/[id]/page.tsx`**
- Import `submitAnswer`, `requestHint` from `@/app/actions/problems`
- Wire `onSubmitAnswer` callback to call `submitAnswer`
- Wire `onRequestHint` callback to call `requestHint`
- Use `useActionState` for pending states and error handling
- Display correct/incorrect feedback with points earned

**Modify: `apps/web/app/problems/page.tsx`**
- Import `toggleFavorite` from `@/app/actions/problems`
- Wire `onToggleFavorite` callback
- Use `useActionState` for optimistic toggle

### Validation Schemas

**Extend: `apps/web/lib/validations/learning.ts`**

```typescript
AnswerSubmissionSchema {
  problemId: string
  answer: string (min 1)
  timeSpent: number (seconds, min 0)
  hintsUsed: number (default 0)
}

HintRequestSchema {
  problemId: string
  hintOrder: number (min 1)
}

FavoriteToggleSchema {
  problemId: string
}
```

---

## Feature 2: Practice Mode — Metrics Persistence

### Prisma Schema

**New model: `PracticeSession`**

```prisma
model PracticeSession {
  id             String    @id @default(cuid())
  userProgressId String
  topic          String?
  difficulty     String?
  questionCount  Int
  timeLimit      Int?
  adaptive       Boolean   @default(false)
  score          Float?
  accuracy       Float?
  bestStreak     Int       @default(0)
  totalTime      Int       @default(0)
  pointsEarned   Int       @default(0)
  completedAt    DateTime?
  createdAt      DateTime  @default(now())

  userProgress   UserProgress @relation(fields: [userProgressId], references: [id], onDelete: Cascade)
  attempts       Attempt[]

  @@index([userProgressId])
  @@index([createdAt(sort: Desc)])
}
```

**Modify `Attempt`:** Add optional `practiceSessionId` + relation + index.

**Modify `UserProgress`:** Add `practiceSessions PracticeSession[]` relation.

### Server Actions

**New file: `apps/web/app/actions/practice.ts`**

1. **`savePracticeAttempt(prevState, formData)`**
   - Called after each answer (1.5s debounced from client)
   - On first call: creates `PracticeSession` record (lazy creation), returns `sessionId`
   - Creates `Attempt` record linked to the session
   - Updates `UserProgress` and `TopicProgress` incrementally
   - Returns `{ sessionId, attemptId, correct, pointsEarned }`

2. **`savePracticeSession(prevState, formData)`**
   - Called on session completion
   - Updates `PracticeSession` with final metrics: score, accuracy, bestStreak, totalTime, pointsEarned, completedAt
   - Updates `UserProgress` totals (experience, streak)
   - Returns full session summary for results screen

### UI Wiring

**Modify: `apps/web/app/practice/page.tsx`**
- Import `savePracticeAttempt`, `savePracticeSession` from `@/app/actions/practice`
- Wire `onAnswer` callback → debounced `savePracticeAttempt` (1.5s)
- Wire `handleComplete` callback → `savePracticeSession` with final metrics
- Replace hardcoded stats (95% accuracy, 23 sessions, 7-day streak, +15%) with real data from a Server Component query
- Results screen reads from the returned session data (no extra DB round-trip)

### Validation Schemas

**Extend: `apps/web/lib/validations/learning.ts`**

```typescript
PracticeAttemptSchema {
  sessionId: string? (null on first attempt)
  problemId: string
  answer: string
  correct: boolean
  timeSpent: number (seconds)
  topic: string?
  difficulty: string?
  questionCount: number
  timeLimit: number?
  adaptive: boolean
}

PracticeSessionCompleteSchema {
  sessionId: string
  score: number (0-1)
  accuracy: number (0-1)
  bestStreak: number
  totalTime: number (seconds)
  pointsEarned: number
}
```

---

## Unchanged

- `InteractiveSolver` component internals (just callback wiring)
- `PracticeMode` component internals (just callback wiring)
- GraphQL API (queries, subscriptions, external client access)
- `ProblemManager` CMS class
- Math engine problem database (`@nextcalc/math-engine/problems`)
- All existing Prisma models (only additions, no field modifications)
- Read-only API routes (problems listing, progress, achievements)
