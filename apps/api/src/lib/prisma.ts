/**
 * Re-export the shared Prisma client from @nextcalc/database.
 *
 * All database access goes through the shared package.
 * This file exists for backwards compatibility with existing API imports.
 */

export {
	prisma,
	checkDatabaseConnection,
	disconnectDatabase,
	getPoolStats,
} from '@nextcalc/database';
