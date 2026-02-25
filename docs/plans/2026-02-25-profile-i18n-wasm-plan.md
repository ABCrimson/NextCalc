# Profile Dashboard + i18n + WASM Build Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full-analytics user profile dashboard via GraphQL, internationalize the app with 5 languages (en/ru/es/uk/de) using next-intl, and build the WASM math engine via Docker with Web Worker integration.

**Architecture:** Feature 10 adds GraphQL types/resolvers/client queries for profile data, rendered with Apollo in a tabbed dashboard. Feature 11 restructures all routes under `app/[locale]/` with next-intl 4.8.3 proxy middleware, flat-namespace message files, and a language switcher. Feature 12 creates a Docker-based Emscripten build pipeline, wires the WASM loader to prefer native over mock, and adds a Web Worker for off-main-thread computation.

**Tech Stack:** Apollo Client 4.2.0-alpha.0, Apollo Server 5.4, Prisma 7, next-intl 4.8.3, Emscripten SDK 3.1.51 (Docker), Web Workers

---

## Important Context

- **pnpm not in PATH** on this machine. Use: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree-path>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest <command> 2>&1"`
- **Prisma CLI**: Run from worktree root — `pnpm --filter @nextcalc/database exec prisma generate`
- **TypeScript 6.0 `exactOptionalPropertyTypes`**: Use `...(val ? { key: val } : {})` for optional fields
- **React 19**: No forwardRef. ref as regular prop. Named imports only.
- **Radix UI**: Unified `radix-ui` package. `Slot.Root` not `Slot`.
- **GraphQL schema**: `apps/api/src/graphql/schema.ts` (673 lines). Resolver index at `apps/api/src/graphql/resolvers/index.ts`.
- **DataLoaders**: `apps/api/src/lib/dataloaders.ts`. `createDataLoaders(prisma)` returns loader map.
- **Navigation**: `apps/web/components/layout/navigation.tsx` (546 lines). Language switcher goes at line ~464 (right-side controls).
- **proxy.ts**: `apps/web/proxy.ts` (130 lines). Locale middleware chains before auth checks.
- **Root layout**: `apps/web/app/layout.tsx` (128 lines). `lang="en"` on `<html>` at line 104.

---

## Feature 10: User Profile Dashboard (Tasks 1-7)

### Task 1: Add GraphQL types and queries to schema

**Files:**
- Modify: `apps/api/src/graphql/schema.ts`

**Step 1: Add profile types after the existing User type**

After `type User { ... }` (around line 69), add:

```graphql
type UserProfile {
  user: User!
  progress: UserProgress
  recentAchievements: [UserAchievement!]!
  worksheetCount: Int!
  forumPostCount: Int!
  calculationCount: Int!
}

type UserProgress {
  id: ID!
  problemsSolved: Int!
  totalPoints: Int!
  streak: Int!
  longestStreak: Int!
  level: Int!
  experience: Int!
  lastActive: DateTime
}

type UserAchievement {
  id: ID!
  name: String!
  description: String!
  type: String!
  icon: String!
  points: Int!
  badgeUrl: String
  earnedAt: DateTime!
}

type ActivityDay {
  date: String!
  count: Int!
}

type TopicMasteryEntry {
  topic: String!
  mastery: Float!
  problemsSolved: Int!
}

type AccuracyPoint {
  date: String!
  accuracy: Float!
}

type PracticeSessionSummary {
  id: ID!
  topic: String!
  score: Int!
  accuracy: Float!
  totalTime: Int!
  completedAt: DateTime
}

type StreakPoint {
  date: String!
  streak: Int!
}

type UserAnalytics {
  topicMastery: [TopicMasteryEntry!]!
  accuracyTrend: [AccuracyPoint!]!
  practiceHistory: [PracticeSessionSummary!]!
  streakHistory: [StreakPoint!]!
}
```

**Step 2: Add queries**

In the `type Query { ... }` block, add:

```graphql
  userProfile(userId: ID!): UserProfile
  userActivity(userId: ID!, days: Int = 365): [ActivityDay!]!
  userAnalytics(userId: ID!): UserAnalytics
```

**Step 3: Commit**

```bash
git add apps/api/src/graphql/schema.ts
git commit -m "feat(schema): add GraphQL types for profile dashboard"
```

---

### Task 2: Add profile resolvers

