/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** ISO 8601 date-time string */
  DateTime: { input: string; output: string; }
  /** Arbitrary JSON value */
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

/** Accuracy data point over time */
export type AccuracyPoint = {
  __typename?: 'AccuracyPoint';
  accuracy: Scalars['Float']['output'];
  date: Scalars['String']['output'];
};

/** Single day of user activity (for heatmap) */
export type ActivityDay = {
  __typename?: 'ActivityDay';
  count: Scalars['Int']['output'];
  date: Scalars['String']['output'];
};

/** Calculation history entry */
export type CalculationHistory = {
  __typename?: 'CalculationHistory';
  expression: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  result: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
  variables: Maybe<Scalars['JSON']['output']>;
};

/** Cursor-paginated calculation history list */
export type CalculationHistoryCursorConnection = {
  __typename?: 'CalculationHistoryCursorConnection';
  edges: Array<CalculationHistoryEdge>;
  pageInfo: CursorPageInfo;
  totalCount: Scalars['Int']['output'];
};

/** A calculation history edge in a cursor-paginated connection */
export type CalculationHistoryEdge = {
  __typename?: 'CalculationHistoryEdge';
  cursor: Scalars['String']['output'];
  node: CalculationHistory;
};

/** Input for calculation operations */
export type CalculationInput = {
  expression: Scalars['String']['input'];
  /** Optional LaTeX representation of the expression */
  latex?: InputMaybe<Scalars['String']['input']>;
  /** Calculator mode: approximate, exact, or scientific (used when persisting to history) */
  mode?: InputMaybe<Scalars['String']['input']>;
  precision?: InputMaybe<Scalars['Int']['input']>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
};

/** Result of a calculation operation */
export type CalculationResult = {
  __typename?: 'CalculationResult';
  formatted: Scalars['String']['output'];
  input: Scalars['String']['output'];
  result: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  variables: Maybe<Scalars['JSON']['output']>;
};

/** Cell types supported in worksheets */
export type CellType =
  | 'CALCULATION'
  | 'HEADING'
  | 'IMAGE'
  | 'PLOT'
  | 'TEXT';

/** Comment on a forum post */
export type Comment = {
  __typename?: 'Comment';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Whether the current user has upvoted */
  hasUpvoted: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  /** Parent comment (for replies) */
  parent: Maybe<Comment>;
  /** Parent post */
  post: ForumPost;
  /** Replies to this comment */
  replies: Array<Comment>;
  updatedAt: Scalars['DateTime']['output'];
  /** Number of upvotes */
  upvoteCount: Scalars['Int']['output'];
  /** Comment author */
  user: User;
};

/** Input for creating a comment */
export type CreateCommentInput = {
  content: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
  postId: Scalars['ID']['input'];
};

/** Input for creating a folder */
export type CreateFolderInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

