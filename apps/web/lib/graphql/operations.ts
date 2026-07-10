/**
 * GraphQL Operation Documents
 *
 * All gql-tagged operations for the NextCalc Pro frontend.
 * Used with Apollo Client hooks (useQuery, useMutation, useSuspenseQuery).
 *
 * Operations match the GraphQL schema defined in apps/api/src/graphql/schema.ts.
 */

import { graphql } from '@/lib/graphql/generated';

// ============================================================================
// FRAGMENTS
// ============================================================================

/** Minimal author/profile summary reused across worksheet, forum, and calculation queries */
export const USER_SUMMARY_FRAGMENT = graphql(`
  fragment UserSummary on User {
    id
    name
    image
  }
`);

/** Same minimal shape for fields typed as PublicUser (e.g. shared calculations) */
export const PUBLIC_USER_SUMMARY_FRAGMENT = graphql(`
  fragment PublicUserSummary on PublicUser {
    id
    name
    image
  }
`);

// ============================================================================
// USER MUTATIONS
// ============================================================================

/** Update the authenticated user's profile (name, bio) */
export const UPDATE_PROFILE_MUTATION = graphql(`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      bio
      image
      updatedAt
    }
  }
`);

// ============================================================================
// USER QUERIES
// ============================================================================

/** Get the currently authenticated user's profile */
export const ME_QUERY = graphql(`
  query Me {
    me {
      ...UserSummary
      email
      bio
      role
      createdAt
      updatedAt
      worksheetCount
    }
  }
`);

/** Get a user by ID */
export const USER_QUERY = graphql(`
  query User($id: ID!) {
    user(id: $id) {
      id
      email
      name
      image
      bio
      role
      createdAt
      worksheetCount
    }
  }
`);

// ============================================================================
// WORKSHEET QUERIES
// ============================================================================

/** Get a single worksheet by ID */
export const WORKSHEET_QUERY = graphql(`
  query Worksheet($id: ID!) {
    worksheet(id: $id) {
      id
      title
      description
      content
      visibility
      views
      createdAt
      updatedAt
      user {
        ...UserSummary
      }
      folder {
        id
        name
      }
      shares {
        id
        sharedWith
        permission
      }
    }
  }
`);

/** Get paginated worksheets for the current user */
export const WORKSHEETS_QUERY = graphql(`
  query Worksheets(
    $limit: Int = 20
    $offset: Int = 0
    $visibility: WorksheetVisibility
    $userId: ID
    $folderId: ID
    $searchQuery: String
  ) {
    worksheets(
      limit: $limit
      offset: $offset
      visibility: $visibility
      userId: $userId
      folderId: $folderId
      searchQuery: $searchQuery
    ) {
      nodes {
        id
        title
        description
        visibility
        views
        createdAt
        updatedAt
        user {
          ...UserSummary
        }
        folder {
          id
          name
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        totalCount
        currentPage
        totalPages
      }
    }
  }
`);

/** Get public worksheets (gallery) */
export const PUBLIC_WORKSHEETS_QUERY = graphql(`
  query PublicWorksheets(
    $limit: Int = 20
    $offset: Int = 0
    $searchQuery: String
  ) {
    publicWorksheets(
      limit: $limit
      offset: $offset
      searchQuery: $searchQuery
    ) {
      nodes {
        id
        title
        description
        views
        createdAt
        user {
          ...UserSummary
        }
      }
      pageInfo {
        hasNextPage
        totalCount
        currentPage
        totalPages
      }
    }
  }
`);

// ============================================================================
// WORKSHEET MUTATIONS
// ============================================================================

/** Create a new worksheet */
export const CREATE_WORKSHEET_MUTATION = graphql(`
  mutation CreateWorksheet($input: CreateWorksheetInput!) {
    createWorksheet(input: $input) {
      id
      title
      description
      visibility
      createdAt
    }
  }
`);

/** Update an existing worksheet */
export const UPDATE_WORKSHEET_MUTATION = graphql(`
  mutation UpdateWorksheet($id: ID!, $input: UpdateWorksheetInput!) {
    updateWorksheet(id: $id, input: $input) {
      id
      title
      description
      content
      visibility
      updatedAt
    }
  }
`);

/** Delete a worksheet (soft delete) */
export const DELETE_WORKSHEET_MUTATION = graphql(`
  mutation DeleteWorksheet($id: ID!) {
    deleteWorksheet(id: $id)
  }
`);

// ============================================================================
// FOLDER QUERIES & MUTATIONS
// ============================================================================

/** Get user's folders */
export const FOLDERS_QUERY = graphql(`
  query Folders($userId: ID) {
    folders(userId: $userId) {
      id
      name
      description
      createdAt
      parent {
        id
        name
      }
      children {
        id
        name
      }
    }
  }
`);

/** Create a new folder */
export const CREATE_FOLDER_MUTATION = graphql(`
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
      id
      name
      description
    }
  }
`);

// ============================================================================
// CALCULATION QUERIES & MUTATIONS
// ============================================================================

