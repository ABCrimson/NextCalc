/**
 * Folder Resolvers
 *
 * Handles folder CRUD operations and hierarchical relationships.
 */

import type { Folder } from '@nextcalc/database';
import type { GraphQLContext } from '../../lib/context';
import { requireAuth, requireOwnership } from '../../lib/context';
import {
  buildConnection,
  buildCursorParams,
  type CursorPaginationArgs,
} from '../../lib/cursor-pagination';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import { createFolderSchema, updateFolderSchema, validate } from '../../lib/validation';

export const folderResolvers = {
  Query: {
    /**
     * Get folder by ID
     */
    folder: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);

      const folder = await context.prisma.folder.findUnique({
        where: { id: args.id },
      });

      if (!folder) {
        throw new NotFoundError('Folder', args.id);
      }

      // Only owner or admin can view folder
      if (folder.userId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError('You do not have permission to access this folder');
      }

      return folder;
    },

    /**
     * Get all folders for a user
     */
    folders: async (_parent: unknown, args: { userId?: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const targetUserId = args.userId || user.id;

      // Only allow viewing own folders unless admin
      if (targetUserId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError("You do not have permission to access other users' folders");
      }

      return context.prisma.folder.findMany({
        where: { userId: targetUserId },
        orderBy: { name: 'asc' },
      });
    },

    /**
     * Cursor-paginated folders (Relay-style)
     */
    foldersConnection: async (
      _parent: unknown,
      args: CursorPaginationArgs & {
        userId?: string;
      },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const targetUserId = args.userId || user.id;

      // Only allow viewing own folders unless admin
      if (targetUserId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError("You do not have permission to access other users' folders");
      }

      const where = { userId: targetUserId };
      const params = buildCursorParams(args);

      const [items, totalCount] = await Promise.all([
        context.prisma.folder.findMany({
          where,
          take: params.take,
          skip: params.skip,
          ...(params.cursor ? { cursor: params.cursor } : {}),
          orderBy: { name: 'asc' },
        }),
        context.prisma.folder.count({ where }),
      ]);

      return buildConnection(items, params, totalCount);
    },
  },

  Mutation: {
    /**
     * Create a new folder
     */
    createFolder: async (
      _parent: unknown,
      args: {
        input: {
          name: string;
          description?: string;
          parentId?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const input = validate(createFolderSchema, args.input);

      // Validate parent folder if provided
      if (input.parentId) {
        const parent = await context.prisma.folder.findUnique({
          where: { id: input.parentId },
        });

        if (!parent || parent.userId !== user.id) {
          throw new NotFoundError('Folder', input.parentId);
        }
      }

      // Check for duplicate folder name in same location
      const existing = await context.prisma.folder.findFirst({
        where: {
          userId: user.id,
          name: input.name,
          parentId: input.parentId || null,
        },
      });

      if (existing) {
        throw new ValidationError(
          'A folder with this name already exists in this location',
          'name',
        );
      }

      try {
        return await context.prisma.folder.create({
          data: {
            name: input.name,
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            userId: user.id,
          },
        });
      } catch (error) {
        // Handle TOCTOU race: unique constraint violation on (userId, name, parentId)
        if (
          error instanceof Error &&
          'code' in error &&
          (error as { code: string }).code === 'P2002'
        ) {
          throw new ValidationError(
            'A folder with this name already exists in this location',
            'name',
          );
        }
        throw error;
      }
    },

    /**
     * Update folder
     */
    updateFolder: async (
      _parent: unknown,
      args: {
        id: string;
        input: {
          name?: string;
          description?: string;
          parentId?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const input = validate(updateFolderSchema, args.input);

      const folder = await context.prisma.folder.findUnique({
        where: { id: args.id },
      });

      if (!folder) {
        throw new NotFoundError('Folder', args.id);
      }

      requireOwnership(context, folder.userId);

      // Prevent circular references
      if (input.parentId) {
        if (input.parentId === args.id) {
          throw new ValidationError('A folder cannot be its own parent', 'parentId');
        }

        // Check if new parent is a descendant of current folder (depth-limited).
        // Serial DataLoader loads are acceptable here — folder trees are shallow
        // in practice, and this runs only on folder moves (rare mutation path).
        const MAX_DEPTH = 10;
        let currentId: string | null = input.parentId;
        for (let depth = 0; depth < MAX_DEPTH && currentId; depth++) {
          const ancestor = await context.loaders.folderById.load(currentId);
          if (!ancestor?.parentId) break;
          if (ancestor.parentId === args.id) {
            throw new ValidationError('Cannot move folder to a descendant', 'parentId');
          }
          currentId = ancestor.parentId;
        }
      }

      // Check for duplicate name if renaming
      if (input.name && input.name !== folder.name) {
        const existing = await context.prisma.folder.findFirst({
          where: {
            userId: user.id,
            name: input.name,
            parentId: input.parentId !== undefined ? input.parentId : folder.parentId,
            id: { not: args.id },
          },
        });

        if (existing) {
          throw new ValidationError(
            'A folder with this name already exists in this location',
            'name',
          );
        }
      }

      return context.prisma.folder.update({
        where: { id: args.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        },
      });
    },

    /**
     * Delete folder
     */
    deleteFolder: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);

      const folder = await context.prisma.folder.findUnique({
        where: { id: args.id },
        include: {
          _count: { select: { worksheets: true, children: true } },
        },
      });

      if (!folder) {
        throw new NotFoundError('Folder', args.id);
      }

      requireOwnership(context, folder.userId);

      // Check if folder has worksheets or subfolders
      if (folder._count.worksheets > 0) {
        throw new ValidationError('Cannot delete folder containing worksheets', 'id');
      }

      if (folder._count.children > 0) {
        throw new ValidationError('Cannot delete folder containing subfolders', 'id');
      }

      // Delete must complete before audit log (FK constraint), so run sequentially
      await context.prisma.folder.delete({
        where: { id: args.id },
      });

      await context.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'delete',
          entity: 'folder',
          entityId: args.id,
          metadata: { name: folder.name },
        },
      });

      return true;
    },
  },

  Folder: {
    /**
     * Resolve folder owner (batched via DataLoader)
     */
    user: async (parent: Folder, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.userId);
    },

    /**
     * Resolve parent folder (batched via DataLoader)
     */
    parent: async (parent: Folder, _args: unknown, context: GraphQLContext) => {
      if (!parent.parentId) return null;
      return context.loaders.folderById.load(parent.parentId);
    },

    /**
     * Resolve child folders (batched via DataLoader)
     */
    children: async (parent: Folder, _args: unknown, context: GraphQLContext) => {
      return context.loaders.childFoldersByParentId.load(parent.id);
    },

    /**
     * Resolve worksheets in folder (batched via DataLoader)
     */
    worksheets: async (parent: Folder, _args: unknown, context: GraphQLContext) => {
      return context.loaders.worksheetsByFolderId.load(parent.id);
    },
  },
};