/** Input for creating a forum post */
export type CreateForumPostInput = {
  content: Scalars['String']['input'];
  tags: Array<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

/** Input for creating a new worksheet */
export type CreateWorksheetInput = {
  content: Scalars['JSON']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  folderId?: InputMaybe<Scalars['ID']['input']>;
  title: Scalars['String']['input'];
  visibility?: InputMaybe<WorksheetVisibility>;
};

/** Cursor-based pagination information following the Relay specification */
export type CursorPageInfo = {
  __typename?: 'CursorPageInfo';
  /** Cursor of the last edge in the current page */
  endCursor: Maybe<Scalars['String']['output']>;
  /** Whether there are more items after the last edge */
  hasNextPage: Scalars['Boolean']['output'];
  /** Whether there are more items before the first edge */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** Cursor of the first edge in the current page */
  startCursor: Maybe<Scalars['String']['output']>;
};

/** Structured error response */
export type Error = {
  __typename?: 'Error';
  code: ErrorCode;
  field: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
};

/** Error codes for structured error handling */
export type ErrorCode =
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR';

/** Folder for organizing worksheets */
export type Folder = {
  __typename?: 'Folder';
  /** Child folders */
  children: Array<Folder>;
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  /** Parent folder (null for root) */
  parent: Maybe<Folder>;
  updatedAt: Scalars['DateTime']['output'];
  /** Folder owner */
  user: User;
  /** Worksheets in this folder */
  worksheets: Array<Worksheet>;
};

/** Cursor-paginated folder list */
export type FolderCursorConnection = {
  __typename?: 'FolderCursorConnection';
  edges: Array<FolderEdge>;
  pageInfo: CursorPageInfo;
  totalCount: Scalars['Int']['output'];
};

/** A folder edge in a cursor-paginated connection */
export type FolderEdge = {
  __typename?: 'FolderEdge';
  cursor: Scalars['String']['output'];
  node: Folder;
};

/** Forum post in the community */
export type ForumPost = {
  __typename?: 'ForumPost';
  /** Total number of comments (including replies) */
  commentCount: Scalars['Int']['output'];
  /** Post comments */
  comments: Array<Comment>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Whether the current user has upvoted */
  hasUpvoted: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isClosed: Scalars['Boolean']['output'];
  isPinned: Scalars['Boolean']['output'];
  tags: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  /** Number of upvotes */
  upvoteCount: Scalars['Int']['output'];
  /** Post author */
  user: User;
  views: Scalars['Int']['output'];
};


/** Forum post in the community */
export type ForumPostCommentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

/** Paginated forum post list */
export type ForumPostConnection = {
  __typename?: 'ForumPostConnection';
  nodes: Array<ForumPost>;
  pageInfo: PageInfo;
};

/** Cursor-paginated forum post list */
export type ForumPostCursorConnection = {
  __typename?: 'ForumPostCursorConnection';
  edges: Array<ForumPostEdge>;
  pageInfo: CursorPageInfo;
  totalCount: Scalars['Int']['output'];
};

/** A forum post edge in a cursor-paginated connection */
export type ForumPostEdge = {
  __typename?: 'ForumPostEdge';
  cursor: Scalars['String']['output'];
  node: ForumPost;
};

/** System health status */
export type HealthStatus = {
  __typename?: 'HealthStatus';
  database: ServiceStatus;
  redis: ServiceStatus;
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Clear calculation history */
  clearCalculationHistory: Scalars['Boolean']['output'];
  /** Create a comment */
  createComment: Comment;
  /** Create a new folder */
  createFolder: Folder;
  /** Create a forum post */
  createForumPost: ForumPost;
  /** Create a new worksheet */
  createWorksheet: Worksheet;
  /** Delete a comment (soft delete) */
  deleteComment: Scalars['Boolean']['output'];
  /** Delete a folder */
  deleteFolder: Scalars['Boolean']['output'];
  /** Delete a forum post (soft delete) */
  deleteForumPost: Scalars['Boolean']['output'];
  /** Delete a worksheet (soft delete) */
  deleteWorksheet: Scalars['Boolean']['output'];
  /** Increment worksheet view count */
  incrementWorksheetViews: Scalars['Boolean']['output'];
  /** Save calculation to history */
  saveCalculation: CalculationHistory;
  /**
   * Share a calculation and receive a short link code.
   * Does not require authentication -- anonymous shares are allowed.
   */
  shareCalculation: SharedCalculation;
  /** Share a worksheet with another user */
  shareWorksheet: WorksheetShare;
  /** Toggle upvote on a post or comment */
  toggleUpvote: UpvoteResult;
  /** Remove worksheet share */
  unshareWorksheet: Scalars['Boolean']['output'];
  /** Update a comment */
  updateComment: Comment;
  /** Update a folder */
  updateFolder: Folder;
  /** Update a forum post */
  updateForumPost: ForumPost;
  /** Update the authenticated user's profile (name, bio) */
  updateProfile: User;
  /** Update an existing worksheet */
  updateWorksheet: Worksheet;
};


export type MutationCreateCommentArgs = {
  input: CreateCommentInput;
};


export type MutationCreateFolderArgs = {
  input: CreateFolderInput;
};


export type MutationCreateForumPostArgs = {
  input: CreateForumPostInput;
};


export type MutationCreateWorksheetArgs = {
  input: CreateWorksheetInput;
};


export type MutationDeleteCommentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFolderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteForumPostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteWorksheetArgs = {
  id: Scalars['ID']['input'];
};


export type MutationIncrementWorksheetViewsArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSaveCalculationArgs = {
  input: CalculationInput;
};


export type MutationShareCalculationArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  expression: Scalars['String']['input'];
  latex: Scalars['String']['input'];
  result?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};


export type MutationShareWorksheetArgs = {
  input: ShareWorksheetInput;
};


export type MutationToggleUpvoteArgs = {
  targetId: Scalars['ID']['input'];
  targetType: UpvoteTargetType;
};


export type MutationUnshareWorksheetArgs = {
  shareId: Scalars['ID']['input'];
  worksheetId: Scalars['ID']['input'];
};


export type MutationUpdateCommentArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCommentInput;
};


export type MutationUpdateFolderArgs = {
  id: Scalars['ID']['input'];
  input: UpdateFolderInput;
};


export type MutationUpdateForumPostArgs = {
  id: Scalars['ID']['input'];
  input: UpdateForumPostInput;
};


export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};


export type MutationUpdateWorksheetArgs = {
  id: Scalars['ID']['input'];
  input: UpdateWorksheetInput;
};

