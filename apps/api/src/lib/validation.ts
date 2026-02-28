/**
 * Input Validation with Zod
 *
 * Defines validation schemas for all GraphQL inputs to ensure:
 * - Type safety at runtime
 * - Data integrity
 * - Security (sanitization, length limits)
 *
 * @see https://zod.dev
 */

import { z } from 'zod';
import { ValidationError } from './errors';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const idSchema = z.cuid();

export const emailSchema = z.email().max(255);

export const nameSchema = z.string().min(1).max(255).trim();

export const urlSchema = z.url().max(2048);

export const textSchema = z.string().max(10000).trim();

export const markdownSchema = z.string().max(50000).trim();

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  image: urlSchema.optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

// ============================================================================
// WORKSHEET SCHEMAS
// ============================================================================

const worksheetCellSchema = z.object({
  id: z.string(),
  type: z.enum(['expression', 'markdown', 'plot']),
  content: z.string(),
  result: z.string().optional(),
});

const worksheetContentSchema = z.object({
  cells: z.array(worksheetCellSchema).max(100), // Limit 100 cells per worksheet
});

export const createWorksheetSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  content: worksheetContentSchema,
  visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).optional(),
  folderId: idSchema.optional(),
});

export type CreateWorksheetInput = z.infer<typeof createWorksheetSchema>;

export const updateWorksheetSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  content: worksheetContentSchema.optional(),
  visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).optional(),
  folderId: idSchema.nullable().optional(),
});

export type UpdateWorksheetInput = z.infer<typeof updateWorksheetSchema>;

// ============================================================================
// FOLDER SCHEMAS
// ============================================================================

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  parentId: idSchema.optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  parentId: idSchema.nullable().optional(),
});

export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

// ============================================================================
// FORUM SCHEMAS
// ============================================================================

export const createForumPostSchema = z.object({
  title: z.string().min(3).max(255).trim(),
  content: markdownSchema.min(10),
  tags: z.array(z.string().min(1).max(50).trim()).min(1).max(5),
});

export type CreateForumPostInput = z.infer<typeof createForumPostSchema>;

export const updateForumPostSchema = z.object({
  title: z.string().min(3).max(255).trim().optional(),
  content: markdownSchema.min(10).optional(),
  tags: z.array(z.string().min(1).max(50).trim()).min(1).max(5).optional(),
});

export type UpdateForumPostInput = z.infer<typeof updateForumPostSchema>;

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

export const createCommentSchema = z.object({
  postId: idSchema,
  content: z.string().min(1).max(5000).trim(),
  parentId: idSchema.optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// ============================================================================
// SHARE SCHEMAS
// ============================================================================

export const shareWorksheetSchema = z.object({
  worksheetId: idSchema,
  sharedWith: z.string().min(1).max(255).trim(), // Email or user ID
  permission: z.enum(['VIEW', 'EDIT']),
});

export type ShareWorksheetInput = z.infer<typeof shareWorksheetSchema>;

// ============================================================================
// SHARED CALCULATION SCHEMAS
// ============================================================================

export const shareCalculationSchema = z.object({
  latex: z.string().min(1).max(10000).trim(),
  expression: z.string().min(1).max(10000).trim(),
  title: z.string().max(255).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  result: z.string().max(10000).trim().optional(),
});

export type ShareCalculationInput = z.infer<typeof shareCalculationSchema>;

// ============================================================================
// CALCULATION SCHEMAS
// ============================================================================

export const calculationSchema = z.object({
  expression: z.string().min(1).max(10000),
  variables: z.record(z.string(), z.unknown()).optional(),
  precision: z.number().int().min(1).max(64).optional(),
});

export type CalculationInput = z.infer<typeof calculationSchema>;

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

export const worksheetFilterSchema = z.object({
  visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).optional(),
  folderId: idSchema.optional(),
  search: z.string().max(100).trim().optional(),
});

export type WorksheetFilterInput = z.infer<typeof worksheetFilterSchema>;

export const forumPostFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isClosed: z.boolean().optional(),
  search: z.string().max(100).trim().optional(),
});

export type ForumPostFilterInput = z.infer<typeof forumPostFilterSchema>;

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validate input against schema
 *
 * @param schema - Zod schema
 * @param input - Input to validate
 * @returns Validated and parsed input
 * @throws Error if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const err of result.error.issues) {
      const path = err.path.join('.') || '_root';
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(err.message);
    }
    const summary = result.error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`).join(', ');
    throw new ValidationError(`Validation failed: ${summary}`, undefined, fieldErrors);
  }

  return result.data;
}

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * Strips all HTML tags except safe ones for markdown
 */
export function sanitizeHtml(html: string): string {
  // Basic sanitization - in production use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .trim();
}

/**
 * Sanitize search query to prevent SQL injection
 *
 * Note: Prisma handles SQL injection, but we still validate
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[^\w\s-]/gi, '') // Remove special characters
    .trim()
    .slice(0, 100); // Limit length
}