/** Perform a server-side calculation */
export const CALCULATE_QUERY = graphql(`
  query Calculate($input: CalculationInput!) {
    calculate(input: $input) {
      input
      result
      formatted
      variables
      timestamp
    }
  }
`);

/** Get calculation history */
export const CALCULATION_HISTORY_QUERY = graphql(`
  query CalculationHistory($limit: Int = 50, $offset: Int = 0) {
    calculationHistory(limit: $limit, offset: $offset) {
      id
      userId
      expression
      result
      variables
      timestamp
    }
  }
`);

/** Save a calculation to history */
export const SAVE_CALCULATION_MUTATION = graphql(`
  mutation SaveCalculation($input: CalculationInput!) {
    saveCalculation(input: $input) {
      id
      expression
      result
      timestamp
    }
  }
`);

/** Clear calculation history */
export const CLEAR_CALCULATION_HISTORY_MUTATION = graphql(`
  mutation ClearCalculationHistory {
    clearCalculationHistory
  }
`);

// ============================================================================
// SHARED CALCULATION QUERIES & MUTATIONS
// ============================================================================

/** Share a calculation and receive a short code */
export const SHARE_CALCULATION_MUTATION = graphql(`
  mutation ShareCalculation(
    $latex: String!
    $expression: String!
    $title: String
    $description: String
    $result: String
  ) {
    shareCalculation(
      latex: $latex
      expression: $expression
      title: $title
      description: $description
      result: $result
    ) {
      id
      shortCode
      latex
      expression
      title
      description
      result
      createdAt
    }
  }
`);

/** Get a shared calculation by short code */
export const SHARED_CALCULATION_QUERY = graphql(`
  query SharedCalculation($shortCode: String!) {
    sharedCalculation(shortCode: $shortCode) {
      id
      shortCode
      latex
      expression
      title
      description
      result
      createdAt
      expiresAt
      user {
        ...PublicUserSummary
      }
    }
  }
`);

// ============================================================================
// DASHBOARD RECENT ACTIVITY QUERY
// ============================================================================

/**
 * Combined recent activity for the profile dashboard.
 * Fetches last 10 calculations and last 10 worksheets so the client
 * can merge and sort them into a unified feed.
 */
export const DASHBOARD_RECENT_ACTIVITY_QUERY = graphql(`
  query DashboardRecentActivity($userId: ID!) {
    calculationHistory(limit: 10, offset: 0) {
      id
      expression
      result
      timestamp
    }
    worksheets(limit: 10, offset: 0, userId: $userId) {
      nodes {
        id
        title
        description
        visibility
        updatedAt
        createdAt
      }
      pageInfo {
        totalCount
        currentPage
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`);

// ============================================================================
// HEALTH QUERY
// ============================================================================

/** System health check */
export const HEALTH_QUERY = graphql(`
  query Health {
    health {
      status
      timestamp
      database {
        status
        latency
        error
      }
      redis {
        status
        latency
        error
      }
      version
    }
  }
`);

// ============================================================================
// USER PROFILE & ANALYTICS QUERIES
// ============================================================================

/** Get a user's full profile dashboard data */
export const USER_PROFILE_QUERY = graphql(`
  query UserProfile($userId: ID!) {
    userProfile(userId: $userId) {
      user {
        id
        name
        image
        bio
        role
        createdAt
      }
      progress {
        id
        problemsSolved
        totalPoints
        streak
        longestStreak
        level
        experience
        lastActive
      }
      recentAchievements {
        id
        name
        description
        type
        icon
        points
        badgeUrl
        earnedAt
      }
      worksheetCount
      forumPostCount
      calculationCount
    }
  }
`);

/** Get a user's activity heatmap data */
export const USER_ACTIVITY_QUERY = graphql(`
  query UserActivity($userId: ID!, $days: Int) {
    userActivity(userId: $userId, days: $days) {
      date
      count
    }
  }
`);

/** Get a user's detailed analytics */
export const USER_ANALYTICS_QUERY = graphql(`
  query UserAnalytics($userId: ID!) {
    userAnalytics(userId: $userId) {
      topicMastery {
        topic
        mastery
        problemsSolved
      }
      accuracyTrend {
        date
        accuracy
      }
      practiceHistory {
        id
        topic
        score
        accuracy
        totalTime
        completedAt
      }
      streakHistory {
        date
        streak
      }
    }
  }
`);

/**
 * Worksheet realtime-sync operations (SSE subscription + polling fallback).
 * Typed documents so schema drift fails codegen/typecheck; the collab hook
 * serialises them with print() for its raw fetch / graphql-sse transports.
 */
export const WORKSHEET_SYNC_QUERY = graphql(`
  query WorksheetSync($worksheetId: ID!) {
    worksheet(id: $worksheetId) {
      id
      title
      content
      updatedAt
    }
  }
`);

export const WORKSHEET_UPDATED_SUBSCRIPTION = graphql(`
  subscription WorksheetUpdated($worksheetId: ID!) {
    worksheetUpdated(worksheetId: $worksheetId) {
      id
      title
      content
      version
      updatedAt
    }
  }
`);
