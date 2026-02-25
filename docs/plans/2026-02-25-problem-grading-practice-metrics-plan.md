# Problem Submission & Grading + Practice Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace API route stubs with Server Actions for problem submission, hints, favorites, and practice session persistence, then wire the existing UI callbacks to these actions.

**Architecture:** Server Actions calling Prisma directly (no HTTP hop). New `PracticeSession` model grouping `Attempt` records. `useActionState` (React 19) for form state in client components. Auth-optional graceful degradation.

**Tech Stack:** Next.js 16 Server Actions, React 19 `useActionState`, Prisma 7 (`@nextcalc/database`), Zod 4, NextAuth v5 `auth()`

---

## Important Context

- **pnpm not in PATH** on this machine. Use: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest <command> 2>&1"`
- **Prisma CLI**: Run from `packages/database/` — `pnpm --filter @nextcalc/database db:push`
- **Zod 4 breaking change**: `.errors` renamed to `.issues` on ZodError
- **TypeScript 6.0 `exactOptionalPropertyTypes`**: Can't pass `undefined` to optional properties. Use spread: `...(val ? { key: val } : {})`
- **React 19**: No forwardRef, no displayName. ref as regular prop. Named imports only.
- **Existing auth pattern**: `import { auth } from '@/auth'` — returns `session?.user?.id`
- **Existing prisma pattern**: `import { prisma } from '@/lib/prisma'`
- **Existing server action example**: `apps/web/app/actions/calculator.ts` — uses `'use server'` directive

---

### Task 1: Add PracticeSession model to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add PracticeSession model after the Attempt model (after line 666)**

Add this block between the `Attempt` model (ends at line 666) and the `Favorite` model (starts at line 668):

```prisma
model PracticeSession {
  id             String    @id @default(cuid())
  userProgressId String
  topic          String?   @db.VarChar(100)
  difficulty     String?   @db.VarChar(50)
  questionCount  Int
  timeLimit      Int?
  adaptive       Boolean   @default(false)

  // Results (filled on completion)
  score          Float?
  accuracy       Float?
  bestStreak     Int       @default(0)
  totalTime      Int       @default(0)
  pointsEarned   Int       @default(0)
  completedAt    DateTime?

  createdAt      DateTime  @default(now())

  userProgress   UserProgress @relation(fields: [userProgressId], references: [id], onDelete: Cascade)
  attempts       Attempt[]

  @@map("practice_sessions")
  @@index([userProgressId])
  @@index([createdAt(sort: Desc)])
}
```

**Step 2: Add `practiceSessionId` to Attempt model**

In the `Attempt` model (lines 641-666), add after line 654 (`pointsEarned`):

```prisma
  // Optional link to practice session
  practiceSessionId String?
```

And add after line 659 (the `problem` relation):

```prisma
  practiceSession PracticeSession? @relation(fields: [practiceSessionId], references: [id], onDelete: SetNull)
```

And add a new index after line 665:

```prisma
  @@index([practiceSessionId])
```

**Step 3: Add relation on UserProgress**

In the `UserProgress` model (lines 590-619), add after line 610 (`achievements`):

```prisma
  practiceSessions PracticeSession[]
```

**Step 4: Regenerate Prisma client**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/database exec prisma generate 2>&1"`

Expected: `✔ Generated Prisma Client`

**Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(schema): add PracticeSession model and link to Attempt"
```

---

### Task 2: Add Zod validation schemas for Server Actions

**Files:**
- Modify: `apps/web/lib/validations/learning.ts`

**Step 1: Add new schemas after the existing `FavoriteCreateSchema` (after line 44)**

Add before the Knowledge Base Schemas section:

```typescript
// ============================================================================
// Server Action Schemas
// ============================================================================

export const AnswerSubmissionSchema = z.object({
  problemId: z.string().min(1),
  answer: z.string().min(1),
  timeSpent: z.coerce.number().int().min(0).default(0),
  hintsUsed: z.coerce.number().int().min(0).default(0),
});

export const HintRequestSchema = z.object({
  problemId: z.string().min(1),
  hintOrder: z.coerce.number().int().min(1),
});

export const FavoriteToggleSchema = z.object({
  problemId: z.string().min(1),
});

