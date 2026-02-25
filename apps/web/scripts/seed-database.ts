/**
 * Database Seed Script
 *
 * Populates the database with sample data for testing.
 * Creates:
 * - Test user accounts
 * - Sample worksheets
 * - Forum posts and comments
 *
 * Usage:
 *   pnpm tsx scripts/seed-database.ts
 */

import { prisma, UserRole, WorksheetVisibility } from '@nextcalc/database';

async function seed() {
  console.log('🌱 Seeding database with sample data...\n');

  try {
    // Create test users
    console.log('Creating test users...');

    const testUser = await prisma.user.upsert({
      where: { email: 'test@nextcalc.pro' },
      update: {},
      create: {
        email: 'test@nextcalc.pro',
        name: 'Test User',
        bio: 'A test user for NextCalc Pro',
        role: UserRole.USER,
        emailVerified: new Date(),
      },
    });

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@nextcalc.pro' },
      update: {},
      create: {
        email: 'admin@nextcalc.pro',
        name: 'Admin User',
        bio: 'System administrator',
        role: UserRole.ADMIN,
        emailVerified: new Date(),
      },
    });

    console.log(`✅ Created users: ${testUser.email}, ${adminUser.email}\n`);

    // Create folders
    console.log('Creating folders...');

    const mathFolder = await prisma.folder.upsert({
      where: {
        userId_name_parentId: {
          userId: testUser.id,
          name: 'Mathematics',
          parentId: null!,
        },
      },
      update: {},
      create: {
        name: 'Mathematics',
        description: 'Math worksheets and calculations',
        userId: testUser.id,
      },
    });

    const physicsFolder = await prisma.folder.upsert({
      where: {
        userId_name_parentId: {
          userId: testUser.id,
          name: 'Physics',
          parentId: null!,
        },
      },
      update: {},
      create: {
        name: 'Physics',
        description: 'Physics calculations and formulas',
        userId: testUser.id,
      },
    });

    console.log(`✅ Created folders: ${mathFolder.name}, ${physicsFolder.name}\n`);

    // Create sample worksheets
    console.log('Creating sample worksheets...');

    const worksheet1 = await prisma.worksheet.create({
      data: {
        title: 'Quadratic Equations',
        description: 'Solving quadratic equations with the quadratic formula',
        content: {
          cells: [
            {
              id: 'cell-1',
              type: 'markdown',
              content: '# Quadratic Equations\n\nSolving ax² + bx + c = 0',
            },
            {
              id: 'cell-2',
              type: 'calculation',
              expression: '(-b + sqrt(b^2 - 4*a*c)) / (2*a)',
              variables: { a: 1, b: -5, c: 6 },
              result: '3',
            },
            {
              id: 'cell-3',
              type: 'calculation',
              expression: '(-b - sqrt(b^2 - 4*a*c)) / (2*a)',
              variables: { a: 1, b: -5, c: 6 },
              result: '2',
            },
          ],
        },
        visibility: WorksheetVisibility.PUBLIC,
        userId: testUser.id,
        folderId: mathFolder.id,
      },
    });

    const worksheet2 = await prisma.worksheet.create({
      data: {
        title: 'Trigonometric Identities',
        description: 'Common trig identities and calculations',
        content: {
          cells: [
            {
              id: 'cell-1',
              type: 'markdown',
              content: '# Trigonometric Identities\n\n## Pythagorean Identity',
            },
            {
              id: 'cell-2',
              type: 'calculation',
              expression: 'sin(x)^2 + cos(x)^2',
              variables: { x: Math.PI / 4 },
              result: '1',
            },
          ],
        },
        visibility: WorksheetVisibility.PUBLIC,
        userId: testUser.id,
        folderId: mathFolder.id,
      },
    });

    const worksheet3 = await prisma.worksheet.create({
      data: {
        title: 'Kinematic Equations',
        description: 'Physics motion calculations',
        content: {
          cells: [
            {
              id: 'cell-1',
              type: 'markdown',
              content: '# Kinematic Equations\n\n## Distance with acceleration',
            },
            {
              id: 'cell-2',
              type: 'calculation',
              expression: 'v0 * t + 0.5 * a * t^2',
              variables: { v0: 10, t: 5, a: 9.8 },
              result: '172.5',
            },
          ],
        },
        visibility: WorksheetVisibility.UNLISTED,
        userId: testUser.id,
        folderId: physicsFolder.id,
      },
    });

    console.log(`✅ Created worksheets: ${worksheet1.title}, ${worksheet2.title}, ${worksheet3.title}\n`);

    // Create forum posts
    console.log('Creating forum posts...');

    const post1 = await prisma.forumPost.create({
      data: {
        title: 'How do I plot a 3D surface?',
        content: 'I want to visualize z = sin(x) * cos(y). How do I do this in NextCalc Pro?',
        tags: ['plotting', '3d', 'help'],
        userId: testUser.id,
        isPinned: false,
      },
    });

    const post2 = await prisma.forumPost.create({
      data: {
        title: 'Welcome to NextCalc Pro!',
        content: 'This is a community forum for discussing math, calculations, and features. Feel free to ask questions!',
        tags: ['announcement', 'welcome'],
        userId: adminUser.id,
        isPinned: true,
      },
    });

    console.log(`✅ Created forum posts: ${post1.title}, ${post2.title}\n`);

    // Create comments
    console.log('Creating comments...');

    const comment1 = await prisma.comment.create({
      data: {
        content: 'Go to the Plot page and select "3D Surface" from the dropdown. Then enter your function!',
        postId: post1.id,
        userId: adminUser.id,
      },
    });

    await prisma.comment.create({
      data: {
        content: 'Thanks! That worked perfectly!',
        postId: post1.id,
        userId: testUser.id,
        parentId: comment1.id,
      },
    });

    console.log(`✅ Created ${2} comments\n`);

    // Create upvotes
    console.log('Creating upvotes...');

    await prisma.upvote.create({
      data: {
        userId: testUser.id,
        targetId: post2.id,
        targetType: 'POST',
      },
    });

    await prisma.upvote.create({
      data: {
        userId: testUser.id,
        targetId: comment1.id,
        targetType: 'COMMENT',
      },
    });

    console.log(`✅ Created upvotes\n`);

    // Create audit logs
    console.log('Creating audit logs...');

    await prisma.auditLog.createMany({
      data: [
        {
          userId: testUser.id,
          action: 'create',
          entity: 'worksheet',
          entityId: worksheet1.id,
          metadata: { title: worksheet1.title },
        },
        {
          userId: testUser.id,
          action: 'create',
          entity: 'worksheet',
          entityId: worksheet2.id,
          metadata: { title: worksheet2.title },
        },
        {
          userId: adminUser.id,
          action: 'create',
          entity: 'post',
          entityId: post2.id,
          metadata: { title: post2.title },
        },
      ],
    });

    console.log(`✅ Created audit logs\n`);

    // Summary
    const stats = {
      users: await prisma.user.count(),
      folders: await prisma.folder.count(),
      worksheets: await prisma.worksheet.count(),
      posts: await prisma.forumPost.count(),
      comments: await prisma.comment.count(),
      upvotes: await prisma.upvote.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log('📊 Database Statistics:');
    console.log(`   Users: ${stats.users}`);
    console.log(`   Folders: ${stats.folders}`);
    console.log(`   Worksheets: ${stats.worksheets}`);
    console.log(`   Forum Posts: ${stats.posts}`);
    console.log(`   Comments: ${stats.comments}`);
    console.log(`   Upvotes: ${stats.upvotes}`);
    console.log(`   Audit Logs: ${stats.auditLogs}`);
    console.log('');

    console.log('🎉 Database seeded successfully!\n');
    console.log('Test accounts:');
    console.log('   test@nextcalc.pro (USER)');
    console.log('   admin@nextcalc.pro (ADMIN)');
    console.log('');
    console.log('View data in Prisma Studio: pnpm prisma studio');
    console.log('');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seed()
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
