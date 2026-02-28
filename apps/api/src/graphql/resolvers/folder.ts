/**
 * Folder Resolvers
 *
 * Handles folder CRUD operations and hierarchical relationships.
 */

import type { GraphQLContext } from '../../lib/context';
import { requireAuth, requireOwnership } from '../../lib/context';
import type { Folder } from '@nextcalc/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';
import { validate, createFolderSchema, updateFolderSchema } from '../../lib/validation';
import {
  buildCursorParams,
  buildConnection,
  type CursorPaginationArgs,
} from '../../lib/cursor-pagination';

export const folderResolvers = {
  Query: {
    /**
     * Get folder by ID
     */
    folder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
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
    folders: async (
      _parent: unknown,
      args: { userId?: string },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const targetUserId = args.userId || user.id;

      // Only allow viewing own folders unless admin
      if (targetUserId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError('You do not have permission to access other users\' folders');
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
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const targetUserId = args.userId || user.id;

      // Only allow viewing own folders unless admin
      if (targetUserId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError('You do not have permission to access other users\' folders');
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
      context: GraphQLContext
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
        throw new ValidationError('A folder with this name already exists in this location', 'name');
      }

      return context.prisma.folder.create({
        data: {
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          ...(input.parentId ? { parentId: input.parentId } : {}),
          userId: user.id,
        },
      });
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
      context: GraphQLContext
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

        // Check if new parent is a descendant of current folder
        let current = await context.prisma.folder.findUnique({
          where: { id: input.parentId },
        });

        while (current?.parentId) {
          if (current.parentId === args.id) {
            throw new ValidationError('Cannot move folder to a descendant', 'parentId');
          }
          current = await context.prisma.folder.findUnique({
            where: { id: current.parentId },
          });
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
          throw new ValidationError('A folder with this name already exists in this location', 'name');
        }
      }

      return context.prisma.folder.update({
        where: { id: args.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.parentId ? { parentId: input.parentId } : {}),
        },
      });
    },

    /**
     * Delete folder
     */
    deleteFolder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      const folder = await context.prisma.folder.findUnique({
        where: { id: args.id },
        include: {
          worksheets: true,
          children: true,
        },
      });

      if (!folder) {
        throw new NotFoundError('Folder', args.id);
      }

      requireOwnership(context, folder.userId);

      // Check if folder has worksheets or subfolders
      if (folder.worksheets.length > 0) {
        throw new ValidationError('Cannot delete folder containing worksheets', 'id');
      }

      if (folder.children.length > 0) {
        throw new ValidationError('Cannot delete folder containing subfolders', 'id');
      }

      await context.prisma.folder.delete({
        where: { id: args.id },
      });

      // Create audit log
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
     * Resolve worksheets in folder
     */
    worksheets: async (parent: Folder, _args: unknown, context: GraphQLContext) => {
      return context.prisma.worksheet.findMany({
        where: {
          folderId: parent.id,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
      });
    },
  },
};