export const PracticeAttemptSchema = z.object({
  sessionId: z.string().optional(),
  problemId: z.string().min(1),
  answer: z.string(),
  correct: z.boolean(),
  timeSpent: z.coerce.number().int().min(0).default(0),
  // Session config (used to create session on first attempt)
  topic: z.string().optional(),
  difficulty: z.string().optional(),
  questionCount: z.coerce.number().int().min(1).default(5),
  timeLimit: z.coerce.number().int().min(0).optional(),
  adaptive: z.boolean().default(false),
});

export const PracticeSessionCompleteSchema = z.object({
  sessionId: z.string().min(1),
  score: z.coerce.number().min(0).max(1),
  accuracy: z.coerce.number().min(0).max(1),
  bestStreak: z.coerce.number().int().min(0),
  totalTime: z.coerce.number().int().min(0),
  pointsEarned: z.coerce.number().int().min(0),
});
```

**Step 2: Add type exports at the bottom of the Type Exports section**

```typescript
export type AnswerSubmission = z.infer<typeof AnswerSubmissionSchema>;
export type HintRequest = z.infer<typeof HintRequestSchema>;
export type FavoriteToggle = z.infer<typeof FavoriteToggleSchema>;
export type PracticeAttempt = z.infer<typeof PracticeAttemptSchema>;
export type PracticeSessionComplete = z.infer<typeof PracticeSessionCompleteSchema>;
```

**Step 3: Commit**

```bash
git add apps/web/lib/validations/learning.ts
git commit -m "feat(validation): add Zod schemas for problem and practice server actions"
```

---

### Task 3: Create problem server actions (submitAnswer, requestHint, toggleFavorite)

**Files:**
- Create: `apps/web/app/actions/problems.ts`

**Step 1: Create the server action file**

The logic is ported from the existing API routes at:
- `apps/web/app/api/problems/[id]/submit/route.ts`
- `apps/web/app/api/problems/[id]/hints/route.ts`

Create `apps/web/app/actions/problems.ts`:

```typescript
'use server';