**Files:**
- Create: `apps/api/src/graphql/resolvers/profile.ts`
- Modify: `apps/api/src/graphql/resolvers/index.ts`

**Step 1: Create the profile resolver file**

```typescript
/**
 * Profile Dashboard Resolvers
 *
 * Aggregates user data for the profile dashboard:
 * - userProfile: stats overview
 * - userActivity: contribution calendar data
 * - userAnalytics: mastery, trends, practice history
 */

import type { GraphQLContext } from '../../lib/context';
import { requireAuth } from '../../lib/context';

export const profileResolvers = {
  Query: {
    userProfile: async (_parent: unknown, args: { userId: string }, context: GraphQLContext) => {
      const user = requireAuth(context);

      const dbUser = await context.prisma.user.findUnique({
        where: { id: args.userId },
      });
      if (!dbUser) return null;

      const userProgress = await context.prisma.userProgress.findUnique({
        where: { userId: args.userId },
      });

      const recentAchievements = userProgress
        ? await context.prisma.userAchievement.findMany({
            where: { userProgressId: userProgress.id },
            include: { achievement: true },
            orderBy: { earnedAt: 'desc' },
            take: 10,
          })
        : [];

      const [worksheetCount, forumPostCount, calculationCount] = await Promise.all([
        context.prisma.worksheet.count({
          where: { userId: args.userId, deletedAt: null },
        }),
        context.prisma.forumPost.count({
          where: { authorId: args.userId, deletedAt: null },
        }),
        context.prisma.calculationHistory.count({
          where: { userId: args.userId },
        }),
      ]);

      return {
        user: dbUser,
        progress: userProgress,
        recentAchievements: recentAchievements.map((ua) => ({
          id: ua.achievement.id,
          name: ua.achievement.name,
          description: ua.achievement.description,
          type: ua.achievement.type,
          icon: ua.achievement.icon,
          points: ua.achievement.points,
          badgeUrl: ua.achievement.badgeUrl,
          earnedAt: ua.earnedAt,
        })),
        worksheetCount,
        forumPostCount,
        calculationCount,
      };
    },

    userActivity: async (_parent: unknown, args: { userId: string; days: number }, context: GraphQLContext) => {
      requireAuth(context);
      const since = new Date();
      since.setDate(since.getDate() - args.days);

      // Aggregate attempts and calculations by day
      const attempts = await context.prisma.attempt.findMany({
        where: {
          userProgress: { userId: args.userId },
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      });

      const calculations = await context.prisma.calculationHistory.findMany({
        where: {
          userId: args.userId,
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      });

      // Group by date string
      const counts = new Map<string, number>();
      for (const a of attempts) {
        const key = a.createdAt.toISOString().slice(0, 10);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const c of calculations) {
        const key = c.createdAt.toISOString().slice(0, 10);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    userAnalytics: async (_parent: unknown, args: { userId: string }, context: GraphQLContext) => {
      requireAuth(context);

      const userProgress = await context.prisma.userProgress.findUnique({
        where: { userId: args.userId },
      });

      if (!userProgress) {
        return {
          topicMastery: [],
          accuracyTrend: [],
          practiceHistory: [],
          streakHistory: [],
        };
      }

      // Topic mastery
      const topicProgress = await context.prisma.topicProgress.findMany({
        where: { userProgressId: userProgress.id },
        include: { topic: true },
      });

      const topicMastery = topicProgress.map((tp) => ({
        topic: tp.topic.name,
        mastery: tp.masteryLevel,
        problemsSolved: tp.problemsSolved,
      }));

      // Accuracy trend (last 30 practice sessions)
      const sessions = await context.prisma.practiceSession.findMany({
        where: { userProgressId: userProgress.id, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 30,
      });

      const accuracyTrend = sessions
        .filter((s) => s.completedAt)
        .map((s) => ({
          date: s.completedAt!.toISOString().slice(0, 10),
          accuracy: s.accuracy,
        }))
        .reverse();

      // Practice history (recent 50)
      const practiceHistory = sessions.map((s) => ({
        id: s.id,
        topic: s.topic,
        score: s.score,
        accuracy: s.accuracy,
        totalTime: s.totalTime,
        completedAt: s.completedAt?.toISOString() ?? null,
      }));

      // Streak history from attempts (group by day, count streak)
      const allAttempts = await context.prisma.attempt.findMany({
        where: { userProgressId: userProgress.id, correct: true },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      const streakByDay = new Map<string, number>();
      let currentStreak = 0;
      let lastDate = '';
      for (const a of allAttempts) {
        const d = a.createdAt.toISOString().slice(0, 10);
        if (d === lastDate) {
          // Same day, increment
        } else if (lastDate) {
          const prev = new Date(lastDate);
          prev.setDate(prev.getDate() + 1);
          if (prev.toISOString().slice(0, 10) === d) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        lastDate = d;
        streakByDay.set(d, currentStreak);
      }

      const streakHistory = Array.from(streakByDay.entries())
        .map(([date, streak]) => ({ date, streak }))
        .slice(-90); // Last 90 data points

      return { topicMastery, accuracyTrend, practiceHistory, streakHistory };
    },
  },
};
```