/** Offset-based pagination information (legacy) */
export type PageInfo = {
  __typename?: 'PageInfo';
  currentPage: Scalars['Int']['output'];
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

/** Summary of a practice session */
export type PracticeSessionSummary = {
  __typename?: 'PracticeSessionSummary';
  accuracy: Scalars['Float']['output'];
  completedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  score: Scalars['Int']['output'];
  topic: Scalars['String']['output'];
  totalTime: Scalars['Int']['output'];
};

/** Public user information (for sharing features) */
export type PublicUser = {
  __typename?: 'PublicUser';
  id: Scalars['ID']['output'];
  image: Maybe<Scalars['String']['output']>;
  name: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  /** Perform a calculation */
  calculate: CalculationResult;
  /** Get calculation history */
  calculationHistory: Array<CalculationHistory>;
  /** Get cursor-paginated calculation history */
  calculationHistoryConnection: CalculationHistoryCursorConnection;
  /** Get comments for a post */
  comments: Array<Comment>;
  /** Get folder by ID */
  folder: Maybe<Folder>;
  /** Get user's folders */
  folders: Array<Folder>;
  /** Get cursor-paginated folders */
  foldersConnection: FolderCursorConnection;
  /** Get forum post by ID */
  forumPost: Maybe<ForumPost>;
  /** Get paginated forum posts */
  forumPosts: ForumPostConnection;
  /** Get cursor-paginated forum posts */
  forumPostsConnection: ForumPostCursorConnection;
  /** Health check endpoint */
  health: HealthStatus;
  /** Get currently authenticated user */
  me: Maybe<User>;
  /** Get public worksheets (gallery) */
  publicWorksheets: WorksheetConnection;
  /** Get cursor-paginated public worksheets (gallery) */
  publicWorksheetsConnection: WorksheetCursorConnection;
  /** Get a shared calculation by its short code */
  sharedCalculation: Maybe<SharedCalculation>;
  /** Get user by ID */
  user: Maybe<User>;
  /** Get user activity data for heatmap */
  userActivity: Array<ActivityDay>;
  /** Get user analytics (mastery, accuracy, practice history) */
  userAnalytics: Maybe<UserAnalytics>;
  /** Get full user profile with stats */
  userProfile: Maybe<UserProfile>;
  /** Get worksheet by ID */
  worksheet: Maybe<Worksheet>;
  /** Get paginated list of worksheets */
  worksheets: WorksheetConnection;
  /** Get cursor-paginated worksheets with filtering */
  worksheetsConnection: WorksheetCursorConnection;
};


export type QueryCalculateArgs = {
  input: CalculationInput;
};


export type QueryCalculationHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCalculationHistoryConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCommentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  postId: Scalars['ID']['input'];
};


export type QueryFolderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryFoldersArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryFoldersConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryForumPostArgs = {
  id: Scalars['ID']['input'];
};


export type QueryForumPostsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type QueryForumPostsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type QueryPublicWorksheetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPublicWorksheetsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySharedCalculationArgs = {
  shortCode: Scalars['String']['input'];
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserActivityArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryUserAnalyticsArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryUserProfileArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryWorksheetArgs = {
  id: Scalars['ID']['input'];
};


export type QueryWorksheetsArgs = {
  folderId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  visibility?: InputMaybe<WorksheetVisibility>;
};


export type QueryWorksheetsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  folderId?: InputMaybe<Scalars['ID']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  visibility?: InputMaybe<WorksheetVisibility>;
};

/** Service health status */
export type ServiceStatus = {
  __typename?: 'ServiceStatus';
  error: Maybe<Scalars['String']['output']>;
  latency: Maybe<Scalars['Int']['output']>;
  status: Scalars['String']['output'];
};

/** Worksheet sharing permission level */
export type SharePermission =
  | 'EDIT'
  | 'VIEW';

/** Input for sharing a worksheet */
export type ShareWorksheetInput = {
  permission?: InputMaybe<SharePermission>;
  sharedWith: Scalars['String']['input'];
  worksheetId: Scalars['ID']['input'];
};

/** A publicly shared calculation with a short URL code */
export type SharedCalculation = {
  __typename?: 'SharedCalculation';
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  expression: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  latex: Scalars['String']['output'];
  result: Maybe<Scalars['String']['output']>;
  shortCode: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  user: Maybe<PublicUser>;
};

/** Streak data point over time */
export type StreakPoint = {
  __typename?: 'StreakPoint';
  date: Scalars['String']['output'];
  streak: Scalars['Int']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  /** Subscribe to user's worksheet list changes */
  userWorksheetsChanged: Array<Worksheet>;
  /** Subscribe to worksheet changes for real-time collaboration */
  worksheetUpdated: Worksheet;
};


export type SubscriptionUserWorksheetsChangedArgs = {
  userId: Scalars['ID']['input'];
};


export type SubscriptionWorksheetUpdatedArgs = {
  worksheetId: Scalars['ID']['input'];
};

