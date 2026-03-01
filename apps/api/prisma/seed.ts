/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing.
 *
 * Run with: pnpm prisma:seed
 */

import { prisma, UserRole, WorksheetVisibility } from '@nextcalc/database';

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (in development only!)
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️  Clearing existing data...');
    await prisma.upvote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.forumPost.deleteMany();
    await prisma.worksheetShare.deleteMany();
    await prisma.worksheet.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create users
  console.log('👥 Creating users...');

  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice Anderson',
      emailVerified: new Date(),
      role: UserRole.ADMIN,
      bio: 'Math enthusiast and NextCalc power user. Love solving complex calculus problems!',
      image: 'https://i.pravatar.cc/150?u=alice',
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob Builder',
      emailVerified: new Date(),
      role: UserRole.MODERATOR,
      bio: 'Engineering student. Building the future one calculation at a time.',
      image: 'https://i.pravatar.cc/150?u=bob',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      email: 'charlie@example.com',
      name: 'Charlie Chen',
      emailVerified: new Date(),
      role: UserRole.USER,
      bio: 'Physics researcher. Using NextCalc for data analysis and visualization.',
      image: 'https://i.pravatar.cc/150?u=charlie',
    },
  });

  console.log(`✅ Created ${3} users`);

  // Create folders
  console.log('📁 Creating folders...');

  const mathFolder = await prisma.folder.create({
    data: {
      name: 'Mathematics',
      description: 'Advanced math worksheets',
      userId: alice.id,
    },
  });

  const physicsFolder = await prisma.folder.create({
    data: {
      name: 'Physics',
      description: 'Physics calculations and simulations',
      userId: charlie.id,
    },
  });

  const calculusFolder = await prisma.folder.create({
    data: {
      name: 'Calculus',
      description: 'Calculus problems and solutions',
      userId: alice.id,
      parentId: mathFolder.id,
    },
  });

  console.log(`✅ Created ${3} folders`);

  // Create worksheets
  console.log('📊 Creating worksheets...');

  const worksheet1 = await prisma.worksheet.create({
    data: {
      title: 'Derivative Calculator',
      description: 'Calculate derivatives of polynomial functions',
      visibility: WorksheetVisibility.PUBLIC,
      userId: alice.id,
      folderId: calculusFolder.id,
      views: 142,
      content: {
        cells: [
          {
            id: 'c1',
            type: 'markdown',
            content: '# Derivative Calculator\n\nCalculate derivatives of polynomial functions.',
          },
          {
            id: 'c2',
            type: 'expression',
            content: 'f(x) = x^3 + 2x^2 - 5x + 1',
            result: 'f(x) = x³ + 2x² - 5x + 1',
          },
          {
            id: 'c3',
            type: 'expression',
            content: 'derivative(f(x), x)',
            result: '3x² + 4x - 5',
          },
          {
            id: 'c4',
            type: 'plot',
            content: 'plot(f(x), derivative(f(x), x))',
          },
        ],
      },
    },
  });

  await prisma.worksheet.create({
    data: {
      title: 'Quadratic Equation Solver',
      description: 'Solve quadratic equations using the quadratic formula',
      visibility: WorksheetVisibility.PUBLIC,
      userId: bob.id,
      views: 87,
      content: {
        cells: [
          {
            id: 'c1',
            type: 'markdown',
            content: '# Quadratic Equation Solver\n\nSolve ax² + bx + c = 0',
          },
          {
            id: 'c2',
            type: 'expression',
            content: 'a = 1',
            result: '1',
          },
          {
            id: 'c3',
            type: 'expression',
            content: 'b = -5',
            result: '-5',
          },
          {
            id: 'c4',
            type: 'expression',
            content: 'c = 6',
            result: '6',
          },
          {
            id: 'c5',
            type: 'expression',
            content: 'discriminant = b^2 - 4*a*c',
            result: '1',
          },
          {
            id: 'c6',
            type: 'expression',
            content: 'x1 = (-b + sqrt(discriminant)) / (2*a)',
            result: '3',
          },
          {
            id: 'c7',
            type: 'expression',
            content: 'x2 = (-b - sqrt(discriminant)) / (2*a)',
            result: '2',
          },
        ],
      },
    },
  });

  await prisma.worksheet.create({
    data: {
      title: 'Projectile Motion',
      description: 'Calculate projectile trajectory and range',
      visibility: WorksheetVisibility.PUBLIC,
      userId: charlie.id,
      folderId: physicsFolder.id,
      views: 203,
      content: {
        cells: [
          {
            id: 'c1',
            type: 'markdown',
            content: '# Projectile Motion\n\nCalculate trajectory of a projectile',
          },
          {
            id: 'c2',
            type: 'expression',
            content: 'v0 = 50',
            result: '50 m/s',
          },
          {
            id: 'c3',
            type: 'expression',
            content: 'angle = 45',
            result: '45°',
          },
          {
            id: 'c4',
            type: 'expression',
            content: 'g = 9.81',
            result: '9.81 m/s²',
          },
          {
            id: 'c5',
            type: 'expression',
            content: 'range = (v0^2 * sin(2*angle*pi/180)) / g',
            result: '254.84 m',
          },
        ],
      },
    },
  });

  await prisma.worksheet.create({
    data: {
      title: 'My Private Notes',
      description: 'Personal calculations',
      visibility: WorksheetVisibility.PRIVATE,
      userId: alice.id,
      views: 5,
      content: {
        cells: [
          {
            id: 'c1',
            type: 'markdown',
            content: '# Private Notes',
          },
          {
            id: 'c2',
            type: 'expression',
            content: '2 + 2',
            result: '4',
          },
        ],
      },
    },
  });

  console.log(`✅ Created ${4} worksheets`);

  // Create forum posts
  console.log('💬 Creating forum posts...');

  const post1 = await prisma.forumPost.create({
    data: {
      title: 'How to plot multiple functions?',
      content:
        'I want to plot f(x) = x^2 and g(x) = x^3 on the same graph. How can I do this in NextCalc?',
      tags: ['plotting', 'beginner', 'help'],
      userId: charlie.id,
      views: 56,
    },
  });

  const post2 = await prisma.forumPost.create({
    data: {
      title: 'Feature Request: Matrix Operations',
      content:
        'It would be great to have matrix multiplication and determinant calculations. Is this planned for future releases?',
      tags: ['feature-request', 'matrix', 'linear-algebra'],
      userId: bob.id,
      views: 89,
      isPinned: true,
    },
  });

  const post3 = await prisma.forumPost.create({
    data: {
      title: 'Derivative Calculator Tutorial',
      content:
        "Here's a step-by-step guide on using the derivative calculator for polynomial functions:\n\n1. Define your function: f(x) = x^3 + 2x\n2. Use derivative(f(x), x) to compute\n3. Plot both functions to visualize",
      tags: ['tutorial', 'calculus', 'derivatives'],
      userId: alice.id,
      views: 124,
      isPinned: true,
    },
  });

  console.log(`✅ Created ${3} forum posts`);

  // Create comments
  console.log('💭 Creating comments...');

  const comment1 = await prisma.comment.create({
    data: {
      content: 'You can use the plot function with multiple arguments: plot(x^2, x^3)',
      postId: post1.id,
      userId: alice.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Thanks! That works perfectly.',
      postId: post1.id,
      userId: charlie.id,
      parentId: comment1.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Matrix operations are on the roadmap for Phase 5! Stay tuned.',
      postId: post2.id,
      userId: bob.id,
    },
  });

  const comment4 = await prisma.comment.create({
    data: {
      content: 'Great tutorial! Very helpful for beginners.',
      postId: post3.id,
      userId: charlie.id,
    },
  });

  console.log(`✅ Created ${4} comments`);

  // Create upvotes
  console.log('👍 Creating upvotes...');

  await prisma.upvote.createMany({
    data: [
      { userId: alice.id, targetId: post2.id, targetType: 'POST' },
      { userId: bob.id, targetId: post3.id, targetType: 'POST' },
      { userId: charlie.id, targetId: post3.id, targetType: 'POST' },
      { userId: alice.id, targetId: comment1.id, targetType: 'COMMENT' },
      { userId: bob.id, targetId: comment4.id, targetType: 'COMMENT' },
    ],
  });

  console.log(`✅ Created ${5} upvotes`);

  // Create worksheet shares
  console.log('🔗 Creating worksheet shares...');

  await prisma.worksheetShare.create({
    data: {
      worksheetId: worksheet1.id,
      sharedWith: bob.id,
      permission: 'VIEW',
    },
  });

  console.log(`✅ Created ${1} worksheet share`);

  // Create audit logs
  console.log('📝 Creating audit logs...');

  await prisma.auditLog.createMany({
    data: [
      {
        userId: alice.id,
        action: 'create',
        entity: 'worksheet',
        entityId: worksheet1.id,
        metadata: { title: worksheet1.title },
      },
      {
        userId: bob.id,
        action: 'create',
        entity: 'post',
        entityId: post2.id,
        metadata: { title: post2.title },
      },
      {
        userId: charlie.id,
        action: 'view',
        entity: 'worksheet',
        entityId: worksheet1.id,
      },
    ],
  });

  console.log(`✅ Created ${3} audit logs`);

  console.log('\n✨ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Users: ${3}`);
  console.log(`   Folders: ${3}`);
  console.log(`   Worksheets: ${4}`);
  console.log(`   Forum Posts: ${3}`);
  console.log(`   Comments: ${4}`);
  console.log(`   Upvotes: ${5}`);
  console.log(`   Shares: ${1}`);
  console.log(`   Audit Logs: ${3}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