**Step 2: Register in resolver index**

In `apps/api/src/graphql/resolvers/index.ts`, add import and merge into Query:

```typescript
import { profileResolvers } from './profile';
```

Add `...profileResolvers.Query` to the `Query` object.

**Step 3: Commit**

```bash
git add apps/api/src/graphql/resolvers/profile.ts apps/api/src/graphql/resolvers/index.ts
git commit -m "feat: add profile dashboard GraphQL resolvers"
```

---

### Task 3: Add client-side GraphQL operations

**Files:**
- Modify: `apps/web/lib/graphql/operations.ts`

**Step 1: Add profile queries**

Add these GraphQL document definitions:

```typescript
export const USER_PROFILE_QUERY = gql`
  query UserProfile($userId: ID!) {
    userProfile(userId: $userId) {
      user {
        id name image bio createdAt
      }
      progress {
        id problemsSolved totalPoints streak longestStreak level experience lastActive
      }
      recentAchievements {
        id name description type icon points badgeUrl earnedAt
      }
      worksheetCount
      forumPostCount
      calculationCount
    }
  }
`;

export const USER_ACTIVITY_QUERY = gql`
  query UserActivity($userId: ID!, $days: Int) {
    userActivity(userId: $userId, days: $days) {
      date count
    }
  }
`;

export const USER_ANALYTICS_QUERY = gql`
  query UserAnalytics($userId: ID!) {
    userAnalytics(userId: $userId) {
      topicMastery { topic mastery problemsSolved }
      accuracyTrend { date accuracy }
      practiceHistory { id topic score accuracy totalTime completedAt }
      streakHistory { date streak }
    }
  }
`;
```

**Step 2: Commit**

```bash
git add apps/web/lib/graphql/operations.ts
git commit -m "feat: add GraphQL operations for profile dashboard"
```

---

### Task 4: Create profile UI components

**Files:**
- Create: `apps/web/components/profile/profile-overview.tsx`
- Create: `apps/web/components/profile/achievement-grid.tsx`
- Create: `apps/web/components/profile/activity-calendar.tsx`
- Create: `apps/web/components/profile/analytics-charts.tsx`
- Create: `apps/web/components/profile/practice-history-table.tsx`

These are all `'use client'` components that receive data as props from Apollo query results. The implementer should:

1. **ProfileOverview** — avatar (fallback initials), name, bio, joined date, stat cards grid (level, XP, problems solved, streak, total points, worksheets, forum posts, calculations). Use the Card component from `@/components/ui/card`. Framer Motion for entrance animations.

2. **AchievementGrid** — grid of earned badges. Each badge shows icon, name, points, earned date. Locked achievements (comparison with all available) show progress bar. Use `@/components/ui/badge`.

3. **ActivityCalendar** — SVG-based GitHub-style contribution grid. 52 weeks x 7 days. Color scale from `bg-muted` (0) to `oklch(0.65 0.25 264)` (max). Tooltip on hover showing date + count.

4. **AnalyticsCharts** — Three chart sub-components:
   - `TopicMasteryChart`: Horizontal bar chart, one bar per topic (0-100% width). CSS-only with transitions.
   - `AccuracyTrendChart`: SVG polyline chart with gradient fill. Date labels on x-axis.
   - `StreakHistoryChart`: SVG bar chart showing streak progression.

   All charts should be CSS/SVG-based (no external chart library). Use oklch color tokens.

5. **PracticeHistoryTable** — Paginated table showing sessions. Columns: topic, score, accuracy%, time, date. Client-side pagination (10 per page). Use semantic `<table>` elements.

All components should use the project's design system: oklch colors, `text-foreground`, `bg-card`, `border-border`, etc. No gray-* or slate-* colors.

