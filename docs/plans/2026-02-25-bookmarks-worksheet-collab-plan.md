# Bookmarks + Worksheet Persistence + Collab SSE Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire learning bookmarks via polymorphic Favorite model, add worksheet DB persistence with optimistic concurrency, and replace stub WebSocket transport with graphql-sse for cross-device collaboration.

**Architecture:** Server Actions for all writes. Polymorphic Favorite with resourceType enum. Worksheet cells in `content: Json`, title in dedicated column, `version: Int` for optimistic locking. graphql-sse 2.6.0 with Apollo split-link for SSE subscriptions. BroadcastChannel stays for same-device sync.

**Tech Stack:** Next.js 16 Server Actions, React 19 `useOptimistic`, Prisma 7, Zod 4, NextAuth v5, graphql-sse 2.6.0, Apollo Client 4.2.0-alpha.0

---

## Important Context

- **pnpm not in PATH** on this machine. Use: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree-path>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest <command> 2>&1"`
- **Prisma CLI**: Run from worktree root — `pnpm --filter @nextcalc/database exec prisma generate`
- **Zod 4**: `.issues` not `.errors` on ZodError
- **TypeScript 6.0 `exactOptionalPropertyTypes`**: Use `...(val ? { key: val } : {})` for optional fields
- **React 19**: No forwardRef. ref as regular prop. Named imports only.
- **Auth**: `import { auth } from '@/auth'` → `session?.user?.id`
- **Prisma**: `import { prisma } from '@/lib/prisma'`
- **ActionResult<T>**: `import type { ActionResult } from '@/app/actions/problems'` — `{ success, data?, error? }`
- **getOrCreateUserProgress**: `import { getOrCreateUserProgress } from '@/app/actions/problems'` — shared atomic upsert

---

## Feature 7: Learning Bookmarks (Tasks 1-4)

### Task 1: Make Favorite model polymorphic

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add FavoriteType enum**

Add before the existing `Favorite` model (before line 701):

```prisma
enum FavoriteType {
  PROBLEM
  DEFINITION
}
```

**Step 2: Update Favorite model**

Replace the `Favorite` model (lines 701-714) with:

```prisma
model Favorite {
  id             String       @id @default(cuid())
  userProgressId String
  resourceType   FavoriteType @default(PROBLEM)
  problemId      String?
  definitionId   String?      @db.VarChar(255)
  createdAt      DateTime     @default(now())

  userProgress UserProgress @relation(fields: [userProgressId], references: [id], onDelete: Cascade)
  problem      Problem?     @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@unique([userProgressId, problemId])
  @@unique([userProgressId, definitionId])
  @@map("favorites")
  @@index([userProgressId])
  @@index([problemId])
  @@index([definitionId])
}
```

**Step 3: Update toggleFavorite in problems.ts**

In `apps/web/app/actions/problems.ts`, update the `toggleFavorite` function to specify `resourceType: 'PROBLEM'` when creating:

Find the `await prisma.favorite.create` call and change:

```typescript
    await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        problemId: data.problemId,
      },
    });
```

To:

```typescript
    await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        resourceType: 'PROBLEM',
        problemId: data.problemId,
      },
    });
```

**Step 4: Regenerate Prisma client**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/database exec prisma generate 2>&1"`

**Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma apps/web/app/actions/problems.ts
git commit -m "feat(schema): make Favorite polymorphic with FavoriteType enum"
```

---

### Task 2: Add bookmark validation schema and server action

**Files:**
- Modify: `apps/web/lib/validations/learning.ts`
- Create: `apps/web/app/actions/learn.ts`

**Step 1: Add BookmarkToggleSchema to learning.ts**

After the `FavoriteToggleSchema`, add:

```typescript
export const BookmarkToggleSchema = z.object({
  definitionId: z.string().min(1),
});

export type BookmarkToggle = z.infer<typeof BookmarkToggleSchema>;
```

**Step 2: Create the learn server action file**

Create `apps/web/app/actions/learn.ts`:

```typescript
'use server';