/** Topic mastery entry for analytics */
export type TopicMasteryEntry = {
  __typename?: 'TopicMasteryEntry';
  mastery: Scalars['Float']['output'];
  problemsSolved: Scalars['Int']['output'];
  topic: Scalars['String']['output'];
};

/** Input for updating a comment */
export type UpdateCommentInput = {
  content: Scalars['String']['input'];
};

/** Input for updating a folder */
export type UpdateFolderInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

/** Input for updating a forum post */
export type UpdateForumPostInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  title?: InputMaybe<Scalars['String']['input']>;
};

/** Input for updating user profile information */
export type UpdateProfileInput = {
  bio?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Input for updating a worksheet */
export type UpdateWorksheetInput = {
  content?: InputMaybe<Scalars['JSON']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  folderId?: InputMaybe<Scalars['ID']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<WorksheetVisibility>;
};

/** Result of an upvote toggle */
export type UpvoteResult = {
  __typename?: 'UpvoteResult';
  /** New total upvote count */
  upvoteCount: Scalars['Int']['output'];
  /** Whether the item is now upvoted */
  upvoted: Scalars['Boolean']['output'];
};

/** Target type for upvotes */
export type UpvoteTargetType =
  | 'COMMENT'
  | 'POST';

/** User account information */
export type User = {
  __typename?: 'User';
  bio: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  /** User's folders */
  folders: Array<Folder>;
  /** User's forum posts */
  forumPosts: Array<ForumPost>;
  id: Scalars['ID']['output'];
  image: Maybe<Scalars['String']['output']>;
  name: Maybe<Scalars['String']['output']>;
  role: UserRole;
  updatedAt: Scalars['DateTime']['output'];
  /** Total worksheet count */
  worksheetCount: Scalars['Int']['output'];
  /** User's worksheets */
  worksheets: Array<Worksheet>;
};


/** User account information */
export type UserForumPostsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** User account information */
export type UserWorksheetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  visibility?: InputMaybe<WorksheetVisibility>;
};

/** Achievement earned by a user */
export type UserAchievement = {
  __typename?: 'UserAchievement';
  badgeUrl: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  earnedAt: Scalars['DateTime']['output'];
  icon: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  points: Scalars['Int']['output'];
  type: Scalars['String']['output'];
};

/** Aggregated user analytics data */
export type UserAnalytics = {
  __typename?: 'UserAnalytics';
  accuracyTrend: Array<AccuracyPoint>;
  practiceHistory: Array<PracticeSessionSummary>;
  streakHistory: Array<StreakPoint>;
  topicMastery: Array<TopicMasteryEntry>;
};

/** Full user profile with aggregated stats */
export type UserProfile = {
  __typename?: 'UserProfile';
  calculationCount: Scalars['Int']['output'];
  forumPostCount: Scalars['Int']['output'];
  progress: Maybe<UserProgress>;
  recentAchievements: Array<UserAchievement>;
  user: User;
  worksheetCount: Scalars['Int']['output'];
};

/** User learning progress and streak data */
export type UserProgress = {
  __typename?: 'UserProgress';
  experience: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lastActive: Maybe<Scalars['DateTime']['output']>;
  level: Scalars['Int']['output'];
  longestStreak: Scalars['Int']['output'];
  problemsSolved: Scalars['Int']['output'];
  streak: Scalars['Int']['output'];
  totalPoints: Scalars['Int']['output'];
};

/** User role determining access permissions */
export type UserRole =
  | 'ADMIN'
  | 'MODERATOR'
  | 'USER';

/** Complete worksheet with cells */
export type Worksheet = {
  __typename?: 'Worksheet';
  content: Scalars['JSON']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  /** Folder containing this worksheet */
  folder: Maybe<Folder>;
  id: Scalars['ID']['output'];
  /** Users this worksheet is shared with */
  shares: Array<WorksheetShare>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  /** Worksheet owner */
  user: User;
  views: Scalars['Int']['output'];
  visibility: WorksheetVisibility;
};

/** Individual cell in a worksheet */
export type WorksheetCell = {
  __typename?: 'WorksheetCell';
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
  result: Maybe<Scalars['String']['output']>;
  type: CellType;
};

/** Offset-paginated worksheet list (legacy) */
export type WorksheetConnection = {
  __typename?: 'WorksheetConnection';
  nodes: Array<Worksheet>;
  pageInfo: PageInfo;
};

/** Cursor-paginated worksheet list */
export type WorksheetCursorConnection = {
  __typename?: 'WorksheetCursorConnection';
  edges: Array<WorksheetEdge>;
  pageInfo: CursorPageInfo;
  totalCount: Scalars['Int']['output'];
};

/** A worksheet edge in a cursor-paginated connection */
export type WorksheetEdge = {
  __typename?: 'WorksheetEdge';
  cursor: Scalars['String']['output'];
  node: Worksheet;
};

