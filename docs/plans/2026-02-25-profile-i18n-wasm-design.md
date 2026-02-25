# Profile Dashboard + i18n + WASM Build Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the corresponding plan task-by-task.

**Goal:** Add a full-analytics user profile dashboard, internationalize the app with 5 languages, and build the WASM math engine via Docker with Web Worker integration.

**Architecture:** GraphQL aggregation queries for profile data with Apollo client-side fetching. next-intl big-bang route restructure under `app/[locale]/`. Docker-based Emscripten build with Web Worker offloading for WASM computation.

**Tech Stack:** Apollo Client 4.2.0-alpha.0, next-intl 4.8.3, Emscripten SDK 3.1.51 (Docker), Web Workers

---

## Feature 10: User Profile Dashboard

### Approach

GraphQL aggregation with Apollo client-side fetching, consistent with the existing forum profile pattern. Auth-gated route at `/profile`.

### GraphQL Schema

New queries:
- `userProfile(userId: ID!): UserProfile!` — aggregated stats
- `userActivity(userId: ID!, days: Int = 365): [ActivityDay!]!` — contribution calendar
- `userAnalytics(userId: ID!): UserAnalytics!` — mastery, trends, history

Types:

```graphql
type UserProfile {
  user: User!
  progress: UserProgress!
  recentAchievements: [UserAchievement!]!
  worksheetCount: Int!
  forumPostCount: Int!
  calculationCount: Int!
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
  completedAt: String
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

### UI Layout

Tabs: Overview | Achievements | Analytics | Practice History

**Overview tab:**
- Avatar, name, bio, joined date
- Stat cards: level, XP, problems solved, streak, total points, worksheets count
- Activity calendar (GitHub-style SVG grid, 365 days)
- Recent achievements (last 5)

**Achievements tab:**
- Grid of earned badges with earned date
- Locked achievements with progress bars

**Analytics tab:**
- Topic mastery horizontal bar chart (0-100% per topic)
- Accuracy trend line chart over time
- Streak history chart

**Practice History tab:**
- Paginated table: topic, score, accuracy, time, date
- Filter by topic

### DataLoaders

New loaders:
- `achievementsByUserProgressId` — batch load user achievements
- `attemptsByUserProgressId` — batch load attempts for analytics

### Auth

Route `/profile` requires authentication. Redirect to `/api/auth/signin` if not signed in.

---

## Feature 11: i18n

### Approach

Big-bang route restructure: move all routes under `app/[locale]/` in one pass. Single `messages/{locale}.json` per language. next-intl with proxy.ts middleware.

### Languages

en (default), ru, es, uk, de

### Infrastructure

- `apps/web/i18n/routing.ts` — `defineRouting({ locales: ['en','ru','es','uk','de'], defaultLocale: 'en' })`
- `apps/web/i18n/request.ts` — `getRequestConfig()` loads `messages/{locale}.json`
- `apps/web/i18n/navigation.ts` — `createNavigation(routing)` exports: `Link`, `redirect`, `usePathname`, `useRouter`
- `apps/web/proxy.ts` — chain `createMiddleware(routing)` with existing auth/CSP logic
- `apps/web/messages/{en,ru,es,uk,de}.json` — flat namespace keys

### Route Restructure

- Root `app/layout.tsx` → thin shell (`<html>` with `lang` from params)
- `app/[locale]/layout.tsx` → wraps children in `NextIntlClientProvider`
- All page routes move under `app/[locale]/`
- `app/api/` stays where it is (not localized)

### String Extraction Scope

- Navigation (links, footer)
- Calculator (buttons, modes, history)
- All page titles, descriptions, headings, placeholders
- Error/loading/empty states
- Settings labels
- Forum UI chrome (not user content)
- Profile dashboard labels
- Learn/practice page chrome

### Language Switcher

Dropdown in navigation header. Persists locale choice to cookie. Redirects to same page in new locale.

### Translation

English extracted first as source. ru/es/uk/de get machine-translated placeholders initially, refinable later.

---

## Feature 12: WASM Native Build

### Approach

Docker-based Emscripten build for reproducibility. Web Worker offloading for non-blocking UI.

### Dockerfile

`packages/math-engine/Dockerfile.wasm`:
- Base: `emscripten/emsdk:3.1.51`
- Copies `src/wasm/native/mpfr_wrapper.cpp` and `wasm-build.sh`
- Runs `./wasm-build.sh release`
- Outputs `mpfr.js` + `mpfr.wasm` via BuildKit `--output`

### Build Script

`packages/math-engine/package.json`:
- `"wasm:build": "docker build -f Dockerfile.wasm -o ./src/wasm/compiled ."`
- Produces `src/wasm/compiled/mpfr.js` + `src/wasm/compiled/mpfr.wasm`

### Loader Wiring

- `loader.ts` MPFRWASMManager already has dynamic import of `./mpfr.js`
- Add `getHighPrecision()` that tries WASM first, falls back to mock
- Feature detection: `WebAssembly` available + `.wasm` fetch succeeds → WASM; otherwise → mock

### Web Worker

- `apps/web/lib/workers/math-worker.ts` — runs WASM inside a Web Worker
- Exposes `evaluate(expression, precision)` via postMessage/onmessage
- `apps/web/lib/hooks/use-math-worker.ts` — manages worker lifecycle, posts messages, returns results

### Static Assets

- `mpfr.wasm` → `apps/web/public/wasm/mpfr.wasm`
- `next.config.ts` headers: `Content-Type: application/wasm` for `/wasm/*`
- `src/wasm/compiled/` gitignored; `public/wasm/mpfr.wasm` committed as build artifact

---

## Unchanged

- Forum pages and forum user profiles
- Calculator core functionality
- Existing GraphQL queries/mutations/subscriptions
- BroadcastChannel collab transport
- Worksheet editor components
- All existing Prisma models