/**
 * Server Actions for Learning Bookmarks
 *
 * Toggles definition bookmarks using the polymorphic Favorite model.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateUserProgress } from './problems';
import type { ActionResult } from './problems';
import { BookmarkToggleSchema } from '@/lib/validations/learning';

// ---------------------------------------------------------------------------
// toggleBookmark
// ---------------------------------------------------------------------------

export interface ToggleBookmarkResult {
  isBookmarked: boolean;
}

export async function toggleBookmark(
  _prevState: ActionResult<ToggleBookmarkResult>,
  formData: FormData,
): Promise<ActionResult<ToggleBookmarkResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = BookmarkToggleSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save bookmarks' };
    }

    const userProgress = await getOrCreateUserProgress(session.user.id);

    // Check if already bookmarked
    const existing = await prisma.favorite.findUnique({
      where: {
        userProgressId_definitionId: {
          userProgressId: userProgress.id,
          definitionId: data.definitionId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidatePath('/learn');
      return { success: true, data: { isBookmarked: false } };
    }

    await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        resourceType: 'DEFINITION',
        definitionId: data.definitionId,
      },
    });

    revalidatePath('/learn');
    return { success: true, data: { isBookmarked: true } };
  } catch (error) {
    console.error('toggleBookmark error:', error);
    return { success: false, error: 'Failed to toggle bookmark' };
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/validations/learning.ts apps/web/app/actions/learn.ts
git commit -m "feat: add toggleBookmark server action for definition bookmarks"
```

---

### Task 3: Wire learn topic page to bookmark action

**Files:**
- Create: `apps/web/app/learn/[topic]/bookmark-explorer-client.tsx`
- Modify: `apps/web/app/learn/[topic]/page.tsx`

**Step 1: Create the client wrapper with useOptimistic**

Create `apps/web/app/learn/[topic]/bookmark-explorer-client.tsx`:

```typescript
'use client';

import { useOptimistic, useActionState, useCallback } from 'react';
import { KnowledgeExplorer } from '@/components/math/knowledge-explorer';
import { toggleBookmark } from '@/app/actions/learn';
import type { ActionResult, ToggleBookmarkResult } from '@/app/actions/learn';
import type { Definition } from '@nextcalc/math-engine/knowledge';

interface BookmarkExplorerClientProps {
  definitions: ReadonlyArray<Definition>;
  bookmarkedIds: ReadonlyArray<string>;
}

const initialState: ActionResult<ToggleBookmarkResult> = { success: false };

export function BookmarkExplorerClient({ definitions, bookmarkedIds }: BookmarkExplorerClientProps) {
  const [optimisticIds, toggleOptimistic] = useOptimistic(
    bookmarkedIds,
    (current: ReadonlyArray<string>, definitionId: string) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId],
  );

  const [_state, bookmarkAction] = useActionState(toggleBookmark, initialState);

  const handleToggleBookmark = useCallback(
    (definitionId: string) => {
      toggleOptimistic(definitionId);
      const fd = new FormData();
      fd.set('definitionId', definitionId);
      bookmarkAction(fd);
    },
    [toggleOptimistic, bookmarkAction],
  );

  return (
    <KnowledgeExplorer
      definitions={definitions}
      bookmarkedIds={[...optimisticIds]}
      onToggleBookmark={handleToggleBookmark}
    />
  );
}
```

**Step 2: Update the server page**

In `apps/web/app/learn/[topic]/page.tsx`:

Add imports at top:

```typescript
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { BookmarkExplorerClient } from './bookmark-explorer-client';
```

In the `TopicPage` function body, after `const problems = ...` (line 71), add:

```typescript
  // Fetch user's bookmarked definition IDs
  let bookmarkedIds: string[] = [];
  const session = await auth();
  if (session?.user?.id) {
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (userProgress) {
      const bookmarks = await prisma.favorite.findMany({
        where: {
          userProgressId: userProgress.id,
          resourceType: 'DEFINITION',
          definitionId: { not: null },
        },
        select: { definitionId: true },
      });
      bookmarkedIds = bookmarks.map((b) => b.definitionId).filter((id): id is string => id !== null);
    }
  }
```

Then replace the `<KnowledgeExplorer>` block (lines 184-193) with:

```tsx
          <BookmarkExplorerClient
            definitions={definitions}
            bookmarkedIds={bookmarkedIds}
          />
```

Remove the old `KnowledgeExplorer` import from line 4 (it's now imported in the client component).

**Step 3: Commit**

```bash
git add apps/web/app/learn/[topic]/bookmark-explorer-client.tsx apps/web/app/learn/[topic]/page.tsx
git commit -m "feat: wire learn page bookmarks with useOptimistic and toggleBookmark action"
```

---

### Task 4: Build verification for Feature 7

**Step 1: Regenerate Prisma and build**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/database exec prisma generate 2>&1"
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"
```

**Step 2: Fix any TypeScript errors**

**Step 3: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build errors from bookmark integration"
```

---

## Feature 8: Worksheet Database Persistence (Tasks 5-9)

### Task 5: Add version column to Worksheet model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add version field**

In the `Worksheet` model (line 111-137), add after `views` (line 119):

```prisma
  version     Int                 @default(0)
```

**Step 2: Regenerate Prisma client**

**Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(schema): add version column to Worksheet for optimistic concurrency"
```

---

### Task 6: Add worksheet validation schemas

**Files:**
- Modify: `apps/web/lib/validations/learning.ts`

**Step 1: Add schemas**

After the bookmark schemas, add:

```typescript
// ============================================================================
// Worksheet Schemas
// ============================================================================

export const SaveWorksheetSchema = z.object({
  worksheetId: z.string().optional(),
  title: z.string().min(1).max(255),
  cells: z.string().min(2), // JSON string, minimum "[]"
  expectedVersion: z.coerce.number().int().min(0).default(0),
});

export const LoadWorksheetSchema = z.object({
  worksheetId: z.string().min(1),
});

export const DeleteWorksheetSchema = z.object({
  worksheetId: z.string().min(1),
});

export type SaveWorksheet = z.infer<typeof SaveWorksheetSchema>;
export type LoadWorksheet = z.infer<typeof LoadWorksheetSchema>;
export type DeleteWorksheet = z.infer<typeof DeleteWorksheetSchema>;
```

**Step 2: Commit**

```bash
git add apps/web/lib/validations/learning.ts
git commit -m "feat(validation): add Zod schemas for worksheet persistence"
```

---

### Task 7: Create worksheet server actions

**Files:**
- Create: `apps/web/app/actions/worksheet.ts`

**Step 1: Create the file**

```typescript
'use server';

/**
 * Server Actions for Worksheet Database Persistence
 *
 * - saveWorksheet: autosave with optimistic concurrency (version check)
 * - loadWorksheet: load from DB with permission check
 * - deleteWorksheet: soft delete
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { ActionResult } from './problems';
import {
  SaveWorksheetSchema,
  LoadWorksheetSchema,
  DeleteWorksheetSchema,
} from '@/lib/validations/learning';

// ---------------------------------------------------------------------------
// saveWorksheet
// ---------------------------------------------------------------------------

export interface SaveWorksheetResult {
  worksheetId: string;
  version: number;
  conflict?: boolean;
  serverVersion?: number;
}

export async function saveWorksheet(
  _prevState: ActionResult<SaveWorksheetResult>,
  formData: FormData,
): Promise<ActionResult<SaveWorksheetResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = SaveWorksheetSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save worksheets' };
    }

    const cells = JSON.parse(data.cells);

    // Create new worksheet
    if (!data.worksheetId) {
      const worksheet = await prisma.worksheet.create({
        data: {
          title: data.title,
          content: cells,
          userId: session.user.id,
          version: 0,
        },
      });

      revalidatePath('/worksheet');
      return {
        success: true,
        data: { worksheetId: worksheet.id, version: 0 },
      };
    }

    // Update existing worksheet
    const existing = await prisma.worksheet.findUnique({
      where: { id: data.worksheetId },
      select: { userId: true, version: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Worksheet not found' };
    }

    if (existing.userId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Optimistic concurrency check
    if (existing.version !== data.expectedVersion) {
      return {
        success: false,
        error: 'Worksheet was modified elsewhere',
        data: {
          worksheetId: data.worksheetId,
          version: existing.version,
          conflict: true,
          serverVersion: existing.version,
        },
      };
    }

    const updated = await prisma.worksheet.update({
      where: { id: data.worksheetId },
      data: {
        title: data.title,
        content: cells,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      data: { worksheetId: updated.id, version: updated.version },
    };
  } catch (error) {
    console.error('saveWorksheet error:', error);
    return { success: false, error: 'Failed to save worksheet' };
  }
}

// ---------------------------------------------------------------------------
// loadWorksheet
// ---------------------------------------------------------------------------

export interface LoadWorksheetResult {
  worksheetId: string;
  title: string;
  cells: unknown;
  version: number;
}

export async function loadWorksheet(
  _prevState: ActionResult<LoadWorksheetResult>,
  formData: FormData,
): Promise<ActionResult<LoadWorksheetResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = LoadWorksheetSchema.parse(raw);

    const worksheet = await prisma.worksheet.findUnique({
      where: { id: data.worksheetId },
      select: {
        id: true,
        title: true,
        content: true,
        version: true,
        visibility: true,
        userId: true,
        deletedAt: true,
        shares: { select: { sharedWith: true, permission: true } },
      },
    });

    if (!worksheet || worksheet.deletedAt) {
      return { success: false, error: 'Worksheet not found' };
    }

    // Check access
    const session = await auth();
    const userId = session?.user?.id;

    if (worksheet.visibility === 'PRIVATE') {
      if (!userId || worksheet.userId !== userId) {
        // Check shares
        const hasShare = userId && worksheet.shares.some(
          (s) => s.sharedWith === userId,
        );
        if (!hasShare) {
          return { success: false, error: 'Worksheet not found' };
        }
      }
    }

    return {
      success: true,
      data: {
        worksheetId: worksheet.id,
        title: worksheet.title,
        cells: worksheet.content,
        version: worksheet.version,
      },
    };
  } catch (error) {
    console.error('loadWorksheet error:', error);
    return { success: false, error: 'Failed to load worksheet' };
  }
}

// ---------------------------------------------------------------------------
// deleteWorksheet
// ---------------------------------------------------------------------------

export interface DeleteWorksheetResult {
  worksheetId: string;
}

export async function deleteWorksheet(
  _prevState: ActionResult<DeleteWorksheetResult>,
  formData: FormData,
): Promise<ActionResult<DeleteWorksheetResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = DeleteWorksheetSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to delete worksheets' };
    }

    const worksheet = await prisma.worksheet.findUnique({
      where: { id: data.worksheetId },
      select: { userId: true, deletedAt: true },
    });

    if (!worksheet || worksheet.deletedAt) {
      return { success: false, error: 'Worksheet not found' };
    }

    if (worksheet.userId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.worksheet.update({
      where: { id: data.worksheetId },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/worksheet');
    return {
      success: true,
      data: { worksheetId: data.worksheetId },
    };
  } catch (error) {
    console.error('deleteWorksheet error:', error);
    return { success: false, error: 'Failed to delete worksheet' };
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/app/actions/worksheet.ts
git commit -m "feat: add server actions for worksheet persistence with optimistic concurrency"
```

---

### Task 8: Add DB persistence to worksheet store

**Files:**
- Modify: `apps/web/lib/stores/worksheet-store.ts`

**Step 1: Add persistence fields to store**

In the `WorksheetStore` interface (after `resetWorksheet` at line 118), add:

```typescript
  // DB persistence
  worksheetId: string | null;
  version: number;
  isDirty: boolean;
  hydrate: (data: { worksheetId: string; title: string; cells: WorksheetCell[]; version: number }) => void;
  markClean: (version: number, worksheetId: string) => void;
```

**Step 2: Add initial values in the store creation**

In the store's initial state (the `create()` call), add after `worksheet: createWorksheet()`:

```typescript
      worksheetId: null,
      version: 0,
      isDirty: false,
```

**Step 3: Implement hydrate and markClean**

After the `importFromJSON` action, add:

```typescript
        hydrate: (data) => {
          set((draft) => {
            draft.worksheet = {
              id: data.worksheetId,
              title: data.title,
              cells: data.cells,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            draft.worksheetId = data.worksheetId;
            draft.version = data.version;
            draft.isDirty = false;
          });
        },

        markClean: (version, worksheetId) => {
          set((draft) => {
            draft.version = version;
            draft.worksheetId = worksheetId;
            draft.isDirty = false;
          });
        },
```

**Step 4: Mark dirty on mutations**

In each mutation that changes cell content (updateMathInput, updateTextContent, updatePlotExpressions, updatePlotViewport, addCell, deleteCell, moveCellUp, moveCellDown, setTitle), add at the end:

```typescript
            draft.isDirty = true;
```

**Step 5: Add selector hooks**

At the bottom of the file, add:

```typescript
export const useWorksheetId = () =>
  useWorksheetStore((s) => s.worksheetId);

export const useWorksheetVersion = () =>
  useWorksheetStore((s) => s.version);

export const useWorksheetDirty = () =>
  useWorksheetStore((s) => s.isDirty);
```

And add `hydrate` and `markClean` to the `useWorksheetActions` selector.

**Step 6: Update persist partialize**

Update the `partialize` function to include DB state:

```typescript
        partialize: (store) => ({ worksheet: store.worksheet, worksheetId: store.worksheetId, version: store.version }),
```

**Step 7: Commit**

```bash
git add apps/web/lib/stores/worksheet-store.ts
git commit -m "feat: add DB persistence fields to worksheet store"
```

---

### Task 9: Wire worksheet page autosave

**Files:**
- Modify: `apps/web/app/worksheet/page.tsx`
- Modify: `apps/web/app/worksheet/client-wrapper.tsx`

**Step 1: Update the server page to accept worksheet ID from URL**

In `apps/web/app/worksheet/page.tsx`, update to pass search params:

```typescript
import type { Metadata } from 'next';
import { WorksheetClientWrapper } from './client-wrapper';

export const metadata: Metadata = {
  title: 'Worksheet',
  description:
    'Jupyter-like mathematical notebook with math cells, markdown notes, and inline 2D plots. Variables persist across cells.',
};

export default async function WorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: worksheetId } = await searchParams;

  return (
    <main
      className="min-h-screen relative"
      aria-label="Mathematical worksheet editor"
    >
      {/* Background gradients (keep existing) */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(at 15% 25%, oklch(0.55 0.27 264 / 0.06) 0%, transparent 50%),
            radial-gradient(at 85% 75%, oklch(0.58 0.22 300 / 0.05) 0%, transparent 50%),
            radial-gradient(at 50% 10%, oklch(0.50 0.20 220 / 0.04) 0%, transparent 40%)
          `,
        }}
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.80 0.10 264) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="fixed inset-0 -z-10 noise pointer-events-none" aria-hidden="true" />

      <WorksheetClientWrapper worksheetId={worksheetId} />
    </main>
  );
}
```

