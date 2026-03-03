/**
 * Prisma 7.5.0-dev.33 Client Singleton with Neon Serverless Adapter
 *
 * Shared database client for the NextCalc Pro monorepo.
 * Uses singleton pattern to prevent multiple instances during development HMR.
 *
 * Key capabilities:
 * - Query plan caching (7.4+) — LRU cache with ~100% hit rate for repeated query shapes
 * - Nested transaction savepoints (tx.$transaction creates SAVEPOINTs)
 * - BigInt precision safety in JSON aggregation with relationJoins (7.3+)
 * - Partial indexes for soft-delete optimization (7.4+ partialIndexes preview)
 * - Neon adapter with savepoint support (createSavepoint/rollbackToSavepoint/releaseSavepoint)
 * - Graceful degradation via mock client when DATABASE_URL is not set
 *
 * All apps import from @nextcalc/database instead of creating their own clients.
 */

import { Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './generated/prisma/client';

// Singleton storage
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
	pool: Pool | undefined;
};

/**
 * Creates a mock Prisma client that throws helpful errors when DATABASE_URL is not set.
 * Allows the app to build and start without a database connection.
 */
function createMockPrismaClient(): PrismaClient {
	const handler: ProxyHandler<object> = {
		get(_target, prop) {
			// Thenable check — prevents unhandled promise issues
			if (prop === 'then' || prop === 'catch' || prop === 'finally') {
				return undefined;
			}
			// Allow graceful connect/disconnect
			if (prop === '$connect' || prop === '$disconnect') {
				return async () => {};
			}
			if (typeof prop === 'symbol') {
				return undefined;
			}
			throw new Error(
				`Database not configured. Set DATABASE_URL in your environment. Attempted to access: ${String(prop)}`,
			);
		},
	};
	return new Proxy({}, handler) as unknown as PrismaClient;
}

function createPrismaClient(): PrismaClient {
	const connectionString = process.env['DATABASE_URL'];

	if (!connectionString) {
		return createMockPrismaClient();
	}

	// PrismaNeon in Prisma 7 creates its own Pool internally from the config we pass.
	// Pass a config object (not a Pool instance) so the internal Pool gets correct options.
	const poolConfig = { connectionString };

	// Also create an external Pool for monitoring (getPoolStats)
	const pool = new Pool(poolConfig);
	globalForPrisma.pool = pool;

	const adapter = new PrismaNeon(poolConfig);

	return new PrismaClient({
		adapter,
		log:
			process.env['NODE_ENV'] === 'development'
				? ['query', 'error', 'warn']
				: ['error'],
	});
}

/** Shared Prisma client instance. Singleton in development to survive HMR. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

/** Check if the database is reachable. */
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		await prisma.$queryRaw`SELECT 1`;
		return true;
	} catch (error) {
		console.error('Database connection failed:', error);
		return false;
	}
}

/** Gracefully disconnect from the database. Call on app shutdown. */
export async function disconnectDatabase(): Promise<void> {
	await prisma.$disconnect();
}

/** Connection pool stats for monitoring. */
export function getPoolStats() {
	const pool = globalForPrisma.pool;
	if (!pool) {
		return { maxConnections: 0, idleConnections: 0, waitingConnections: 0 };
	}
	return {
		maxConnections: pool.totalCount,
		idleConnections: pool.idleCount,
		waitingConnections: pool.waitingCount,
	};
}
