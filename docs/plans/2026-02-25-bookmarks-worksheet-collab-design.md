# Learning Bookmarks + Worksheet Persistence + Collab SSE Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the corresponding plan task-by-task.

**Goal:** Wire learning bookmarks to the database via a polymorphic Favorite model, add worksheet DB persistence with optimistic concurrency, and replace the stub WebSocket collab transport with graphql-sse over Apollo Client.

**Architecture:** Server Actions for all writes. Polymorphic Favorite for bookmarks. JSONB cells column + version Int for worksheet concurrency. graphql-sse with Apollo split-link for cross-device subscription delivery. BroadcastChannel stays for same-device sync.

**Tech Stack:** Server Actions, React 19 `useOptimistic`, Prisma 7 (`@nextcalc/database`), Zod 4, NextAuth v5, graphql-sse 2.6.0, Apollo Client 4.2.0-alpha.0

---

## Feature 7: Learning Bookmarks

### Schema Changes

Make the `Favorite` model polymorphic with a `FavoriteType` enum:

```prisma
enum FavoriteType {
  PROBLEM
  DEFINITION
}

model Favorite {
  id             String       @id @default(cuid())
  userProgressId String
  resourceType   FavoriteType @default(PROBLEM)
  problemId      String?      // set when resourceType = PROBLEM
  definitionId   String?      // set when resourceType = DEFINITION
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

### Server Action

**New file: `apps/web/app/actions/learn.ts`**

`toggleBookmark(prevState, formData)`:
- Validates via `BookmarkToggleSchema` (definitionId)
- Calls `auth()`, requires sign-in
- Calls `getOrCreateUserProgress` (imported from `./problems`)
- Toggles Favorite record with `resourceType: 'DEFINITION'`
- `revalidatePath('/learn')`
- Returns `{ isBookmarked }`

### Validation Schema

**Extend: `apps/web/lib/validations/learning.ts`**

```typescript
BookmarkToggleSchema {
  definitionId: z.string().min(1)
}
```

### UI Wiring

**Modify: `apps/web/app/learn/[topic]/page.tsx`**
- Server Component queries user's bookmarked definition IDs from Prisma
- Passes as `bookmarkedIds` prop to `KnowledgeExplorer`
- New client wrapper uses `useOptimistic` for instant toggle feedback
- Calls `toggleBookmark` server action

### Existing toggleFavorite

The existing `toggleFavorite` action in `apps/web/app/actions/problems.ts` continues to work for problem favorites. The schema change makes `problemId` optional but the action always sets it, so no code change needed there beyond updating the Prisma queries to include `resourceType: 'PROBLEM'` in the unique lookups.

---

## Feature 8: Worksheet Database Persistence

### Schema Changes

**Modify `Worksheet` model** — add `version` column:

```prisma
model Worksheet {
  // ... existing fields ...
  version     Int                 @default(0)  // optimistic concurrency
}
```

### Server Actions

**New file: `apps/web/app/actions/worksheet.ts`**

1. **`saveWorksheet(prevState, formData)`** — Autosave (1.5s debounced from client)
   - Takes `worksheetId` (empty for new), `title`, `cells` (JSON string), `expectedVersion`
   - New worksheet: creates record with `userId`, `title`, `content: JSON.parse(cells)`, returns `{ worksheetId, version: 0 }`
   - Existing worksheet: verifies ownership, checks `expectedVersion === current.version`, rejects on mismatch with `{ conflict: true, serverVersion }`, updates `content`, `title`, increments `version`
   - Auth required

2. **`loadWorksheet(prevState, formData)`** — Load from DB
   - Takes `worksheetId`
   - Checks visibility/ownership/share permissions
   - Returns `{ title, cells, version, worksheetId }`

3. **`deleteWorksheet(prevState, formData)`** — Soft delete
   - Sets `deletedAt = new Date()`
   - Auth + ownership required

### Client Integration

**Modify: `apps/web/lib/stores/worksheet-store.ts`**
- Add `worksheetId`, `version`, `isDirty` fields to store state
- Add `hydrate(serverData)` action to load from server response
- Add `markClean(version)` action after successful save

**Modify: `apps/web/app/worksheet/page.tsx`**
- Autosave: 1.5s debounced call to `saveWorksheet` on store changes
- On conflict: show toast prompting reload
- On load (URL param `?id=xxx`): call `loadWorksheet`, hydrate store

### Auth Behavior

- Authenticated: DB is source of truth, localStorage is write-behind cache
- Anonymous: localStorage only (existing behavior preserved, no regression)

---

## Feature 9: Collab SSE Wiring

### New Dependency

`graphql-sse@2.6.0` — SSE transport for GraphQL subscriptions (Vercel-compatible)

### Apollo Client Link Setup

**Modify: `apps/web/lib/graphql/client.ts`**
- Create SSE link using `graphql-sse` `createClient` with `singleConnection: true`
- Use Apollo `split()`: subscriptions → SSE link, queries/mutations → HTTP link
- SSE endpoint: configurable via `NEXT_PUBLIC_GRAPHQL_SSE_URL` env var

### API-Side SSE Handler

**Modify: `apps/api/src/`**
- Add SSE transport endpoint using `graphql-sse` `createHandler` with existing schema + context
- The `worksheetUpdated` subscription already publishes on worksheet mutations
- Route: `/graphql/stream`

### Hook Changes

**Modify: `apps/web/lib/hooks/use-worksheet-collab.ts`**
- Replace raw WebSocket transport with Apollo `useSubscription` to `worksheetUpdated(worksheetId)`
- On SSE event: apply incoming cells using existing LWW logic (updatedAt comparison)
- BroadcastChannel stays as-is for same-device sync + presence
- Transport priority: BroadcastChannel (instant) → SSE (cross-device data)

### Trigger Flow

1. Client saves worksheet via `saveWorksheet` Server Action → DB write
2. GraphQL resolver publishes `worksheetUpdated` subscription event
3. Other devices subscribed via SSE receive the update
4. Their stores apply the changes via LWW

### Out of Scope

- Cross-device presence (deferred — BroadcastChannel handles same-device)
- Polling fallback (remains stub)
- CRDT/OT (LWW per cell stays)

---

## Unchanged

- `KnowledgeExplorer` component internals (just callback wiring)
- Worksheet cell components (math/text/plot rendering)
- BroadcastChannel transport and custom collab protocol
- GraphQL queries and mutations (existing)
- Collab UI components (collab-bar, share-dialog)
- All existing Prisma models except Favorite (polymorphic) and Worksheet (version field)