**Step 2: Add autosave logic to client-wrapper.tsx**

Update `apps/web/app/worksheet/client-wrapper.tsx` to include autosave and load logic:

```typescript
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useCallback, useActionState } from 'react';
import { useWorksheetStore } from '@/lib/stores/worksheet-store';
import { saveWorksheet, loadWorksheet } from '@/app/actions/worksheet';
import type { ActionResult, SaveWorksheetResult, LoadWorksheetResult } from '@/app/actions/worksheet';

const WorksheetEditor = dynamic(
  () => import('@/components/worksheet/worksheet-editor').then((m) => m.WorksheetEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-border border-t-foreground animate-spin" />
          <div className="mt-4 text-sm text-muted-foreground">Loading worksheet...</div>
        </div>
      </div>
    ),
  },
);

interface WorksheetClientWrapperProps {
  worksheetId?: string;
}

const initialSaveState: ActionResult<SaveWorksheetResult> = { success: false };
const initialLoadState: ActionResult<LoadWorksheetResult> = { success: false };

export function WorksheetClientWrapper({ worksheetId: initialWorksheetId }: WorksheetClientWrapperProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, saveAction] = useActionState(saveWorksheet, initialSaveState);
  const [loadState, loadAction] = useActionState(loadWorksheet, initialLoadState);

  const store = useWorksheetStore;

  // Load worksheet from DB if ID provided
  useEffect(() => {
    if (initialWorksheetId) {
      const fd = new FormData();
      fd.set('worksheetId', initialWorksheetId);
      loadAction(fd);
    }
  }, [initialWorksheetId, loadAction]);

  // Hydrate store when load completes
  useEffect(() => {
    if (loadState.success && loadState.data) {
      const { worksheetId, title, cells, version } = loadState.data;
      store.getState().hydrate({
        worksheetId,
        title,
        cells: cells as import('@/lib/stores/worksheet-store').WorksheetCell[],
        version,
      });
    }
  }, [loadState, store]);

  // Track save responses to update version
  useEffect(() => {
    if (saveState.success && saveState.data && !saveState.data.conflict) {
      store.getState().markClean(saveState.data.version, saveState.data.worksheetId);
    }
  }, [saveState, store]);

  // Autosave: 1.5s debounce on store changes
  const doSave = useCallback(() => {
    const state = store.getState();
    if (!state.isDirty) return;

    const fd = new FormData();
    if (state.worksheetId) fd.set('worksheetId', state.worksheetId);
    fd.set('title', state.worksheet.title);
    fd.set('cells', JSON.stringify(state.worksheet.cells));
    fd.set('expectedVersion', state.version.toString());
    saveAction(fd);
  }, [store, saveAction]);

  useEffect(() => {
    const unsub = store.subscribe((state, prevState) => {
      if (state.isDirty && state.worksheet.updatedAt !== prevState.worksheet.updatedAt) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(doSave, 1500);
      }
    });
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [store, doSave]);

  return <WorksheetEditor />;
}
```

