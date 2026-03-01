/**
 * @nextcalc/database — Shared Database Package
 *
 * All apps import Prisma types and the client singleton from here.
 * Never import from "@prisma/client" directly.
 */

// Re-export the singleton client and utilities
export {
	prisma,
	checkDatabaseConnection,
	disconnectDatabase,
	getPoolStats,
} from './client';

// Re-export PrismaClient class (for type annotations and adapter use)
export { PrismaClient } from './generated/prisma/client';

// Re-export ALL generated types and enums
export type {
	// Model types
	User,
	Account,
	Session,
	VerificationToken,
	Worksheet,
	Folder,
	WorksheetShare,
	CalculationHistory,
	ForumPost,
	Comment,
	Upvote,
	AuditLog,
	Problem,
	Hint,
	TestCase,
	Example,
	Topic,
	ProblemTopic,
	Theorem,
	Resource,
	Algorithm,
	Implementation,
	UserProgress,
	TopicProgress,
	Attempt,
	Favorite,
	Achievement,
	UserAchievement,
	// Prisma namespace for advanced queries
	Prisma,
} from './generated/prisma/client';

// Re-export enums (these are values, not just types)
export {
	UserRole,
	WorksheetVisibility,
	SharePermission,
	UpvoteTarget,
	Difficulty,
	Category,
	ResourceType,
	AlgorithmCategory,
	ProgrammingLanguage,
	AchievementType,
	FavoriteType,
} from './generated/prisma/client';

// Re-export the models barrel (needed for TypeScript declaration emit)
export * from './generated/prisma/models';
