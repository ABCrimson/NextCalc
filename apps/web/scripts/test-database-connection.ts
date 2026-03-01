/**
 * Database Connection Test Script
 *
 * Tests connection to Neon PostgreSQL and verifies Prisma setup.
 * Run this after configuring your DATABASE_URL in .env.local
 *
 * Usage:
 *   pnpm tsx scripts/test-database-connection.ts
 */

import { checkDatabaseConnection, disconnectDatabase, prisma } from '@nextcalc/database';

async function testConnection() {
  console.log('Testing Neon Database Connection...\n');

  try {
    // Step 1: Test basic connection
    console.log('Step 1: Testing basic connection...');
    const connected = await checkDatabaseConnection();
    if (!connected) {
      throw new Error('Database connection check returned false');
    }
    console.log('Connected to database successfully!\n');

    // Step 2: Test raw query execution
    console.log('Step 2: Testing raw query execution...');
    const result = (await prisma.$queryRaw`SELECT version()`) as {
      version?: string;
      tablename?: string;
    }[];
    console.log('PostgreSQL Version:', result[0]?.version?.split(' ')[1] || 'Unknown');
    console.log('');

    // Step 3: Check if tables exist
    console.log('Step 3: Checking database tables...');
    const tables = (await prisma.$queryRaw`
      SELECT tablename::text AS tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `) as { tablename: string }[];

    if (tables.length === 0) {
      console.log('No tables found. Run migrations:');
      console.log('   cd packages/database');
      console.log('   pnpm db:push');
      console.log('');
    } else {
      console.log(`Found ${tables.length} tables:`);
      tables.forEach((t: { tablename?: string }) => console.log(`   - ${t.tablename}`));
      console.log('');
    }

    // Step 4: Test user count (if tables exist)
    if (tables.length > 0) {
      console.log('Step 4: Testing query operations...');
      const userCount = await prisma.user.count();
      console.log(`Users in database: ${userCount}`);
      console.log('');
    }

    // Step 5: Connection info
    console.log('Step 5: Connection information...');
    const databaseUrl = process.env['DATABASE_URL'] || '';
    const urlParts = databaseUrl.match(/postgresql:\/\/([^:]+):[^@]+@([^/]+)\/(.+)\?/);

    if (urlParts) {
      console.log('Database details:');
      console.log(`   Host: ${urlParts[2]}`);
      console.log(`   Database: ${urlParts[3]}`);
      console.log(`   User: ${urlParts[1]}`);
      console.log('');
    }

    console.log('All connection tests passed!\n');
  } catch (error) {
    console.error('\nConnection test failed!\n');

    if (error instanceof Error) {
      console.error('Error:', error.message);

      if (error.message.includes('connect ECONNREFUSED')) {
        console.error('Possible issues:');
        console.error('1. DATABASE_URL is not set in .env.local');
        console.error('2. Neon database is not reachable');
      } else if (error.message.includes('authentication failed')) {
        console.error('Possible issues:');
        console.error('1. Incorrect database credentials');
      } else if (error.message.includes('does not exist')) {
        console.error('Possible issues:');
        console.error('1. Database name is incorrect');
      }
    }

    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

testConnection().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