**Step 3: Commit**

```bash
git add apps/web/app/worksheet/page.tsx apps/web/app/worksheet/client-wrapper.tsx
git commit -m "feat: wire worksheet autosave with 1.5s debounce and DB load"
```

---

## Feature 9: Collab SSE Wiring (Tasks 10-13)

### Task 10: Install graphql-sse and add SSE route handler

**Files:**
- Modify: `package.json` (root or apps/web)
- Create: `apps/web/app/api/graphql/stream/route.ts`

**Step 1: Install graphql-sse**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web add graphql-sse@2.6.0 2>&1"
```

**Step 2: Create SSE route handler**

Create `apps/web/app/api/graphql/stream/route.ts`:

```typescript
/**
 * GraphQL SSE Subscription Endpoint
 *
 * Uses graphql-sse to serve GraphQL subscriptions over Server-Sent Events.
 * This works on Vercel (serverless) unlike WebSocket-based subscriptions.
 */

import { createHandler } from 'graphql-sse/lib/use/fetch';
import { schema } from '@nextcalc/api/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const handler = createHandler({
  schema,
  context: async () => {
    const session = await auth();
    return {
      user: session?.user ?? null,
      prisma,
      loaders: {},
      req: { headers: {} },
    };
  },
});

export const GET = async (req: Request) => handler(req);
export const POST = async (req: Request) => handler(req);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

