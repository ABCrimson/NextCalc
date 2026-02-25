/**
 * Prisma 7.5 Configuration File
 *
 * Shared database package for the NextCalc Pro monorepo.
 * Loads credentials from apps/web/.env.local or root .env.
 *
 * @see https://pris.ly/d/config-datasource
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load env from multiple locations (first match wins for each var)
dotenv.config({ path: path.join(__dirname, '..', '..', 'apps', 'web', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
	throw new Error(
		'DIRECT_DATABASE_URL or DATABASE_URL must be set. Check apps/web/.env.local or set env vars directly.',
	);
}

export default defineConfig({
	schema: path.join(__dirname, 'prisma', 'schema.prisma'),
	migrations: {
		path: path.join(__dirname, 'prisma', 'migrations'),
	},
	datasource: {
		url,
	},
});