**Step 6: Commit**

```bash
git add apps/web/components/profile/
git commit -m "feat: add profile dashboard UI components"
```

---

### Task 5: Create profile page with tabs

**Files:**
- Create: `apps/web/app/profile/page.tsx`
- Create: `apps/web/app/profile/profile-client.tsx`

**Step 1: Create the server page**

`apps/web/app/profile/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { ProfileClient } from './profile-client';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your NextCalc profile — stats, achievements, and analytics.',
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen relative" aria-label="User profile dashboard">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(at 20% 30%, oklch(0.55 0.27 264 / 0.06) 0%, transparent 50%),
            radial-gradient(at 80% 70%, oklch(0.58 0.22 300 / 0.05) 0%, transparent 50%)
          `,
        }}
      />
      <div className="fixed inset-0 -z-10 noise pointer-events-none" aria-hidden="true" />
      <ProfileClient />
    </main>
  );
}
```

**Step 2: Create the client component**

`apps/web/app/profile/profile-client.tsx`:

- `'use client'`
- Uses `useSession()` from NextAuth to get current user ID
- If not authenticated, redirects to sign-in
- Uses `useQuery` for `USER_PROFILE_QUERY`, `USER_ACTIVITY_QUERY`, `USER_ANALYTICS_QUERY`
- Renders Tabs (Overview / Achievements / Analytics / Practice History) using Radix Tabs
- Each tab renders the corresponding component from `@/components/profile/`

**Step 3: Add /profile to protected routes in proxy.ts**

In `apps/web/proxy.ts`, add `'/profile'` to the `protectedRoutes` array.

**Step 4: Commit**

```bash
git add apps/web/app/profile/ apps/web/proxy.ts
git commit -m "feat: add profile page with tabbed dashboard"
```

---

### Task 6: Add profile link to navigation

**Files:**
- Modify: `apps/web/components/layout/navigation.tsx`

Add a profile link/avatar that links to `/profile` when authenticated. This should appear in the right-side controls area (around line 464).

**Step 1: Commit**

```bash
git add apps/web/components/layout/navigation.tsx
git commit -m "feat: add profile link to navigation"
```

---

### Task 7: Build verification for Feature 10

**Step 1: Build**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"
```

**Step 2: Fix errors, commit if needed**

---

## Feature 12: WASM Native Build (Tasks 8-12)

### Task 8: Create Dockerfile for WASM build

**Files:**
- Create: `packages/math-engine/Dockerfile.wasm`

**Step 1: Create the Dockerfile**

```dockerfile
# WASM Build Environment for NextCalc Math Engine
# Uses Emscripten SDK to compile MPFR/GMP bindings to WebAssembly
#
# Usage:
#   docker build -f Dockerfile.wasm -o ./src/wasm/compiled .
#
# Output:
#   mpfr.js + mpfr.wasm in the output directory

FROM emscripten/emsdk:3.1.51 AS builder

WORKDIR /build

# Copy build script and source
COPY wasm-build.sh ./
COPY src/wasm/native/ ./src/wasm/native/

# Make build script executable
RUN chmod +x wasm-build.sh

# Create output directory
RUN mkdir -p src/wasm/compiled

# Run the release build
RUN ./wasm-build.sh release

# Output stage — only the compiled artifacts
FROM scratch AS output
COPY --from=builder /build/src/wasm/compiled/mpfr.js /
COPY --from=builder /build/src/wasm/compiled/mpfr.wasm /
```

**Step 2: Add build script to package.json**

In `packages/math-engine/package.json`, add to scripts:

```json
"wasm:docker": "docker build -f Dockerfile.wasm -o ./src/wasm/compiled ."
```

**Step 3: Ensure `src/wasm/compiled/` is in `.gitignore`**

Check and add if missing:

```
src/wasm/compiled/
```

**Step 4: Commit**

```bash
git add packages/math-engine/Dockerfile.wasm packages/math-engine/package.json
git commit -m "feat: add Docker-based WASM build pipeline"
```

---

### Task 9: Build the WASM binary

**Step 1: Run the Docker build**

```bash
cd packages/math-engine
docker build -f Dockerfile.wasm -o ./src/wasm/compiled .
```

This requires Docker to be running. If Docker is not available, skip this task and note it for later.

**Step 2: Copy WASM to public directory**