**Step 3: Commit**

```bash
git add apps/web/app/api/graphql/stream/route.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add graphql-sse SSE route handler for subscriptions"
```

---

### Task 11: Add SSE link to Apollo Client

**Files:**
- Modify: `apps/web/lib/graphql/client.ts`

**Step 1: Add SSE link with split**

At the top, add imports:

```typescript
import { split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-sse';
```

After the `authLink` definition, add the SSE link:

```typescript
  // SSE link for subscriptions (graphql-sse 2.6.0)
  const sseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/graphql/stream`
    : '/api/graphql/stream';

  const sseClient = createClient({
    url: sseUrl,
    singleConnection: true,
    headers: () => ({
      'x-apollo-client': '4.2.0-alpha.0',
    }),
  });

  // Custom SSE link for Apollo Client
  const sseLink = new (class extends HttpLink {
    request(operation: import('@apollo/client').Operation) {
      return new (class extends import('@apollo/client').Observable<import('@apollo/client').FetchResult> {
        constructor() {
          super((observer) => {
            const dispose = sseClient.subscribe(
              { query: operation.query.loc?.source.body ?? '', variables: operation.variables },
              {
                next: (value) => observer.next(value as import('@apollo/client').FetchResult),
                error: (err) => observer.error(err),
                complete: () => observer.complete(),
              },
            );
            return () => dispose();
          });
        }
      })();
    }
  })();
