/**
 * Promote a user to ADMIN — idempotent, single-row, by exact email.
 *
 * The level system and the avatar-icon picker are designed around a single
 * ADMIN owner (the Architect / L101 tier). OAuth sign-up always creates users
 * with the schema default role (USER); nothing in the app can grant ADMIN, so
 * the owner must be promoted once, explicitly, with this script.
 *
 * Usage (from packages/database):
 *   pnpm db:promote-admin you@example.com
 */

import path from 'node:path';
import dotenv from 'dotenv';

// Load env the same way prisma.config.ts does (first match wins per var).
dotenv.config({
  path: path.join(import.meta.dirname, '..', '..', '..', 'apps', 'web', '.env.local'),
});
dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '..', '.env') });

// Dynamic import so the Prisma client is created AFTER the env is loaded
// (static imports hoist above dotenv.config in ESM).
const { prisma, UserRole } = await import('@nextcalc/database');

// pnpm forwards a literal `--` separator to the script — ignore it.
const email = process.argv
  .slice(2)
  .find((arg) => arg !== '--')
  ?.trim();
if (!email) {
  console.error('Usage: pnpm db:promote-admin you@example.com');
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, role: true },
});

if (!user) {
  console.error(`No user found with email ${email}`);
  await prisma.$disconnect();
  process.exit(1);
}

if (user.role === UserRole.ADMIN) {
  console.log(`${user.email} (${user.id}) is already ADMIN — nothing to do.`);
} else {
  await prisma.user.update({
    where: { id: user.id },
    data: { role: UserRole.ADMIN },
  });
  console.log(`Promoted ${user.email} (${user.id}): ${user.role} -> ADMIN`);
}

await prisma.$disconnect();
