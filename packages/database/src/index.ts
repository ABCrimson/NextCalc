/**
 * @nextcalc/database — Shared Database Package
 *
 * All apps import Prisma types and the client singleton from here.
 * Never import from "@prisma/client" directly.
 */

// Re-export the singleton client and utilities
export {
  checkDatabaseConnection,
  disconnectDatabase,
  getPoolStats,
  prisma,
} from './client';
// Re-export ALL generated types and enums
export type {
  Account,
  Achievement,
  Algorithm,
  Attempt,
  AuditLog,
  CalculationHistory,
  Comment,
  Example,
  Favorite,
  Folder,
  ForumPost,
  Hint,
  Implementation,
  PracticeSession,
  // Prisma namespace for advanced queries
  Prisma,
  Problem,
  ProblemTopic,
  Resource,
  Session,
  SharedCalculation,
  TestCase,
  Theorem,
  Topic,
  TopicProgress,
  Upvote,
  // Model types
  User,
  UserAchievement,
  UserProgress,
  VerificationToken,
  Worksheet,
  WorksheetShare,
} from './generated/prisma/client';
// Re-export PrismaClient class (for type annotations and adapter use)
// Re-export enums (these are values, not just types)
export {
  AchievementType,
  AlgorithmCategory,
  Category,
  Difficulty,
  FavoriteType,
  PrismaClient,
  ProgrammingLanguage,
  ResourceType,
  SharePermission,
  UpvoteTarget,
  UserRole,
  WorksheetVisibility,
} from './generated/prisma/client';

// Re-export the models barrel (needed for TypeScript declaration emit)
export * from './generated/prisma/models';