/** Worksheet sharing information */
export type WorksheetShare = {
  __typename?: 'WorksheetShare';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  permission: SharePermission;
  sharedWith: Scalars['String']['output'];
  worksheet: Worksheet;
};

/** Worksheet visibility level */
export type WorksheetVisibility =
  | 'PRIVATE'
  | 'PUBLIC'
  | 'UNLISTED';

export type ForumPostsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
}>;


export type ForumPostsQuery = { __typename?: 'Query', forumPosts: { __typename?: 'ForumPostConnection', nodes: Array<{ __typename?: 'ForumPost', id: string, title: string, content: string, tags: Array<string>, views: number, isPinned: boolean, isClosed: boolean, createdAt: string, upvoteCount: number, hasUpvoted: boolean, commentCount: number, user: { __typename?: 'User', id: string, name: string | null, image: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, totalCount: number, currentPage: number, totalPages: number } } };

export type ForumPostQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ForumPostQuery = { __typename?: 'Query', forumPost: { __typename?: 'ForumPost', id: string, title: string, content: string, tags: Array<string>, views: number, isPinned: boolean, isClosed: boolean, createdAt: string, updatedAt: string, commentCount: number, upvoteCount: number, hasUpvoted: boolean, user: { __typename?: 'User', id: string, name: string | null, image: string | null, bio: string | null, role: UserRole, createdAt: string }, comments: Array<{ __typename?: 'Comment', id: string, content: string, createdAt: string, upvoteCount: number, hasUpvoted: boolean, user: { __typename?: 'User', id: string, name: string | null, image: string | null }, parent: { __typename?: 'Comment', id: string } | null, replies: Array<{ __typename?: 'Comment', id: string, content: string, createdAt: string, upvoteCount: number, hasUpvoted: boolean, user: { __typename?: 'User', id: string, name: string | null, image: string | null } }> }> } | null };

export type ForumUserProfileQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ForumUserProfileQuery = { __typename?: 'Query', user: { __typename?: 'User', id: string, name: string | null, image: string | null, bio: string | null, role: UserRole, createdAt: string, worksheetCount: number, forumPosts: Array<{ __typename?: 'ForumPost', id: string, title: string, tags: Array<string>, createdAt: string, upvoteCount: number, views: number }> } | null };

export type CreateForumPostMutationVariables = Exact<{
  input: CreateForumPostInput;
}>;


export type CreateForumPostMutation = { __typename?: 'Mutation', createForumPost: { __typename?: 'ForumPost', id: string, title: string, content: string, tags: Array<string>, views: number, isPinned: boolean, isClosed: boolean, createdAt: string, upvoteCount: number, hasUpvoted: boolean, user: { __typename?: 'User', id: string, name: string | null, image: string | null } } };

export type UpdateForumPostMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateForumPostInput;
}>;


export type UpdateForumPostMutation = { __typename?: 'Mutation', updateForumPost: { __typename?: 'ForumPost', id: string, title: string, content: string, tags: Array<string>, updatedAt: string } };

export type DeleteForumPostMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteForumPostMutation = { __typename?: 'Mutation', deleteForumPost: boolean };

export type ToggleUpvoteMutationVariables = Exact<{
  targetId: Scalars['ID']['input'];
  targetType: UpvoteTargetType;
}>;


export type ToggleUpvoteMutation = { __typename?: 'Mutation', toggleUpvote: { __typename?: 'UpvoteResult', upvoted: boolean, upvoteCount: number } };

export type CreateCommentMutationVariables = Exact<{
  input: CreateCommentInput;
}>;


export type CreateCommentMutation = { __typename?: 'Mutation', createComment: { __typename?: 'Comment', id: string, content: string, createdAt: string, upvoteCount: number, hasUpvoted: boolean, user: { __typename?: 'User', id: string, name: string | null, image: string | null }, parent: { __typename?: 'Comment', id: string } | null, replies: Array<{ __typename?: 'Comment', id: string }> } };

export type UpdateCommentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateCommentInput;
}>;


export type UpdateCommentMutation = { __typename?: 'Mutation', updateComment: { __typename?: 'Comment', id: string, content: string, updatedAt: string } };

export type DeleteCommentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteCommentMutation = { __typename?: 'Mutation', deleteComment: boolean };

export type UpdateProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateProfileMutation = { __typename?: 'Mutation', updateProfile: { __typename?: 'User', id: string, name: string | null, bio: string | null, image: string | null, updatedAt: string } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'User', id: string, email: string, name: string | null, image: string | null, bio: string | null, role: UserRole, createdAt: string, updatedAt: string, worksheetCount: number } | null };

export type UserQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type UserQuery = { __typename?: 'Query', user: { __typename?: 'User', id: string, email: string, name: string | null, image: string | null, bio: string | null, role: UserRole, createdAt: string, worksheetCount: number } | null };