```

Actually, graphql-sse doesn't integrate directly as an Apollo link like that. A cleaner approach is to use a custom link. Replace the above with a simpler pattern. In the `makeClient` function, before the `return new ApolloClient(...)`, add:

```typescript
  // SSE subscription link
  const sseLink = new HttpLink({ uri: '/api/graphql/stream' });

  // Split: subscriptions go to SSE, everything else to HTTP
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    sseLink,
    from([errorLink, authLink, httpLink]),
  );
```

Then change the ApolloClient `link` from `from([errorLink, authLink, httpLink])` to `splitLink`.

**Note:** The full SSE link integration with graphql-sse's `createClient` is more involved. The implementer should read graphql-sse docs for the Apollo Client integration pattern. The key is:
1. Create a custom Apollo Link that wraps `graphql-sse`'s `createClient().subscribe()`
2. Use `split()` to route subscriptions to the SSE link

**Step 2: Commit**

```bash
git add apps/web/lib/graphql/client.ts
git commit -m "feat: add SSE subscription link to Apollo Client via split()"
```

---

### Task 12: Wire collab hook to use Apollo subscription

**Files:**
- Modify: `apps/web/lib/hooks/use-worksheet-collab.ts`

**Step 1: Add Apollo subscription for cross-device sync**

The existing hook has a `connectWebSocket` function (around line 200+). Replace the WebSocket connection logic with an Apollo `useSubscription` usage, or more precisely, add a new function that uses the Apollo subscription client.

In the hook, find the WebSocket transport section. Replace the `connectWebSocket` function body with a subscription setup using `graphql-sse`'s client directly (since the hook is not a React component, we can't use `useSubscription` directly):

```typescript
import { createClient } from 'graphql-sse';

