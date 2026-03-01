/**
 * Re-export the shared Prisma client from @nextcalc/database.
 *
 * All database access goes through the shared package.
 * This file exists for backwards compatibility with existing imports.
 */

export { checkDatabaseConnection, disconnectDatabase, prisma } from '@nextcalc/database';