```bash
mkdir -p apps/web/public/wasm
cp packages/math-engine/src/wasm/compiled/mpfr.wasm apps/web/public/wasm/mpfr.wasm
```

**Step 3: Add WASM content-type header in next.config.ts**

In `apps/web/next.config.ts`, add headers config:

```typescript
async headers() {
  return [
    {
      source: '/wasm/:path*',
      headers: [
        { key: 'Content-Type', value: 'application/wasm' },
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ];
},
```

**Step 4: Commit**

```bash
git add apps/web/public/wasm/ apps/web/next.config.ts
git commit -m "feat: build WASM binary and configure static serving"
```

**Note:** If Docker build fails or is unavailable, skip this task. The mock fallback will continue to work. The loader wiring in Task 10 handles the fallback gracefully.

---

### Task 10: Wire loader to prefer WASM over mock

**Files:**
- Modify: `packages/math-engine/src/wasm/loader.ts`
- Modify: `packages/math-engine/src/wasm/index.ts`

**Step 1: Update loader to try WASM with fallback**

Add a `getHighPrecision()` function to `loader.ts` that:
1. Checks if `WebAssembly` is available
2. Tries to initialize MPFRWASMManager
3. On failure, falls back to mock
4. Returns a unified interface

```typescript
import { createMockWASM } from './mock';

export async function getHighPrecision(): Promise<MPFRModule> {
  if (typeof WebAssembly === 'undefined') {
    console.debug('WebAssembly not available, using mock fallback');
    return createMockWASM();
  }

  try {
    const manager = getWASMManager();
    const module = await manager.initialize();
    return module;
  } catch (err) {
    console.debug('WASM load failed, using mock fallback:', err);
    return createMockWASM();
  }
}
```

**Step 2: Export from index.ts**

Add `getHighPrecision` to the exports in `packages/math-engine/src/wasm/index.ts`.

**Step 3: Commit**

```bash
git add packages/math-engine/src/wasm/loader.ts packages/math-engine/src/wasm/index.ts
git commit -m "feat: wire WASM loader with automatic mock fallback"
```

---

### Task 11: Create Web Worker for off-main-thread computation

**Files:**
- Create: `apps/web/lib/workers/math-worker.ts`
- Create: `apps/web/lib/hooks/use-math-worker.ts`

**Step 1: Create the Web Worker**

`apps/web/lib/workers/math-worker.ts`:

```typescript
/**
 * Math computation Web Worker
 *
 * Runs WASM/mock math engine off the main thread.
 * Receives evaluate requests via postMessage, returns results.
 */

/// <reference lib="webworker" />

import { getHighPrecision } from '@nextcalc/math-engine/wasm';

interface MathWorkerRequest {
  id: string;
  type: 'evaluate';
  expression: string;
  precision?: number;
}

interface MathWorkerResponse {
  id: string;
  result?: string;
  error?: string;
}

let initialized = false;

async function ensureInit(precision?: number) {
  if (!initialized) {
    const hp = await getHighPrecision();
    if (precision) {
      hp._mpfr_set_default_precision(precision);
    }
    initialized = true;
  }
}

self.onmessage = async (event: MessageEvent<MathWorkerRequest>) => {
  const { id, type, expression, precision } = event.data;

  if (type === 'evaluate') {
    try {
      await ensureInit(precision);
      const hp = await getHighPrecision();
      const ctx = hp._mpfr_init_default();
      hp._mpfr_from_string(ctx, expression);
      const resultPtr = hp._mpfr_to_string(ctx);
      const result = hp.UTF8ToString(resultPtr);
      hp._mpfr_free_context(ctx);

      const response: MathWorkerResponse = { id, result };
      self.postMessage(response);
    } catch (err) {
      const response: MathWorkerResponse = {
        id,
        error: err instanceof Error ? err.message : 'Computation failed',
      };
      self.postMessage(response);
    }
  }
};
```

**Step 2: Create the hook**

`apps/web/lib/hooks/use-math-worker.ts`:

```typescript
'use client';

import { useRef, useCallback, useEffect } from 'react';

interface PendingRequest {
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

export function useMathWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const idCounterRef = useRef(0);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;

    const worker = new Worker(
      new URL('@/lib/workers/math-worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<{ id: string; result?: string; error?: string }>) => {
      const { id, result, error } = event.data;
      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);

      if (error) {
        pending.reject(new Error(error));
      } else if (result !== undefined) {
        pending.resolve(result);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      // Reject all pending
      for (const [, p] of pendingRef.current) {
        p.reject(new Error('Worker terminated'));
      }
      pendingRef.current.clear();
    };
  }, []);

  const evaluate = useCallback((expression: string, precision?: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not available'));
        return;
      }

      const id = String(++idCounterRef.current);
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({
        id,
        type: 'evaluate',
        expression,
        ...(precision ? { precision } : {}),
      });
    });
  }, []);

  return { evaluate, available: typeof Worker !== 'undefined' };
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/workers/math-worker.ts apps/web/lib/hooks/use-math-worker.ts
git commit -m "feat: add Web Worker for off-main-thread math computation"
```

---

### Task 12: Build verification for Feature 12

Build the web app and fix any errors. Commit fixes if needed.

---

## Feature 11: i18n (Tasks 13-20)

### Task 13: Create next-intl infrastructure

**Files:**
- Create: `apps/web/i18n/routing.ts`
- Create: `apps/web/i18n/request.ts`
- Create: `apps/web/i18n/navigation.ts`

**Step 1: Create routing config**

`apps/web/i18n/routing.ts`:

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ru', 'es', 'uk', 'de'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];
```

**Step 2: Create request config**

`apps/web/i18n/request.ts`:

```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**Step 3: Create navigation exports**

`apps/web/i18n/navigation.ts`:

```typescript
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

**Step 4: Commit**

```bash
git add apps/web/i18n/
git commit -m "feat: add next-intl routing, request, and navigation configs"
```

---

### Task 14: Update proxy.ts with locale middleware

**Files:**
- Modify: `apps/web/proxy.ts`

**Step 1: Chain next-intl middleware with existing logic**

Import `createMiddleware` from `next-intl/middleware` and chain it. The locale middleware should run first (to resolve the locale), then the existing CSP + auth logic runs on the resolved request.

The implementer needs to read the current proxy.ts and integrate `createMiddleware` from next-intl. Key: the `next-intl` middleware handles locale detection (Accept-Language → cookie → default) and rewrites URLs to include the `[locale]` segment.

Exclude API routes and static assets from locale processing.

**Step 2: Commit**

```bash
git add apps/web/proxy.ts
git commit -m "feat: add locale detection middleware to proxy.ts"
```

---

### Task 15: Restructure layouts for [locale]

**Files:**
- Modify: `apps/web/app/layout.tsx` (make thin shell)
- Create: `apps/web/app/[locale]/layout.tsx` (main layout with NextIntlClientProvider)

**Step 1: Create the [locale] layout**

Move the main layout content (ApolloWrapper, Navigation, fonts, metadata) into `app/[locale]/layout.tsx`. Wrap children in `NextIntlClientProvider`.

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ApolloWrapper>
        <Navigation />
        {children}
      </ApolloWrapper>
    </NextIntlClientProvider>
  );
}
```

**Step 2: Simplify root layout**

Root `app/layout.tsx` becomes:

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: '...' /* dark mode script */ }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

The `lang` attribute on `<html>` is now set dynamically by the `[locale]` layout or by next-intl.

**Step 3: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/[locale]/layout.tsx
git commit -m "feat: restructure layouts with [locale] segment and NextIntlClientProvider"
```

---

### Task 16: Move all page routes under [locale]

**Files:**
- Move: All directories from `apps/web/app/` to `apps/web/app/[locale]/`

Routes to move (27 directories):
- `page.tsx` (home)
- `algorithms/`, `auth/`, `chaos/`, `complex/`, `forum/`, `fourier/`, `game-theory/`, `graphs-full/`, `learn/`, `matrix/`, `ml-algorithms/`, `pde/`, `plot/`, `practice/`, `problems/`, `profile/`, `settings/`, `solver/`, `stats/`, `symbolic/`, `units/`, `worksheet/`
- `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`

**DO NOT move:**
- `api/` (API routes are not localized)
- `actions/` (server actions are not localized)
- `[locale]/` itself (already created)

The implementer should use `git mv` to preserve history.

**Step 1: Move all page directories**

```bash
# Move each route directory
git mv apps/web/app/page.tsx apps/web/app/[locale]/page.tsx
git mv apps/web/app/algorithms apps/web/app/[locale]/algorithms
git mv apps/web/app/auth apps/web/app/[locale]/auth
# ... etc for all 27 routes
git mv apps/web/app/error.tsx apps/web/app/[locale]/error.tsx
git mv apps/web/app/loading.tsx apps/web/app/[locale]/loading.tsx
git mv apps/web/app/not-found.tsx apps/web/app/[locale]/not-found.tsx
```

**Step 2: Update imports in moved files**

Any imports using relative paths like `../actions/` will need updating since the directory depth changed by one level.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move all page routes under [locale] segment"
```