export type WorksheetQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type WorksheetQuery = { __typename?: 'Query', worksheet: { __typename?: 'Worksheet', id: string, title: string, description: string | null, content: Record<string, unknown>, visibility: WorksheetVisibility, views: number, createdAt: string, updatedAt: string, user: { __typename?: 'User', id: string, name: string | null, image: string | null }, folder: { __typename?: 'Folder', id: string, name: string } | null, shares: Array<{ __typename?: 'WorksheetShare', id: string, sharedWith: string, permission: SharePermission }> } | null };

export type WorksheetsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  visibility?: InputMaybe<WorksheetVisibility>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  folderId?: InputMaybe<Scalars['ID']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
}>;


export type WorksheetsQuery = { __typename?: 'Query', worksheets: { __typename?: 'WorksheetConnection', nodes: Array<{ __typename?: 'Worksheet', id: string, title: string, description: string | null, visibility: WorksheetVisibility, views: number, createdAt: string, updatedAt: string, user: { __typename?: 'User', id: string, name: string | null, image: string | null }, folder: { __typename?: 'Folder', id: string, name: string } | null }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, totalCount: number, currentPage: number, totalPages: number } } };

export type PublicWorksheetsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
}>;


export type PublicWorksheetsQuery = { __typename?: 'Query', publicWorksheets: { __typename?: 'WorksheetConnection', nodes: Array<{ __typename?: 'Worksheet', id: string, title: string, description: string | null, views: number, createdAt: string, user: { __typename?: 'User', id: string, name: string | null, image: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, totalCount: number, currentPage: number, totalPages: number } } };

export type CreateWorksheetMutationVariables = Exact<{
  input: CreateWorksheetInput;
}>;


export type CreateWorksheetMutation = { __typename?: 'Mutation', createWorksheet: { __typename?: 'Worksheet', id: string, title: string, description: string | null, visibility: WorksheetVisibility, createdAt: string } };

export type UpdateWorksheetMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateWorksheetInput;
}>;


export type UpdateWorksheetMutation = { __typename?: 'Mutation', updateWorksheet: { __typename?: 'Worksheet', id: string, title: string, description: string | null, content: Record<string, unknown>, visibility: WorksheetVisibility, updatedAt: string } };

export type DeleteWorksheetMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteWorksheetMutation = { __typename?: 'Mutation', deleteWorksheet: boolean };

export type FoldersQueryVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type FoldersQuery = { __typename?: 'Query', folders: Array<{ __typename?: 'Folder', id: string, name: string, description: string | null, createdAt: string, parent: { __typename?: 'Folder', id: string, name: string } | null, children: Array<{ __typename?: 'Folder', id: string, name: string }> }> };

export type CreateFolderMutationVariables = Exact<{
  input: CreateFolderInput;
}>;


export type CreateFolderMutation = { __typename?: 'Mutation', createFolder: { __typename?: 'Folder', id: string, name: string, description: string | null } };

export type CalculateQueryVariables = Exact<{
  input: CalculationInput;
}>;


export type CalculateQuery = { __typename?: 'Query', calculate: { __typename?: 'CalculationResult', input: string, result: string, formatted: string, variables: Record<string, unknown> | null, timestamp: string } };

export type CalculationHistoryQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type CalculationHistoryQuery = { __typename?: 'Query', calculationHistory: Array<{ __typename?: 'CalculationHistory', id: string, userId: string, expression: string, result: string, variables: Record<string, unknown> | null, timestamp: string }> };

export type SaveCalculationMutationVariables = Exact<{
  input: CalculationInput;
}>;


export type SaveCalculationMutation = { __typename?: 'Mutation', saveCalculation: { __typename?: 'CalculationHistory', id: string, expression: string, result: string, timestamp: string } };

export type ClearCalculationHistoryMutationVariables = Exact<{ [key: string]: never; }>;


export type ClearCalculationHistoryMutation = { __typename?: 'Mutation', clearCalculationHistory: boolean };

export type ShareCalculationMutationVariables = Exact<{
  latex: Scalars['String']['input'];
  expression: Scalars['String']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  result?: InputMaybe<Scalars['String']['input']>;
}>;


export type ShareCalculationMutation = { __typename?: 'Mutation', shareCalculation: { __typename?: 'SharedCalculation', id: string, shortCode: string, latex: string, expression: string, title: string | null, description: string | null, result: string | null, createdAt: string } };

export type SharedCalculationQueryVariables = Exact<{
  shortCode: Scalars['String']['input'];
}>;


export type SharedCalculationQuery = { __typename?: 'Query', sharedCalculation: { __typename?: 'SharedCalculation', id: string, shortCode: string, latex: string, expression: string, title: string | null, description: string | null, result: string | null, createdAt: string, expiresAt: string | null, user: { __typename?: 'PublicUser', id: string, name: string | null, image: string | null } | null } | null };