/**
 * Server Actions for Problem Submission, Hints, and Favorites
 *
 * Replaces the REST API routes with direct Prisma calls.
 * Each action validates input via Zod, checks auth, and returns a typed result.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  AnswerSubmissionSchema,
  HintRequestSchema,
  FavoriteToggleSchema,
} from '@/lib/validations/learning';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helper: get-or-create UserProgress
// ---------------------------------------------------------------------------

async function getOrCreateUserProgress(userId: string) {
  let progress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId },
    });
  }

  return progress;
}

// ---------------------------------------------------------------------------
// submitAnswer
// ---------------------------------------------------------------------------

export interface SubmitAnswerResult {
  correct: boolean;
  pointsEarned: number;
  feedback: string;
  attemptId: string;
}

export async function submitAnswer(
  _prevState: ActionResult<SubmitAnswerResult>,
  formData: FormData,
): Promise<ActionResult<SubmitAnswerResult>> {
  try {
    // Parse and validate
    const raw = Object.fromEntries(formData.entries());
    const data = AnswerSubmissionSchema.parse(raw);

    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save your progress' };
    }

    // Load problem with test cases and topics
    const problem = await prisma.problem.findUnique({
      where: { id: data.problemId },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { order: 'asc' },
        },
        topics: true,
      },
    });

    if (!problem) {
      return { success: false, error: 'Problem not found' };
    }

    // Validate answer against test cases
    const isCorrect =
      problem.testCases.length > 0
        ? problem.testCases.some(
            (tc) =>
              tc.expected.trim().toLowerCase() ===
              data.answer.trim().toLowerCase(),
          )
        : true;

    // Get or create user progress
    const userProgress = await getOrCreateUserProgress(session.user.id);

    // Calculate points (deduct hint penalty)
    const hintPenalty = data.hintsUsed * 5;
    const pointsEarned = isCorrect
      ? Math.max(0, problem.points - hintPenalty)
      : 0;

    const feedback = isCorrect
      ? 'Correct! Well done.'
      : 'Incorrect. Try again or use a hint.';

    // Create attempt record
    const attempt = await prisma.attempt.create({
      data: {
        userProgressId: userProgress.id,
        problemId: data.problemId,
        submission: data.answer,
        correct: isCorrect,
        timeSpent: data.timeSpent,
        hintsUsed: data.hintsUsed,
        pointsEarned,
        feedback,
      },
    });

    // On first correct answer: update progress
    if (isCorrect) {
      const previousSuccess = await prisma.attempt.findFirst({
        where: {
          userProgressId: userProgress.id,
          problemId: data.problemId,
          correct: true,
          id: { not: attempt.id },
        },
      });

      if (!previousSuccess) {
        await prisma.userProgress.update({
          where: { id: userProgress.id },
          data: {
            problemsSolved: { increment: 1 },
            totalPoints: { increment: pointsEarned },
            experience: { increment: pointsEarned },
            lastActive: new Date(),
          },
        });

        for (const pt of problem.topics) {
          await prisma.topicProgress.upsert({
            where: {
              userProgressId_topicId: {
                userProgressId: userProgress.id,
                topicId: pt.topicId,
              },
            },
            update: {
              problemsSolved: { increment: 1 },
              timeSpent: { increment: data.timeSpent },
              lastPracticed: new Date(),
              masteryLevel: { increment: 0.05 },
            },
            create: {
              userProgressId: userProgress.id,
              topicId: pt.topicId,
              problemsSolved: 1,
              timeSpent: data.timeSpent,
              masteryLevel: 0.1,
            },
          });
        }
      }
    }

    // Update problem popularity
    await prisma.problem.update({
      where: { id: data.problemId },
      data: { popularity: { increment: 1 } },
    });

    revalidatePath(`/problems/${data.problemId}`);

    return {
      success: true,
      data: {
        correct: isCorrect,
        pointsEarned,
        feedback,
        attemptId: attempt.id,
      },
    };
  } catch (error) {
    console.error('submitAnswer error:', error);
    return { success: false, error: 'Failed to submit answer' };
  }
}

// ---------------------------------------------------------------------------
// requestHint
// ---------------------------------------------------------------------------

export interface RequestHintResult {
  content: string;
  pointCost: number;
  order: number;
}

export async function requestHint(
  _prevState: ActionResult<RequestHintResult>,
  formData: FormData,
): Promise<ActionResult<RequestHintResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = HintRequestSchema.parse(raw);

    // Load the requested hint
    const hint = await prisma.hint.findFirst({
      where: {
        problemId: data.problemId,
        order: data.hintOrder,
      },
    });

    if (!hint) {
      return { success: false, error: 'Hint not found' };
    }

    return {
      success: true,
      data: {
        content: hint.content,
        pointCost: hint.pointCost,
        order: hint.order,
      },
    };
  } catch (error) {
    console.error('requestHint error:', error);
    return { success: false, error: 'Failed to load hint' };
  }
}

// ---------------------------------------------------------------------------
// toggleFavorite
// ---------------------------------------------------------------------------

export interface ToggleFavoriteResult {
  isFavorite: boolean;
}

export async function toggleFavorite(
  _prevState: ActionResult<ToggleFavoriteResult>,
  formData: FormData,
): Promise<ActionResult<ToggleFavoriteResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = FavoriteToggleSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save favorites' };
    }

    const userProgress = await getOrCreateUserProgress(session.user.id);

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userProgressId_problemId: {
          userProgressId: userProgress.id,
          problemId: data.problemId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidatePath('/problems');
      return { success: true, data: { isFavorite: false } };
    }

    await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        problemId: data.problemId,
      },
    });

    revalidatePath('/problems');
    return { success: true, data: { isFavorite: true } };
  } catch (error) {
    console.error('toggleFavorite error:', error);
    return { success: false, error: 'Failed to toggle favorite' };
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web exec tsc --noEmit --pretty 2>&1 | Select-Object -First 30"`

Expected: No new errors from our file (pre-existing errors are OK).

**Step 3: Commit**

```bash
git add apps/web/app/actions/problems.ts
git commit -m "feat: add server actions for answer submission, hints, and favorites"
```

---

### Task 4: Create practice session server actions

**Files:**
- Create: `apps/web/app/actions/practice.ts`

**Step 1: Create the practice server action file**

Create `apps/web/app/actions/practice.ts`:

```typescript
'use server';

/**
 * Server Actions for Practice Mode Persistence
 *
 * - savePracticeAttempt: saves each answer during a session (lazy-creates the session)
 * - completePracticeSession: finalises session with aggregate metrics
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  PracticeAttemptSchema,
  PracticeSessionCompleteSchema,
} from '@/lib/validations/learning';
import type { ActionResult } from './problems';

// ---------------------------------------------------------------------------
// savePracticeAttempt
// ---------------------------------------------------------------------------

export interface PracticeAttemptResult {
  sessionId: string;
  attemptId: string;
  correct: boolean;
  pointsEarned: number;
}

export async function savePracticeAttempt(
  _prevState: ActionResult<PracticeAttemptResult>,
  formData: FormData,
): Promise<ActionResult<PracticeAttemptResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    // Boolean and optional fields need manual coercion from FormData strings
    const parsed = PracticeAttemptSchema.parse({
      ...raw,
      correct: raw.correct === 'true',
      ...(raw.adaptive !== undefined ? { adaptive: raw.adaptive === 'true' } : {}),
    });

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save practice progress' };
    }

    // Get or create user progress
    let userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id },
    });

    if (!userProgress) {
      userProgress = await prisma.userProgress.create({
        data: { userId: session.user.id },
      });
    }

    // Lazy-create PracticeSession on first attempt
    let sessionId = parsed.sessionId;

    if (!sessionId) {
      const practiceSession = await prisma.practiceSession.create({
        data: {
          userProgressId: userProgress.id,
          ...(parsed.topic ? { topic: parsed.topic } : {}),
          ...(parsed.difficulty ? { difficulty: parsed.difficulty } : {}),
          questionCount: parsed.questionCount,
          ...(parsed.timeLimit !== undefined ? { timeLimit: parsed.timeLimit } : {}),
          adaptive: parsed.adaptive,
        },
      });
      sessionId = practiceSession.id;
    }

    // Calculate points
    const problem = await prisma.problem.findUnique({
      where: { id: parsed.problemId },
      select: { points: true, topics: true },
    });

    const pointsEarned = parsed.correct ? (problem?.points ?? 10) : 0;

    // Create attempt linked to session
    const attempt = await prisma.attempt.create({
      data: {
        userProgressId: userProgress.id,
        problemId: parsed.problemId,
        practiceSessionId: sessionId,
        submission: parsed.answer,
        correct: parsed.correct,
        timeSpent: parsed.timeSpent,
        hintsUsed: 0,
        pointsEarned,
      },
    });

    // Update topic progress incrementally
    if (parsed.correct && problem?.topics) {
      for (const pt of problem.topics) {
        await prisma.topicProgress.upsert({
          where: {
            userProgressId_topicId: {
              userProgressId: userProgress.id,
              topicId: pt.topicId,
            },
          },
          update: {
            problemsSolved: { increment: 1 },
            timeSpent: { increment: parsed.timeSpent },
            lastPracticed: new Date(),
          },
          create: {
            userProgressId: userProgress.id,
            topicId: pt.topicId,
            problemsSolved: 1,
            timeSpent: parsed.timeSpent,
          },
        });
      }
    }

    return {
      success: true,
      data: {
        sessionId,
        attemptId: attempt.id,
        correct: parsed.correct,
        pointsEarned,
      },
    };
  } catch (error) {
    console.error('savePracticeAttempt error:', error);
    return { success: false, error: 'Failed to save practice attempt' };
  }
}

// ---------------------------------------------------------------------------
// completePracticeSession
// ---------------------------------------------------------------------------

export interface PracticeSessionResult {
  sessionId: string;
  score: number;
  accuracy: number;
  bestStreak: number;
  totalTime: number;
  pointsEarned: number;
}

export async function completePracticeSession(
  _prevState: ActionResult<PracticeSessionResult>,
  formData: FormData,
): Promise<ActionResult<PracticeSessionResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = PracticeSessionCompleteSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save practice results' };
    }

    // Verify session belongs to user
    const practiceSession = await prisma.practiceSession.findUnique({
      where: { id: data.sessionId },
      include: { userProgress: true },
    });

    if (!practiceSession) {
      return { success: false, error: 'Practice session not found' };
    }

    if (practiceSession.userProgress.userId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Finalise session
    await prisma.practiceSession.update({
      where: { id: data.sessionId },
      data: {
        score: data.score,
        accuracy: data.accuracy,
        bestStreak: data.bestStreak,
        totalTime: data.totalTime,
        pointsEarned: data.pointsEarned,
        completedAt: new Date(),
      },
    });

    // Update user progress totals
    await prisma.userProgress.update({
      where: { id: practiceSession.userProgressId },
      data: {
        totalPoints: { increment: data.pointsEarned },
        experience: { increment: data.pointsEarned },
        lastActive: new Date(),
      },
    });

    return {
      success: true,
      data: {
        sessionId: data.sessionId,
        score: data.score,
        accuracy: data.accuracy,
        bestStreak: data.bestStreak,
        totalTime: data.totalTime,
        pointsEarned: data.pointsEarned,
      },
    };
  } catch (error) {
    console.error('completePracticeSession error:', error);
    return { success: false, error: 'Failed to save practice session' };
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/app/actions/practice.ts
git commit -m "feat: add server actions for practice session persistence"
```

---

### Task 5: Wire problem page to submitAnswer and requestHint actions

**Files:**
- Modify: `apps/web/app/problems/[id]/page.tsx`

**Step 1: Convert to a hybrid page**

The current file is a Server Component. Since `useActionState` is a client hook, extract the solver into a client wrapper. Replace the entire file content:

The page stays as a Server Component that fetches data, but renders a new client component `ProblemSolverClient` that wraps `InteractiveSolver` with action state.

Create a new client component inline in the same directory. Add a new file `apps/web/app/problems/[id]/problem-solver-client.tsx`:

```typescript
'use client';

import { useActionState, useState, useCallback, useRef } from 'react';
import { InteractiveSolver } from '@/components/math/interactive-solver';
import { submitAnswer, requestHint } from '@/app/actions/problems';
import type { ActionResult, SubmitAnswerResult, RequestHintResult } from '@/app/actions/problems';
import type { Problem } from '@nextcalc/math-engine/problems';

interface ProblemSolverClientProps {
  problem: Problem;
  relatedProblemIds: ReadonlyArray<string>;
}

const initialAnswerState: ActionResult<SubmitAnswerResult> = { success: false };
const initialHintState: ActionResult<RequestHintResult> = { success: false };

export function ProblemSolverClient({ problem, relatedProblemIds }: ProblemSolverClientProps) {
  const [answerState, submitAnswerAction, answerPending] = useActionState(submitAnswer, initialAnswerState);
  const [hintState, requestHintAction, hintPending] = useActionState(requestHint, initialHintState);

  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  // Start timer on mount
  if (!timerRef.current) {
    timerRef.current = setInterval(() => {
      setTimeSpent((t) => t + 1);
    }, 1000);
  }

  const handleSubmitAnswer = useCallback(
    (answer: string) => {
      const fd = new FormData();
      fd.set('problemId', problem.id);
      fd.set('answer', answer);
      fd.set('timeSpent', timeSpent.toString());
      fd.set('hintsUsed', revealedHints.length.toString());
      submitAnswerAction(fd);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [problem.id, timeSpent, revealedHints.length, submitAnswerAction],
  );

  const handleRequestHint = useCallback(
    (hintIndex: number) => {
      const fd = new FormData();
      fd.set('problemId', problem.id);
      fd.set('hintOrder', (hintIndex + 1).toString());
      requestHintAction(fd);
      setRevealedHints((prev) => [...prev, hintIndex]);
    },
    [problem.id, requestHintAction],
  );

  const answerChecked = answerState.success && answerState.data !== undefined;
  const isCorrect = answerState.data?.correct ?? false;
  const currentScore = answerState.data?.pointsEarned ?? 0;

  return (
    <InteractiveSolver
      problem={problem}
      userAnswer=""
      onSubmitAnswer={handleSubmitAnswer}
      onRequestHint={handleRequestHint}
      revealedHints={revealedHints}
      answerChecked={answerChecked}
      isCorrect={isCorrect}
      currentScore={currentScore}
      timeSpent={timeSpent}
      {...(relatedProblemIds.length > 0 ? {
        onNextProblem: () => {
          window.location.href = `/problems/${relatedProblemIds[0]}`;
        },
      } : {})}
    />
  );
}
```

**Step 2: Update the server page to use the client wrapper**

Replace the `InteractiveSolver` usage in `apps/web/app/problems/[id]/page.tsx` (lines 67-86) with:

```typescript
import { ProblemSolverClient } from './problem-solver-client';
```

And replace the `<InteractiveSolver ... />` block with:

```tsx
      <ProblemSolverClient
        problem={problem}
        relatedProblemIds={relatedProblems.map((p) => p.id)}
      />
```

Remove the old `InteractiveSolver` import from line 3 since it's now imported in the client component.

**Step 3: Commit**

```bash
git add apps/web/app/problems/[id]/problem-solver-client.tsx apps/web/app/problems/[id]/page.tsx
git commit -m "feat: wire problem page to submitAnswer and requestHint server actions"
```

---

### Task 6: Wire problems listing page to toggleFavorite action

**Files:**
- Modify: `apps/web/app/problems/page.tsx`

**Step 1: Replace the TODO stub**

Find the `onToggleFavorite` callback (around line 333-335):

```typescript
              onToggleFavorite={(_problemId) => {
                // TODO: integrate bookmark toggle with auth/database
              }}
```

Replace with a callback that calls the server action:

```typescript
              onToggleFavorite={(problemId) => {
                const fd = new FormData();
                fd.set('problemId', problemId);
                toggleFavoriteAction(fd);
              }}
```

**Step 2: Add the action state hook and import**

Near the top of the component function, add:

```typescript
import { toggleFavorite } from '@/app/actions/problems';
import type { ActionResult, ToggleFavoriteResult } from '@/app/actions/problems';
```

And inside the component, add the `useActionState` hook:

```typescript
const [_favoriteState, toggleFavoriteAction] = useActionState<ActionResult<ToggleFavoriteResult>, FormData>(
  toggleFavorite,
  { success: false },
);
```

Add `useActionState` to the react import.

**Step 3: Commit**

```bash
git add apps/web/app/problems/page.tsx
git commit -m "feat: wire problem browser favorites to toggleFavorite server action"
```

---

### Task 7: Wire practice page to practice session actions

**Files:**
- Modify: `apps/web/app/practice/page.tsx`

**Step 1: Add imports**

Add at the top of the file:

```typescript
import { savePracticeAttempt, completePracticeSession } from '@/app/actions/practice';
import type { ActionResult, PracticeAttemptResult, PracticeSessionResult } from '@/app/actions/practice';
```

Add `useActionState, useRef` to the react import (keep existing `useState, useCallback`).

**Step 2: Add action state hooks inside the component**

After the existing state declarations, add:

```typescript
  const [_attemptState, saveAttemptAction] = useActionState<ActionResult<PracticeAttemptResult>, FormData>(
    savePracticeAttempt,
    { success: false },
  );
  const [sessionResult, completeSessionAction] = useActionState<ActionResult<PracticeSessionResult>, FormData>(
    completePracticeSession,
    { success: false },
  );
  const sessionIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Step 3: Add an onAnswer callback for mid-session autosave**

Add after the action state hooks:

```typescript
  const handleAnswer = useCallback(
    (problemId: string, isCorrect: boolean, timeSpentOnProblem: number) => {
      // Debounce 1.5s to avoid rapid-fire saves
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const fd = new FormData();
        if (sessionIdRef.current) fd.set('sessionId', sessionIdRef.current);
        fd.set('problemId', problemId);
        fd.set('answer', isCorrect ? 'correct' : 'incorrect');
        fd.set('correct', isCorrect.toString());
        fd.set('timeSpent', timeSpentOnProblem.toString());
        if (config.topic !== 'all') fd.set('topic', config.topic);
        if (config.difficulty !== 'all') fd.set('difficulty', config.difficulty.toString());
        fd.set('questionCount', config.questionCount.toString());
        if (config.timeLimit > 0) fd.set('timeLimit', config.timeLimit.toString());
        fd.set('adaptive', config.adaptiveDifficulty.toString());
        saveAttemptAction(fd);
      }, 1500);
    },
    [config, saveAttemptAction],
  );
```

**Step 4: Replace the handleComplete TODO**

Replace the `handleComplete` callback (lines 327-333):

```typescript
  const handleComplete = useCallback(
    (_metrics: PracticeMetrics) => {
      // TODO: save metrics to database and show results
      // router.push('/practice/results');
    },
    []
  );
```

With:

```typescript
  const handleComplete = useCallback(
    (metrics: PracticeMetrics) => {
      if (!sessionIdRef.current) return;
      const fd = new FormData();
      fd.set('sessionId', sessionIdRef.current);
      fd.set('score', (metrics.score / 100).toString());
      fd.set('accuracy', (metrics.accuracy / 100).toString());
      fd.set('bestStreak', metrics.bestStreak.toString());
      fd.set('totalTime', metrics.timePerProblem.reduce((a, b) => a + b, 0).toString());
      fd.set('pointsEarned', metrics.score.toString());
      completeSessionAction(fd);
    },
    [completeSessionAction],
  );
```

**Step 5: Track sessionId from attempt responses**

After the `handleAnswer` callback, add an effect to capture the sessionId:

```typescript
  // Capture sessionId from first attempt response
  useEffect(() => {
    if (_attemptState.success && _attemptState.data?.sessionId) {
      sessionIdRef.current = _attemptState.data.sessionId;
    }
  }, [_attemptState]);
```

Add `useEffect` to the react import.

**Step 6: Pass onAnswer to PracticeMode component**

Find where `<PracticeMode` is rendered (the non-configuring branch) and ensure the `onAnswer` prop is wired. Look for the PracticeMode usage and add `onAnswer={handleAnswer}` if it accepts that callback. If PracticeMode's `onComplete` is already passed, ensure `handleComplete` is used.

The PracticeMode component from `@/components/math/practice-mode` takes `onComplete` which is already being passed. For per-answer saves, check if the component exposes an answer callback — if not, the `handleComplete` at session end is sufficient. The debounced `handleAnswer` can be connected if the component's internal API supports it.

**Step 7: Commit**

```bash
git add apps/web/app/practice/page.tsx
git commit -m "feat: wire practice mode to session persistence server actions"
```

---

### Task 8: Delete replaced API routes

**Files:**
- Delete: `apps/web/app/api/problems/[id]/submit/route.ts`
- Delete: `apps/web/app/api/problems/[id]/hints/route.ts`
- Delete: `apps/web/app/api/progress/attempt/route.ts`

**Step 1: Remove the files**

```bash
rm apps/web/app/api/problems/\[id\]/submit/route.ts
rm apps/web/app/api/problems/\[id\]/hints/route.ts
rm apps/web/app/api/progress/attempt/route.ts
```

**Step 2: Remove empty directories if needed**

```bash
rmdir apps/web/app/api/problems/\[id\]/submit 2>/dev/null || true
rmdir apps/web/app/api/problems/\[id\]/hints 2>/dev/null || true
rmdir apps/web/app/api/progress/attempt 2>/dev/null || true
```

**Step 3: Verify no imports reference the deleted routes**

Search the codebase for any fetch calls to these endpoints:

Run: `grep -r "api/problems.*submit\|api/problems.*hints\|api/progress/attempt" apps/web/`

Expected: No matches (these routes were only called from their own files, the UI used stubs).

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete API routes replaced by server actions"
```

---

### Task 9: Build verification

**Step 1: Regenerate Prisma client (in case schema changes haven't propagated)**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/database exec prisma generate 2>&1"`

**Step 2: Build the web app**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"`

Expected: Build succeeds with all pages compiled. May see warnings about dynamic routes — that's expected for Server Actions.

**Step 3: Verify key routes exist**

Check the build output for:
- `/problems` page
- `/problems/[id]` page
- `/practice` page
- `/api/problems` (kept)
- `/api/progress` (kept)

**Step 4: If build fails, fix any TypeScript errors and re-build**

Common issues:
- Missing imports — add them
- `exactOptionalPropertyTypes` — use conditional spread `...(val ? { key: val } : {})`
- Zod `.issues` not `.errors`

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from server action integration"
```