---

### Task 17: Create English message file

**Files:**
- Create: `apps/web/messages/en.json`

Extract all hardcoded English strings from the codebase into a flat-namespace JSON file. Structure:

```json
{
  "nav.home": "Home",
  "nav.calculator": "Calculator",
  "nav.plot": "Plot",
  "nav.symbolic": "Symbolic",
  "nav.matrix": "Matrix",
  "nav.solver": "Solver",
  "nav.units": "Units",
  "nav.stats": "Statistics",
  "nav.complex": "Complex",
  "nav.worksheet": "Worksheet",
  "nav.forum": "Forum",
  "nav.algorithms": "Algorithms",
  "nav.learn": "Learn",
  "nav.practice": "Practice",
  "nav.problems": "Problems",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.signIn": "Sign In",
  "nav.signOut": "Sign Out",
  "nav.language": "Language",

  "calc.title": "Calculator",
  "calc.description": "Scientific calculator with algebraic expressions",
  "calc.history": "History",
  "calc.clear": "Clear",
  "calc.copy": "Copy",
  "calc.mode.deg": "DEG",
  "calc.mode.rad": "RAD",

  "common.loading": "Loading...",
  "common.error": "Something went wrong",
  "common.retry": "Try again",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.search": "Search",
  "common.noResults": "No results found",

  ...
}
```

The implementer should go through each page and extract ALL user-visible strings. This is the most labor-intensive task. Focus on:
1. Navigation labels
2. Page titles and descriptions
3. Button labels
4. Placeholder text
5. Error messages
6. Empty states
7. Form labels
8. Toast messages

**Step 1: Commit**

```bash
git add apps/web/messages/en.json
git commit -m "feat: extract English strings into messages/en.json"
```

---

### Task 18: Wire translations into navigation and key pages

**Files:**
- Modify: `apps/web/components/layout/navigation.tsx`
- Modify: Key page files to use `useTranslations()` / `getTranslations()`

**Step 1: Update navigation**

Replace hardcoded strings with `useTranslations('nav')` calls:

```typescript
const t = useTranslations('nav');
// label: t('home'), label: t('calculator'), etc.
```

Replace `next/link` imports with `import { Link } from '@/i18n/navigation'`.

**Step 2: Add language switcher**

Add a dropdown to the navigation's right-side controls that shows the current locale and allows switching. Use `useRouter()` and `usePathname()` from `@/i18n/navigation` to switch locale while staying on the same page.

```typescript
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

const locale = useLocale();
const router = useRouter();
const pathname = usePathname();

function switchLocale(newLocale: string) {
  router.replace(pathname, { locale: newLocale });
}
```

**Step 3: Update key pages**

For Server Components, use `getTranslations`:
```typescript
const t = await getTranslations('pageName');
```

For Client Components, use `useTranslations`:
```typescript
const t = useTranslations('pageName');
```

Focus on the highest-traffic pages first: calculator, home, navigation, settings.

**Step 4: Commit**

```bash
git add apps/web/components/layout/navigation.tsx apps/web/app/[locale]/
git commit -m "feat: wire translations into navigation and key pages"
```

---

### Task 19: Create translation files for ru, es, uk, de

**Files:**
- Create: `apps/web/messages/ru.json`
- Create: `apps/web/messages/es.json`
- Create: `apps/web/messages/uk.json`
- Create: `apps/web/messages/de.json`

Copy `en.json` structure and translate all values. Machine-translated placeholders are acceptable for the initial implementation.

**Step 1: Commit**

```bash
git add apps/web/messages/
git commit -m "feat: add ru, es, uk, de translation files"
```

---

### Task 20: Build verification for Feature 11

**Step 1: Build**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"
```

**Step 2: Verify key routes work**

- `/en` (home in English)
- `/ru` (home in Russian)
- `/en/profile` (profile in English)
- `/en/settings` (settings)
- Language switcher changes URL prefix

**Step 3: Fix errors, commit if needed**

```bash
git add -A
git commit -m "fix: resolve build errors from i18n integration"
```
