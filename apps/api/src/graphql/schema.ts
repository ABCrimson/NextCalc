/**
 * GraphQL Schema Definition
 *
 * Complete type-safe GraphQL schema for NextCalc Pro.
 * Implements best practices:
 * - Clear type definitions with descriptions
 * - Proper error handling types
 * - Input validation types
 * - Pagination support
 * - Subscription support for real-time features
 *
 * @see https://www.apollographql.com/docs/apollo-server/schema/schema
 */

import { gql } from 'graphql-tag';

export const typeDefs = gql`
  """
  ISO 8601 date-time string
  """
  scalar DateTime

  """
  Arbitrary JSON value
  """
  scalar JSON

  # ============================================================================
  # USER TYPES
  # ============================================================================

  """
  User role determining access permissions
  """
  enum UserRole {
    USER
    MODERATOR
    ADMIN
  }

  """
  User account information
  """
  type User {
    id: ID!
    email: String!
    name: String
    image: String
    bio: String
    role: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!

    "User's worksheets"
    worksheets(
      limit: Int = 20
      offset: Int = 0
      visibility: WorksheetVisibility
    ): [Worksheet!]!

    "User's folders"
    folders: [Folder!]!

    "Total worksheet count"
    worksheetCount: Int!

    "User's forum posts"
    forumPosts(limit: Int = 20, offset: Int = 0): [ForumPost!]!
  }

  """
  Public user information (for sharing features)
  """
  type PublicUser {
    id: ID!
    name: String
    image: String
  }

  # ============================================================================
  # PROFILE & ANALYTICS TYPES
  # ============================================================================

  """
  Full user profile with aggregated stats
  """
  type UserProfile {
    user: User!
    progress: UserProgress
    recentAchievements: [UserAchievement!]!
    worksheetCount: Int!
    forumPostCount: Int!
    calculationCount: Int!
  }

  """
  User learning progress and streak data
  """
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

  """
  Achievement earned by a user
  """
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

  """
  Single day of user activity (for heatmap)
  """
  type ActivityDay {
    date: String!
    count: Int!
  }

  """
  Topic mastery entry for analytics
  """
  type TopicMasteryEntry {
    topic: String!
    mastery: Float!
    problemsSolved: Int!
  }

  """
  Accuracy data point over time
  """
  type AccuracyPoint {
    date: String!
    accuracy: Float!
  }

  """
  Summary of a practice session
  """
  type PracticeSessionSummary {
    id: ID!
    topic: String!
    score: Int!
    accuracy: Float!
    totalTime: Int!
    completedAt: DateTime
  }

  """
  Streak data point over time
  """
  type StreakPoint {
    date: String!
    streak: Int!
  }

  """
  Aggregated user analytics data
  """
  type UserAnalytics {
    topicMastery: [TopicMasteryEntry!]!
    accuracyTrend: [AccuracyPoint!]!
    practiceHistory: [PracticeSessionSummary!]!
    streakHistory: [StreakPoint!]!
  }

  # ============================================================================
  # WORKSHEET TYPES
  # ============================================================================

  """
  Worksheet visibility level
  """
  enum WorksheetVisibility {
    PRIVATE
    UNLISTED
    PUBLIC
  }

  """
  Worksheet sharing permission level
  """
  enum SharePermission {
    VIEW
    EDIT
  }

  """
  Cell types supported in worksheets
  """
  enum CellType {
    CALCULATION
    TEXT
    HEADING
    IMAGE
    PLOT
  }

  """
  Individual cell in a worksheet
  """
  type WorksheetCell {
    id: ID!
    type: CellType!
    content: String!
    result: String
    metadata: JSON
  }

  """
  Complete worksheet with cells
  """
  type Worksheet {
    id: ID!
    title: String!
    description: String
    content: JSON!
    visibility: WorksheetVisibility!
    views: Int!
    createdAt: DateTime!
    updatedAt: DateTime!

    "Worksheet owner"
    user: User!

    "Folder containing this worksheet"
    folder: Folder

    "Users this worksheet is shared with"
    shares: [WorksheetShare!]!
  }

  """
  Worksheet sharing information
  """
  type WorksheetShare {
    id: ID!
    sharedWith: String!
    permission: SharePermission!
    createdAt: DateTime!
    worksheet: Worksheet!
  }

  """
  Folder for organizing worksheets
  """
  type Folder {
    id: ID!
    name: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!

    "Folder owner"
    user: User!

    "Parent folder (null for root)"
    parent: Folder

    "Child folders"
    children: [Folder!]!

    "Worksheets in this folder"
    worksheets: [Worksheet!]!
  }

  # ============================================================================
  # FORUM TYPES
  # ============================================================================

  """
  Forum post in the community
  """
  type ForumPost {
    id: ID!
    title: String!
    content: String!
    tags: [String!]!
    views: Int!
    isPinned: Boolean!
    isClosed: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!

    "Post author"
    user: User!

    "Post comments"
    comments(limit: Int = 20, offset: Int = 0): [Comment!]!

    "Number of upvotes"
    upvoteCount: Int!

    "Whether the current user has upvoted"
    hasUpvoted: Boolean!
  }

  """
  Comment on a forum post
  """
  type Comment {
    id: ID!
    content: String!
    createdAt: DateTime!
    updatedAt: DateTime!

    "Comment author"
    user: User!

    "Parent post"
    post: ForumPost!

    "Parent comment (for replies)"
    parent: Comment

    "Replies to this comment"
    replies: [Comment!]!

    "Number of upvotes"
    upvoteCount: Int!

    "Whether the current user has upvoted"
    hasUpvoted: Boolean!
  }

  """
  Paginated forum post list
  """
  type ForumPostConnection {
    nodes: [ForumPost!]!
    pageInfo: PageInfo!
  }

  # ============================================================================
  # PAGINATION TYPES
  # ============================================================================

  """
  Pagination information
  """
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  """
  Paginated worksheet list
  """
  type WorksheetConnection {
    nodes: [Worksheet!]!
    pageInfo: PageInfo!
  }

  # ============================================================================
  # INPUT TYPES
  # ============================================================================

  """
  Input for creating a new worksheet
  """
  input CreateWorksheetInput {
    title: String!
    description: String
    content: JSON!
    visibility: WorksheetVisibility = PRIVATE
    folderId: ID
  }

  """
  Input for updating a worksheet
  """
  input UpdateWorksheetInput {
    title: String
    description: String
    content: JSON
    visibility: WorksheetVisibility
    folderId: ID
  }

  """
  Input for sharing a worksheet
  """
  input ShareWorksheetInput {
    worksheetId: ID!
    sharedWith: String!
    permission: SharePermission = VIEW
  }

  """
  Input for creating a folder
  """
  input CreateFolderInput {
    name: String!
    description: String
    parentId: ID
  }

  """
  Input for updating a folder
  """
  input UpdateFolderInput {
    name: String
    description: String
    parentId: ID
  }

  """
  Input for creating a forum post
  """
  input CreateForumPostInput {
    title: String!
    content: String!
    tags: [String!]!
  }

  """
  Input for updating a forum post
  """
  input UpdateForumPostInput {
    title: String
    content: String
    tags: [String!]
  }

  """
  Input for creating a comment
  """
  input CreateCommentInput {
    postId: ID!
    content: String!
    parentId: ID
  }

  """
  Input for updating a comment
  """
  input UpdateCommentInput {
    content: String!
  }

  """
  Input for calculation operations
  """
  input CalculationInput {
    expression: String!
    variables: JSON
    precision: Int = 16
    "Calculator mode: approximate, exact, or scientific (used when persisting to history)"
    mode: String
    "Optional LaTeX representation of the expression"
    latex: String
  }

  # ============================================================================
  # CALCULATION TYPES
  # ============================================================================

  """
  Result of a calculation operation
  """
  type CalculationResult {
    input: String!
    result: String!
    formatted: String!
    variables: JSON
    timestamp: DateTime!
  }

  """
  Calculation history entry
  """
  type CalculationHistory {
    id: ID!
    userId: ID!
    expression: String!
    result: String!
    variables: JSON
    timestamp: DateTime!
  }

  # ============================================================================
  # UPVOTE TYPES
  # ============================================================================

  """
  Target type for upvotes
  """
  enum UpvoteTargetType {
    POST
    COMMENT
  }

  """
  Result of an upvote toggle
  """
  type UpvoteResult {
    "Whether the item is now upvoted"
    upvoted: Boolean!
    "New total upvote count"
    upvoteCount: Int!
  }

  # ============================================================================
  # ERROR TYPES
  # ============================================================================

  """
  Error codes for structured error handling
  """
  enum ErrorCode {
    UNAUTHORIZED
    FORBIDDEN
    NOT_FOUND
    VALIDATION_ERROR
    INTERNAL_ERROR
    RATE_LIMIT_EXCEEDED
  }

  """
  Structured error response
  """
  type Error {
    code: ErrorCode!
    message: String!
    field: String
  }

  # ============================================================================
  # QUERIES
  # ============================================================================

  type Query {
    """
    Get currently authenticated user
    """
    me: User

    """
    Get user by ID
    """
    user(id: ID!): User

    """
    Get worksheet by ID
    """
    worksheet(id: ID!): Worksheet

    """
    Get paginated list of worksheets
    """
    worksheets(
      limit: Int = 20
      offset: Int = 0
      visibility: WorksheetVisibility
      userId: ID
      folderId: ID
      searchQuery: String
    ): WorksheetConnection!

    """
    Get public worksheets (gallery)
    """
    publicWorksheets(
      limit: Int = 20
      offset: Int = 0
      searchQuery: String
    ): WorksheetConnection!

    """
    Get folder by ID
    """
    folder(id: ID!): Folder

    """
    Get user's folders
    """
    folders(userId: ID): [Folder!]!

    """
    Get forum post by ID
    """
    forumPost(id: ID!): ForumPost

    """
    Get paginated forum posts
    """
    forumPosts(
      limit: Int = 20
      offset: Int = 0
      tags: [String!]
      searchQuery: String
    ): ForumPostConnection!

    """
    Get comments for a post
    """
    comments(
      postId: ID!
      limit: Int = 20
      offset: Int = 0
    ): [Comment!]!

    """
    Perform a calculation
    """
    calculate(input: CalculationInput!): CalculationResult!

    """
    Get calculation history
    """
    calculationHistory(
      limit: Int = 50
      offset: Int = 0
    ): [CalculationHistory!]!

    """
    Get full user profile with stats
    """
    userProfile(userId: ID!): UserProfile

    """
    Get user activity data for heatmap
    """
    userActivity(userId: ID!, days: Int = 365): [ActivityDay!]!

    """
    Get user analytics (mastery, accuracy, practice history)
    """
    userAnalytics(userId: ID!): UserAnalytics

    """
    Health check endpoint
    """
    health: HealthStatus!
  }

  # ============================================================================
  # MUTATIONS
  # ============================================================================

  type Mutation {
    """
    Create a new worksheet
    """
    createWorksheet(input: CreateWorksheetInput!): Worksheet!

    """
    Update an existing worksheet
    """
    updateWorksheet(id: ID!, input: UpdateWorksheetInput!): Worksheet!

    """
    Delete a worksheet (soft delete)
    """
    deleteWorksheet(id: ID!): Boolean!

    """
    Share a worksheet with another user
    """
    shareWorksheet(input: ShareWorksheetInput!): WorksheetShare!

    """
    Remove worksheet share
    """
    unshareWorksheet(worksheetId: ID!, shareId: ID!): Boolean!

    """
    Create a new folder
    """
    createFolder(input: CreateFolderInput!): Folder!

    """
    Update a folder
    """
    updateFolder(id: ID!, input: UpdateFolderInput!): Folder!

    """
    Delete a folder
    """
    deleteFolder(id: ID!): Boolean!

    """
    Create a forum post
    """
    createForumPost(input: CreateForumPostInput!): ForumPost!

    """
    Update a forum post
    """
    updateForumPost(id: ID!, input: UpdateForumPostInput!): ForumPost!

    """
    Delete a forum post (soft delete)
    """
    deleteForumPost(id: ID!): Boolean!

    """
    Create a comment
    """
    createComment(input: CreateCommentInput!): Comment!

    """
    Update a comment
    """
    updateComment(id: ID!, input: UpdateCommentInput!): Comment!

    """
    Delete a comment (soft delete)
    """
    deleteComment(id: ID!): Boolean!

    """
    Toggle upvote on a post or comment
    """
    toggleUpvote(targetId: ID!, targetType: UpvoteTargetType!): UpvoteResult!

    """
    Save calculation to history
    """
    saveCalculation(input: CalculationInput!): CalculationHistory!

    """
    Clear calculation history
    """
    clearCalculationHistory: Boolean!

    """
    Increment worksheet view count
    """
    incrementWorksheetViews(id: ID!): Boolean!
  }

  # ============================================================================
  # SUBSCRIPTIONS
  # ============================================================================

  type Subscription {
    """
    Subscribe to worksheet changes for real-time collaboration
    """
    worksheetUpdated(worksheetId: ID!): Worksheet!

    """
    Subscribe to user's worksheet list changes
    """
    userWorksheetsChanged(userId: ID!): [Worksheet!]!
  }

  # ============================================================================
  # UTILITY TYPES
  # ============================================================================

  """
  System health status
  """
  type HealthStatus {
    status: String!
    timestamp: DateTime!
    database: ServiceStatus!
    redis: ServiceStatus!
    version: String!
  }

  """
  Service health status
  """
  type ServiceStatus {
    status: String!
    latency: Int
    error: String
  }
`;