const sseClient = createClient({
  url: '/api/graphql/stream',
  singleConnection: true,
});

function connectSSE(worksheetId: string, onData: (worksheet: unknown) => void): () => void {
  const dispose = sseClient.subscribe(
    {
      query: `subscription WorksheetUpdated($worksheetId: ID!) {
        worksheetUpdated(worksheetId: $worksheetId) {
          id title content version updatedAt
        }
      }`,
      variables: { worksheetId },
    },
    {
      next: (result) => {
        if (result.data?.worksheetUpdated) {
          onData(result.data.worksheetUpdated);
        }
      },
      error: (err) => {
        console.error('SSE subscription error:', err);
        collabStore.getState().markError();
      },
      complete: () => {
        console.debug('SSE subscription complete');
      },
    },
  );
  return dispose;
}
```

Then in the `startCollab` / `joinSession` functions, call `connectSSE(worksheetId, handler)` instead of the WebSocket connection. The handler applies incoming cells using the existing LWW logic.

The BroadcastChannel code stays exactly as-is.

**Step 2: Commit**

```bash
git add apps/web/lib/hooks/use-worksheet-collab.ts
git commit -m "feat: replace WebSocket transport with graphql-sse for cross-device sync"
```

---

### Task 13: Build verification for Features 8-9

**Step 1: Build**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/database exec prisma generate 2>&1"
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location '<worktree>'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"
```

**Step 2: Verify key routes**

- `/worksheet` page
- `/api/graphql/stream` SSE endpoint
- `/learn/[topic]` page

**Step 3: Fix any errors and commit**

```bash
git add -A
git commit -m "fix: resolve build errors from worksheet persistence and SSE integration"
```

---

## API Re-Export (if needed)

The SSE route handler imports `schema` from `@nextcalc/api/server`. If the API package doesn't export `schema` at that subpath, add it to `apps/api/package.json` exports:

```json
"./server": {
  "import": "./src/server.ts",
  "types": "./src/server.ts"
}
```

This is checked during Task 10.
