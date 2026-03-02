/**
 * Database Setup Script
 *
 * Interactive script to help set up Neon database with Prisma.
 * This script will:
 * 1. Verify DATABASE_URL is configured
 * 2. Test connection to Neon
 * 3. Push schema to database
 * 4. Generate Prisma client
 * 5. Optionally seed initial data
 *
 * Usage:
 *   pnpm tsx scripts/setup-database.ts
 */

import { execSync } from 'node:child_process';
import * as readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function executeCommand(command: string, description: string): boolean {
  try {
    console.log(`\n${description}...`);
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed!`);
    console.error(error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function setupDatabase() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  NextCalc Pro - Database Setup Script                    ║');
  console.log('║  Interactive setup for Neon PostgreSQL + Prisma          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Step 1: Check environment variables
  console.log('Step 1: Checking environment configuration...\n');

  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl || databaseUrl.includes('placeholder')) {
    console.error('❌ DATABASE_URL is not configured properly!\n');
    console.log('Please follow these steps:\n');
    console.log('1. Go to https://console.neon.tech');
    console.log('2. Select your NextCalc project (or create one)');
    console.log('3. Go to "Dashboard" → "Connection Details"');
    console.log('4. Copy the connection string');
    console.log('5. Create/update apps/web/.env.local:');
    console.log('');
    console.log('   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"');
    console.log(
      '   DIRECT_DATABASE_URL="postgresql://user:password@host/database?sslmode=require"',
    );
    console.log('');
    console.log('Note: DIRECT_DATABASE_URL should be the same as DATABASE_URL for Neon');
    console.log('      (Neon handles pooling automatically)');
    console.log('');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL is configured');
  console.log(`   Host: ${databaseUrl.match(/@([^/]+)\//)?.[1] || 'Unknown'}`);
  console.log('');

  // Step 2: Test connection
  const continueTest = await question('Step 2: Test database connection? (Y/n): ');
  if (continueTest.toLowerCase() !== 'n') {
    const success = executeCommand(
      'pnpm tsx scripts/test-database-connection.ts',
      'Testing database connection',
    );

    if (!success) {
      console.log('\n❌ Connection test failed. Please fix the connection issues first.');
      process.exit(1);
    }
  }

  // Step 3: Push schema to database
  console.log('\n' + '='.repeat(60));
  console.log('Step 3: Push Prisma schema to database');
  console.log('='.repeat(60));
  console.log('\nThis will create all tables, indexes, and constraints.');
  console.log('⚠️  Warning: This will modify your database schema!');
  console.log('');

  const continuePush = await question('Continue with schema push? (Y/n): ');
  if (continuePush.toLowerCase() !== 'n') {
    const success = executeCommand('pnpm prisma db push', 'Pushing schema to database');

    if (!success) {
      console.log('\n❌ Schema push failed. Please check the error messages above.');
      process.exit(1);
    }
  }

  // Step 4: Generate Prisma client
  console.log('\n' + '='.repeat(60));
  console.log('Step 4: Generate Prisma client');
  console.log('='.repeat(60));

  const continueGenerate = await question('\nGenerate Prisma client? (Y/n): ');
  if (continueGenerate.toLowerCase() !== 'n') {
    executeCommand('pnpm prisma generate', 'Generating Prisma client');
  }

  // Step 5: Seed database (optional)
  console.log('\n' + '='.repeat(60));
  console.log('Step 5: Seed initial data (optional)');
  console.log('='.repeat(60));
  console.log('\nThis will create sample data for testing:');
  console.log('- Test user account');
  console.log('- Sample worksheets');
  console.log('- Forum posts');
  console.log('');

  const continueSeed = await question('Seed database with sample data? (y/N): ');
  if (continueSeed.toLowerCase() === 'y') {
    executeCommand('pnpm tsx scripts/seed-database.ts', 'Seeding database');
  }

  // Step 6: Verify setup
  console.log('\n' + '='.repeat(60));
  console.log('Step 6: Verify setup');
  console.log('='.repeat(60) + '\n');

  executeCommand('pnpm tsx scripts/test-database-connection.ts', 'Running final verification');

  // Summary
  console.log('\n' + '╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Database Setup Complete!                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('Next steps:');
  console.log('1. Start the development server: pnpm dev');
  console.log('2. Test authentication at http://localhost:3005');
  console.log('3. Check Prisma Studio: pnpm prisma studio');
  console.log('');
  console.log('Database tools:');
  console.log('- View data: pnpm prisma studio');
  console.log('- Test connection: pnpm tsx scripts/test-database-connection.ts');
  console.log('- Reset database: pnpm prisma db push --force-reset');
  console.log('');

  rl.close();
}

// Run the setup
setupDatabase().catch((error) => {
  console.error('\n❌ Setup failed with error:', error);
  rl.close();
  process.exit(1);
});