export type DashboardRecentActivityQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type DashboardRecentActivityQuery = { __typename?: 'Query', calculationHistory: Array<{ __typename?: 'CalculationHistory', id: string, expression: string, result: string, timestamp: string }>, worksheets: { __typename?: 'WorksheetConnection', nodes: Array<{ __typename?: 'Worksheet', id: string, title: string, description: string | null, visibility: WorksheetVisibility, updatedAt: string, createdAt: string }>, pageInfo: { __typename?: 'PageInfo', totalCount: number, currentPage: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type HealthQueryVariables = Exact<{ [key: string]: never; }>;


export type HealthQuery = { __typename?: 'Query', health: { __typename?: 'HealthStatus', status: string, timestamp: string, version: string, database: { __typename?: 'ServiceStatus', status: string, latency: number | null, error: string | null }, redis: { __typename?: 'ServiceStatus', status: string, latency: number | null, error: string | null } } };

export type UserProfileQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type UserProfileQuery = { __typename?: 'Query', userProfile: { __typename?: 'UserProfile', worksheetCount: number, forumPostCount: number, calculationCount: number, user: { __typename?: 'User', id: string, name: string | null, image: string | null, bio: string | null, createdAt: string }, progress: { __typename?: 'UserProgress', id: string, problemsSolved: number, totalPoints: number, streak: number, longestStreak: number, level: number, experience: number, lastActive: string | null } | null, recentAchievements: Array<{ __typename?: 'UserAchievement', id: string, name: string, description: string, type: string, icon: string, points: number, badgeUrl: string | null, earnedAt: string }> } | null };

export type UserActivityQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
  days?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UserActivityQuery = { __typename?: 'Query', userActivity: Array<{ __typename?: 'ActivityDay', date: string, count: number }> };

export type UserAnalyticsQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type UserAnalyticsQuery = { __typename?: 'Query', userAnalytics: { __typename?: 'UserAnalytics', topicMastery: Array<{ __typename?: 'TopicMasteryEntry', topic: string, mastery: number, problemsSolved: number }>, accuracyTrend: Array<{ __typename?: 'AccuracyPoint', date: string, accuracy: number }>, practiceHistory: Array<{ __typename?: 'PracticeSessionSummary', id: string, topic: string, score: number, accuracy: number, totalTime: number, completedAt: string | null }>, streakHistory: Array<{ __typename?: 'StreakPoint', date: string, streak: number }> } | null };


export const ForumPostsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ForumPosts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"forumPosts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}},{"kind":"Argument","name":{"kind":"Name","value":"searchQuery"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"views"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isClosed"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpvoted"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"commentCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}}]}}]}}]}}]} as unknown as DocumentNode<ForumPostsQuery, ForumPostsQueryVariables>;
export const ForumPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ForumPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"forumPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"views"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isClosed"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"commentCount"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpvoted"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpvoted"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"replies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpvoted"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<ForumPostQuery, ForumPostQueryVariables>;
export const ForumUserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ForumUserProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"worksheetCount"}},{"kind":"Field","name":{"kind":"Name","value":"forumPosts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"views"}}]}}]}}]}}]} as unknown as DocumentNode<ForumUserProfileQuery, ForumUserProfileQueryVariables>;
export const CreateForumPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateForumPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateForumPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createForumPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"views"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isClosed"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpvoted"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}}]}}]}}]} as unknown as DocumentNode<CreateForumPostMutation, CreateForumPostMutationVariables>;
export const UpdateForumPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateForumPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateForumPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateForumPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateForumPostMutation, UpdateForumPostMutationVariables>;
export const DeleteForumPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteForumPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteForumPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteForumPostMutation, DeleteForumPostMutationVariables>;
export const ToggleUpvoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ToggleUpvote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"targetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"targetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpvoteTargetType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toggleUpvote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"targetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"targetId"}}},{"kind":"Argument","name":{"kind":"Name","value":"targetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"targetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upvoted"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}}]}}]}}]} as unknown as DocumentNode<ToggleUpvoteMutation, ToggleUpvoteMutationVariables>;
export const CreateCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"upvoteCount"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpvoted"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"replies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<CreateCommentMutation, CreateCommentMutationVariables>;
export const UpdateCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateCommentMutation, UpdateCommentMutationVariables>;
export const DeleteCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteCommentMutation, DeleteCommentMutationVariables>;
export const UpdateProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateProfileMutation, UpdateProfileMutationVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"worksheetCount"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const UserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"User"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"worksheetCount"}}]}}]}}]} as unknown as DocumentNode<UserQuery, UserQueryVariables>;
export const WorksheetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Worksheet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"worksheet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"views"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"folder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shares"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sharedWith"}},{"kind":"Field","name":{"kind":"Name","value":"permission"}}]}}]}}]}}]} as unknown as DocumentNode<WorksheetQuery, WorksheetQueryVariables>;
export const WorksheetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Worksheets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"visibility"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WorksheetVisibility"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"folderId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"worksheets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"visibility"},"value":{"kind":"Variable","name":{"kind":"Name","value":"visibility"}}},{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"folderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"folderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"searchQuery"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"views"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"folder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}}]}}]}}]}}]} as unknown as DocumentNode<WorksheetsQuery, WorksheetsQueryVariables>;
export const PublicWorksheetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicWorksheets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicWorksheets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"searchQuery"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"views"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}}]}}]}}]}}]} as unknown as DocumentNode<PublicWorksheetsQuery, PublicWorksheetsQueryVariables>;
export const CreateWorksheetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWorksheet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWorksheetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createWorksheet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateWorksheetMutation, CreateWorksheetMutationVariables>;
export const UpdateWorksheetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWorksheet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateWorksheetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorksheet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateWorksheetMutation, UpdateWorksheetMutationVariables>;
export const DeleteWorksheetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorksheet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorksheet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteWorksheetMutation, DeleteWorksheetMutationVariables>;
export const FoldersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Folders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"folders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"parent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"children"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<FoldersQuery, FoldersQueryVariables>;
export const CreateFolderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFolder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFolderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFolder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<CreateFolderMutation, CreateFolderMutationVariables>;
export const CalculateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Calculate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CalculationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"calculate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"input"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"formatted"}},{"kind":"Field","name":{"kind":"Name","value":"variables"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]} as unknown as DocumentNode<CalculateQuery, CalculateQueryVariables>;
export const CalculationHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CalculationHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"50"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"calculationHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"expression"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"variables"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]} as unknown as DocumentNode<CalculationHistoryQuery, CalculationHistoryQueryVariables>;
export const SaveCalculationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveCalculation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CalculationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveCalculation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expression"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]} as unknown as DocumentNode<SaveCalculationMutation, SaveCalculationMutationVariables>;
export const ClearCalculationHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClearCalculationHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clearCalculationHistory"}}]}}]} as unknown as DocumentNode<ClearCalculationHistoryMutation, ClearCalculationHistoryMutationVariables>;
export const ShareCalculationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ShareCalculation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"latex"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"expression"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"result"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareCalculation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"latex"},"value":{"kind":"Variable","name":{"kind":"Name","value":"latex"}}},{"kind":"Argument","name":{"kind":"Name","value":"expression"},"value":{"kind":"Variable","name":{"kind":"Name","value":"expression"}}},{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"result"},"value":{"kind":"Variable","name":{"kind":"Name","value":"result"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"shortCode"}},{"kind":"Field","name":{"kind":"Name","value":"latex"}},{"kind":"Field","name":{"kind":"Name","value":"expression"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<ShareCalculationMutation, ShareCalculationMutationVariables>;
export const SharedCalculationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SharedCalculation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sharedCalculation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"shortCode"}},{"kind":"Field","name":{"kind":"Name","value":"latex"}},{"kind":"Field","name":{"kind":"Name","value":"expression"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}}]}}]}}]} as unknown as DocumentNode<SharedCalculationQuery, SharedCalculationQueryVariables>;
export const DashboardRecentActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DashboardRecentActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"calculationHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expression"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worksheets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}}]}}]}}]} as unknown as DocumentNode<DashboardRecentActivityQuery, DashboardRecentActivityQueryVariables>;
export const HealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"database"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"latency"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}},{"kind":"Field","name":{"kind":"Name","value":"redis"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"latency"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<HealthQuery, HealthQueryVariables>;
export const UserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"progress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"problemsSolved"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"streak"}},{"kind":"Field","name":{"kind":"Name","value":"longestStreak"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"experience"}},{"kind":"Field","name":{"kind":"Name","value":"lastActive"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recentAchievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"badgeUrl"}},{"kind":"Field","name":{"kind":"Name","value":"earnedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worksheetCount"}},{"kind":"Field","name":{"kind":"Name","value":"forumPostCount"}},{"kind":"Field","name":{"kind":"Name","value":"calculationCount"}}]}}]}}]} as unknown as DocumentNode<UserProfileQuery, UserProfileQueryVariables>;
export const UserActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<UserActivityQuery, UserActivityQueryVariables>;
export const UserAnalyticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserAnalytics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userAnalytics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"topicMastery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"mastery"}},{"kind":"Field","name":{"kind":"Name","value":"problemsSolved"}}]}},{"kind":"Field","name":{"kind":"Name","value":"accuracyTrend"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practiceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"totalTime"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"streakHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"streak"}}]}}]}}]}}]} as unknown as DocumentNode<UserAnalyticsQuery, UserAnalyticsQueryVariables>;