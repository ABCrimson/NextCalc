/**
 * Prisma 7.5.0-dev.33 Configuration File
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

// Prefer DIRECT_DATABASE_URL for CLI operations (bypasses PgBouncer).
// Fall back to DATABASE_URL for general use.
const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

// Allow prisma generate to run without a real database URL (e.g. in CI).
// Only actual database operations (migrate, push) need a real connection string.
const datasourceUrl = url || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
  },
  datasource: {
    url: datasourceUrl,
  },
});
