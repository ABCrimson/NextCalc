/**
 * Validation Module Tests
 *
 * Tests Zod schemas, the validate() helper, sanitizeHtml(), and
 * sanitizeSearchQuery() exported from src/lib/validation.ts.
 *
 * No external dependencies are required — these are pure functions
 * operating on in-memory data.
 */

import { describe, expect, it } from 'vitest';
import {
  idSchema,
  emailSchema,
  nameSchema,
  urlSchema,
  textSchema,
  markdownSchema,
  createWorksheetSchema,
  updateWorksheetSchema,
  createForumPostSchema,
  updateForumPostSchema,
  createCommentSchema,
  updateCommentSchema,
  shareCalculationSchema,
  shareWorksheetSchema,
  calculationSchema,
  paginationSchema,
  createFolderSchema,
  updateFolderSchema,
  worksheetFilterSchema,
  forumPostFilterSchema,
  updateUserProfileSchema,
  validate,
  sanitizeHtml,
  sanitizeSearchQuery,
} from '../../lib/validation';
import { ValidationError } from '../../lib/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a valid-looking CUID (starts with 'c', 25 alphanumeric chars). */
function fakeCuid(): string {
  return 'clxxxxxxxxxxxxxxxxxxxxxxx';
}

/** Builds a minimal valid worksheet input. */
function validWorksheetInput() {
  return {
    title: 'My worksheet',
    content: {
      cells: [{ id: '1', type: 'expression' as const, content: '2+2' }],
    },
  };
}

/** Builds a minimal valid forum post input. */
function validForumPostInput() {
  return {
    title: 'How do I solve this?',
    content: 'I have been trying to solve this integral for a while and need help.',
    tags: ['calculus'],
  };
}

// ============================================================================
// 1. Basic Schema Validations
// ============================================================================

describe('Basic schemas', () => {
  // ---------- idSchema ----------
  describe('idSchema', () => {
    it('accepts a valid CUID', () => {
      const cuid = fakeCuid();
      expect(idSchema.safeParse(cuid).success).toBe(true);
    });

    it('rejects an empty string', () => {
      expect(idSchema.safeParse('').success).toBe(false);
    });

    it('rejects a plain number string', () => {
      expect(idSchema.safeParse('12345').success).toBe(false);
    });
  });

  // ---------- emailSchema ----------
  describe('emailSchema', () => {
    it('accepts a standard email', () => {
      expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    });

    it('rejects a string without @', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    });

    it('rejects an email exceeding 255 characters', () => {
      const longLocal = 'a'.repeat(250);
      const email = `${longLocal}@example.com`;
      expect(email.length).toBeGreaterThan(255);
      expect(emailSchema.safeParse(email).success).toBe(false);
    });

    it('accepts an email at exactly 255 characters', () => {
      // "x...x@e.co" — local part sized so total is 255
      const suffix = '@e.co';
      const local = 'a'.repeat(255 - suffix.length);
      const email = `${local}${suffix}`;
      expect(email.length).toBe(255);
      expect(emailSchema.safeParse(email).success).toBe(true);
    });
  });

  // ---------- nameSchema ----------
  describe('nameSchema', () => {
    it('accepts a normal name', () => {
      expect(nameSchema.safeParse('Alice').success).toBe(true);
    });

    it('trims leading/trailing whitespace', () => {
      const result = nameSchema.safeParse('  Bob  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Bob');
      }
    });

    it('rejects an empty string', () => {
      expect(nameSchema.safeParse('').success).toBe(false);
    });

    it('passes whitespace-only string (min check runs before trim transform)', () => {
      // Zod 4: .min(1) checks raw input length (3), then .trim() transforms to "".
      // This is a known Zod ordering behavior — min runs on pre-trim value.
      const result = nameSchema.safeParse('   ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('');
      }
    });

    it('rejects a string exceeding 255 characters', () => {
      expect(nameSchema.safeParse('x'.repeat(256)).success).toBe(false);
    });

    it('accepts a string of exactly 255 characters', () => {
      expect(nameSchema.safeParse('x'.repeat(255)).success).toBe(true);
    });
  });

  // ---------- urlSchema ----------
  describe('urlSchema', () => {
    it('accepts a valid URL', () => {
      expect(urlSchema.safeParse('https://example.com').success).toBe(true);
    });

    it('rejects a non-URL string', () => {
      expect(urlSchema.safeParse('not a url').success).toBe(false);
    });

    it('rejects a URL exceeding 2048 characters', () => {
      const longUrl = `https://example.com/${'a'.repeat(2048)}`;
      expect(urlSchema.safeParse(longUrl).success).toBe(false);
    });
  });

  // ---------- textSchema ----------
  describe('textSchema', () => {
    it('accepts a normal string', () => {
      expect(textSchema.safeParse('Hello world').success).toBe(true);
    });

    it('trims whitespace', () => {
      const result = textSchema.safeParse('  trimmed  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('trimmed');
      }
    });

    it('rejects a string exceeding 10000 characters', () => {
      expect(textSchema.safeParse('x'.repeat(10001)).success).toBe(false);
    });

    it('accepts exactly 10000 characters', () => {
      expect(textSchema.safeParse('x'.repeat(10000)).success).toBe(true);
    });
  });

  // ---------- markdownSchema ----------
  describe('markdownSchema', () => {
    it('accepts normal markdown', () => {
      expect(markdownSchema.safeParse('# Hello\n\nParagraph text').success).toBe(true);
    });

    it('rejects content exceeding 50000 characters', () => {
      expect(markdownSchema.safeParse('x'.repeat(50001)).success).toBe(false);
    });

    it('accepts exactly 50000 characters', () => {
      expect(markdownSchema.safeParse('x'.repeat(50000)).success).toBe(true);
    });

    it('trims whitespace', () => {
      const result = markdownSchema.safeParse('  content  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('content');
      }
    });
  });
});

// ============================================================================
// 2. Domain Schema Validations
// ============================================================================

describe('Domain schemas', () => {
  // ---------- createWorksheetSchema ----------
  describe('createWorksheetSchema', () => {
    it('accepts valid input', () => {
      const result = createWorksheetSchema.safeParse(validWorksheetInput());
      expect(result.success).toBe(true);
    });

    it('accepts input with all optional fields', () => {
      const input = {
        ...validWorksheetInput(),
        description: 'A description',
        visibility: 'PUBLIC' as const,
        folderId: fakeCuid(),
      };
      expect(createWorksheetSchema.safeParse(input).success).toBe(true);
    });

    it('rejects missing title', () => {
      const { title: _, ...noTitle } = validWorksheetInput();
      expect(createWorksheetSchema.safeParse(noTitle).success).toBe(false);
    });

    it('rejects empty title', () => {
      const input = { ...validWorksheetInput(), title: '' };
      expect(createWorksheetSchema.safeParse(input).success).toBe(false);
    });

    it('rejects missing content', () => {
      const { content: _, ...noContent } = validWorksheetInput();
      expect(createWorksheetSchema.safeParse(noContent).success).toBe(false);
    });

    it('rejects more than 100 cells', () => {
      const cells = Array.from({ length: 101 }, (_, i) => ({
        id: String(i),
        type: 'expression' as const,
        content: `${i}+1`,
      }));
      const input = { ...validWorksheetInput(), content: { cells } };
      expect(createWorksheetSchema.safeParse(input).success).toBe(false);
    });

    it('accepts exactly 100 cells', () => {
      const cells = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        type: 'expression' as const,
        content: `${i}+1`,
      }));
      const input = { ...validWorksheetInput(), content: { cells } };
      expect(createWorksheetSchema.safeParse(input).success).toBe(true);
    });

    it('rejects invalid cell type', () => {
      const input = {
        ...validWorksheetInput(),
        content: { cells: [{ id: '1', type: 'unknown', content: 'x' }] },
      };
      expect(createWorksheetSchema.safeParse(input).success).toBe(false);
    });

    it('rejects invalid visibility enum', () => {
      const input = { ...validWorksheetInput(), visibility: 'HIDDEN' };
      expect(createWorksheetSchema.safeParse(input).success).toBe(false);
    });
  });

  // ---------- updateWorksheetSchema ----------
  describe('updateWorksheetSchema', () => {
    it('accepts a partial update with only title', () => {
      expect(updateWorksheetSchema.safeParse({ title: 'New Title' }).success).toBe(true);
    });

    it('accepts nullable folderId', () => {
      expect(updateWorksheetSchema.safeParse({ folderId: null }).success).toBe(true);
    });

    it('accepts empty object (all optional)', () => {
      expect(updateWorksheetSchema.safeParse({}).success).toBe(true);
    });
  });

  // ---------- createForumPostSchema ----------
  describe('createForumPostSchema', () => {
    it('accepts valid input', () => {
      expect(createForumPostSchema.safeParse(validForumPostInput()).success).toBe(true);
    });

    it('rejects title shorter than 3 characters', () => {
      const input = { ...validForumPostInput(), title: 'ab' };
      expect(createForumPostSchema.safeParse(input).success).toBe(false);
    });

    it('accepts title of exactly 3 characters', () => {
      const input = { ...validForumPostInput(), title: 'abc' };
      expect(createForumPostSchema.safeParse(input).success).toBe(true);
    });

    it('rejects title exceeding 255 characters', () => {
      const input = { ...validForumPostInput(), title: 'x'.repeat(256) };
      expect(createForumPostSchema.safeParse(input).success).toBe(false);
    });

    it('rejects content shorter than 10 characters', () => {
      const input = { ...validForumPostInput(), content: 'Too short' };
      expect(createForumPostSchema.safeParse(input).success).toBe(false);
    });

    it('accepts content of exactly 10 characters', () => {
      const input = { ...validForumPostInput(), content: 'x'.repeat(10) };
      expect(createForumPostSchema.safeParse(input).success).toBe(true);
    });

    it('rejects empty tags array', () => {
      const input = { ...validForumPostInput(), tags: [] };
      expect(createForumPostSchema.safeParse(input).success).toBe(false);
    });

    it('rejects more than 5 tags', () => {
      const input = { ...validForumPostInput(), tags: ['a', 'b', 'c', 'd', 'e', 'f'] };
      expect(createForumPostSchema.safeParse(input).success).toBe(false);
    });

    it('accepts exactly 5 tags', () => {
      const input = { ...validForumPostInput(), tags: ['a', 'b', 'c', 'd', 'e'] };
      expect(createForumPostSchema.safeParse(input).success).toBe(true);
    });

    it('rejects a tag exceeding 50 characters', () => {
      const input = { ...validForumPostInput(), tags: ['x'.repeat(51)] };
      expect(createForumPostSchema.safeParse(input).success).toBe(false);
    });

    it('rejects missing tags field', () => {
      const { tags: _, ...noTags } = validForumPostInput();
      expect(createForumPostSchema.safeParse(noTags).success).toBe(false);
    });
  });

  // ---------- updateForumPostSchema ----------
  describe('updateForumPostSchema', () => {
    it('accepts partial update with only title', () => {
      expect(updateForumPostSchema.safeParse({ title: 'New title' }).success).toBe(true);
    });

    it('accepts empty object', () => {
      expect(updateForumPostSchema.safeParse({}).success).toBe(true);
    });

    it('rejects invalid tag length', () => {
      expect(updateForumPostSchema.safeParse({ tags: ['x'.repeat(51)] }).success).toBe(false);
    });
  });

  // ---------- createCommentSchema ----------
  describe('createCommentSchema', () => {
    it('accepts valid input', () => {
      const input = { postId: fakeCuid(), content: 'Great post!' };
      expect(createCommentSchema.safeParse(input).success).toBe(true);
    });

    it('requires postId', () => {
      expect(createCommentSchema.safeParse({ content: 'Great post!' }).success).toBe(false);
    });

    it('requires content', () => {
      expect(createCommentSchema.safeParse({ postId: fakeCuid() }).success).toBe(false);
    });

    it('rejects empty content', () => {
      const input = { postId: fakeCuid(), content: '' };
      expect(createCommentSchema.safeParse(input).success).toBe(false);
    });

    it('rejects content exceeding 5000 characters', () => {
      const input = { postId: fakeCuid(), content: 'x'.repeat(5001) };
      expect(createCommentSchema.safeParse(input).success).toBe(false);
    });

    it('accepts content of exactly 5000 characters', () => {
      const input = { postId: fakeCuid(), content: 'x'.repeat(5000) };
      expect(createCommentSchema.safeParse(input).success).toBe(true);
    });

    it('accepts optional parentId for nested comments', () => {
      const input = { postId: fakeCuid(), content: 'Reply', parentId: fakeCuid() };
      expect(createCommentSchema.safeParse(input).success).toBe(true);
    });

    it('trims content whitespace', () => {
      const input = { postId: fakeCuid(), content: '  trimmed  ' };
      const result = createCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('trimmed');
      }
    });
  });

  // ---------- updateCommentSchema ----------
  describe('updateCommentSchema', () => {
    it('accepts valid content', () => {
      expect(updateCommentSchema.safeParse({ content: 'Updated' }).success).toBe(true);
    });

    it('rejects empty content', () => {
      expect(updateCommentSchema.safeParse({ content: '' }).success).toBe(false);
    });
  });

  // ---------- shareCalculationSchema ----------
  describe('shareCalculationSchema', () => {
    it('accepts valid input with required fields', () => {
      const input = { latex: '\\frac{1}{2}', expression: '1/2' };
      expect(shareCalculationSchema.safeParse(input).success).toBe(true);
    });

    it('requires latex', () => {
      expect(shareCalculationSchema.safeParse({ expression: '1/2' }).success).toBe(false);
    });

    it('requires expression', () => {
      expect(shareCalculationSchema.safeParse({ latex: '\\frac{1}{2}' }).success).toBe(false);
    });

    it('rejects empty latex', () => {
      const input = { latex: '', expression: '1/2' };
      expect(shareCalculationSchema.safeParse(input).success).toBe(false);
    });

    it('rejects empty expression', () => {
      const input = { latex: '\\frac{1}{2}', expression: '' };
      expect(shareCalculationSchema.safeParse(input).success).toBe(false);
    });

    it('accepts all optional fields', () => {
      const input = {
        latex: '\\frac{1}{2}',
        expression: '1/2',
        title: 'Half',
        description: 'One divided by two',
        result: '0.5',
      };
      expect(shareCalculationSchema.safeParse(input).success).toBe(true);
    });

    it('rejects latex exceeding 10000 characters', () => {
      const input = { latex: 'x'.repeat(10001), expression: '1/2' };
      expect(shareCalculationSchema.safeParse(input).success).toBe(false);
    });
  });

  // ---------- shareWorksheetSchema ----------
  describe('shareWorksheetSchema', () => {
    it('accepts valid input', () => {
      const input = {
        worksheetId: fakeCuid(),
        sharedWith: 'user@example.com',
        permission: 'VIEW' as const,
      };
      expect(shareWorksheetSchema.safeParse(input).success).toBe(true);
    });

    it('rejects invalid permission enum', () => {
      const input = {
        worksheetId: fakeCuid(),
        sharedWith: 'user@example.com',
        permission: 'ADMIN',
      };
      expect(shareWorksheetSchema.safeParse(input).success).toBe(false);
    });
  });

  // ---------- calculationSchema ----------
  describe('calculationSchema', () => {
    it('accepts a simple expression', () => {
      expect(calculationSchema.safeParse({ expression: '2+2' }).success).toBe(true);
    });

    it('accepts expression with optional fields', () => {
      const input = { expression: 'x+1', variables: { x: 5 }, precision: 32 };
      expect(calculationSchema.safeParse(input).success).toBe(true);
    });

    it('rejects precision above 64', () => {
      const input = { expression: '2+2', precision: 65 };
      expect(calculationSchema.safeParse(input).success).toBe(false);
    });

    it('rejects precision below 1', () => {
      const input = { expression: '2+2', precision: 0 };
      expect(calculationSchema.safeParse(input).success).toBe(false);
    });

    it('rejects non-integer precision', () => {
      const input = { expression: '2+2', precision: 10.5 };
      expect(calculationSchema.safeParse(input).success).toBe(false);
    });
  });

  // ---------- paginationSchema ----------
  describe('paginationSchema', () => {
    it('defaults limit to 20 when not provided', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('accepts a custom limit within range', () => {
      const result = paginationSchema.safeParse({ limit: 50 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('rejects limit above 100', () => {
      expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('rejects limit below 1', () => {
      expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('accepts an optional cursor', () => {
      const result = paginationSchema.safeParse({ cursor: fakeCuid() });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cursor).toBe(fakeCuid());
      }
    });

    it('rejects invalid cursor format', () => {
      expect(paginationSchema.safeParse({ cursor: 'not-a-cuid' }).success).toBe(false);
    });
  });

  // ---------- createFolderSchema ----------
  describe('createFolderSchema', () => {
    it('accepts valid input', () => {
      expect(createFolderSchema.safeParse({ name: 'My Folder' }).success).toBe(true);
    });

    it('rejects empty name', () => {
      expect(createFolderSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('rejects name exceeding 100 characters', () => {
      expect(createFolderSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
    });

    it('accepts optional parentId', () => {
      const input = { name: 'Sub Folder', parentId: fakeCuid() };
      expect(createFolderSchema.safeParse(input).success).toBe(true);
    });
  });

  // ---------- updateFolderSchema ----------
  describe('updateFolderSchema', () => {
    it('accepts partial update', () => {
      expect(updateFolderSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
    });

    it('accepts nullable parentId to move to root', () => {
      expect(updateFolderSchema.safeParse({ parentId: null }).success).toBe(true);
    });
  });

  // ---------- worksheetFilterSchema ----------
  describe('worksheetFilterSchema', () => {
    it('accepts empty object', () => {
      expect(worksheetFilterSchema.safeParse({}).success).toBe(true);
    });

    it('accepts visibility filter', () => {
      expect(worksheetFilterSchema.safeParse({ visibility: 'PUBLIC' }).success).toBe(true);
    });

    it('rejects search query exceeding 100 characters', () => {
      expect(worksheetFilterSchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false);
    });
  });

  // ---------- forumPostFilterSchema ----------
  describe('forumPostFilterSchema', () => {
    it('accepts empty object', () => {
      expect(forumPostFilterSchema.safeParse({}).success).toBe(true);
    });

    it('accepts boolean filters', () => {
      const input = { isPinned: true, isClosed: false };
      expect(forumPostFilterSchema.safeParse(input).success).toBe(true);
    });
  });

  // ---------- updateUserProfileSchema ----------
  describe('updateUserProfileSchema', () => {
    it('accepts valid name', () => {
      expect(updateUserProfileSchema.safeParse({ name: 'Alice' }).success).toBe(true);
    });

    it('rejects name exceeding 100 characters', () => {
      expect(updateUserProfileSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
    });

    it('rejects bio exceeding 500 characters', () => {
      expect(updateUserProfileSchema.safeParse({ bio: 'x'.repeat(501) }).success).toBe(false);
    });

    it('validates image as URL', () => {
      expect(
        updateUserProfileSchema.safeParse({ image: 'not-a-url' }).success,
      ).toBe(false);
    });

    it('accepts valid image URL', () => {
      expect(
        updateUserProfileSchema.safeParse({ image: 'https://example.com/avatar.png' }).success,
      ).toBe(true);
    });
  });
});

// ============================================================================
// 3. validate() function
// ============================================================================

describe('validate()', () => {
  it('returns parsed data on valid input', () => {
    const data = validate(nameSchema, '  Alice  ');
    expect(data).toBe('Alice');
  });

  it('returns parsed data with defaults applied', () => {
    const data = validate(paginationSchema, {});
    expect(data.limit).toBe(20);
  });

  it('throws ValidationError on invalid input', () => {
    expect(() => validate(nameSchema, '')).toThrow(ValidationError);
  });

  it('thrown error has code BAD_USER_INPUT', () => {
    try {
      validate(nameSchema, '');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as InstanceType<typeof ValidationError>;
      expect(ve.extensions?.code).toBe('BAD_USER_INPUT');
    }
  });

  it('thrown error message contains "Validation failed"', () => {
    try {
      validate(emailSchema, 'bad');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as Error).message).toContain('Validation failed');
    }
  });

  it('groups errors by field path in validationErrors extension', () => {
    try {
      validate(createForumPostSchema, { title: 'ab', content: 'short', tags: [] });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as InstanceType<typeof ValidationError>;
      const fieldErrors = ve.extensions?.validationErrors as Record<string, string[]>;

      // title too short => "title" key
      expect(fieldErrors).toHaveProperty('title');
      expect(Array.isArray(fieldErrors['title'])).toBe(true);
      expect(fieldErrors['title']!.length).toBeGreaterThan(0);

      // content too short => "content" key
      expect(fieldErrors).toHaveProperty('content');

      // tags empty => "tags" key
      expect(fieldErrors).toHaveProperty('tags');
    }
  });

  it('uses _root path for top-level schema errors', () => {
    try {
      // idSchema has no nested path — error should be keyed as "_root"
      validate(idSchema, 'not-a-cuid');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as InstanceType<typeof ValidationError>;
      const fieldErrors = ve.extensions?.validationErrors as Record<string, string[]>;
      expect(fieldErrors).toHaveProperty('_root');
    }
  });

  it('includes nested field paths with dot notation', () => {
    try {
      // Missing required cell fields triggers nested path errors
      validate(createWorksheetSchema, {
        title: 'Test',
        content: { cells: [{ id: '1' }] },
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as InstanceType<typeof ValidationError>;
      const fieldErrors = ve.extensions?.validationErrors as Record<string, string[]>;
      // Should have paths like "content.cells.0.type" or "content.cells.0.content"
      const paths = Object.keys(fieldErrors);
      const hasNestedPath = paths.some((p) => p.includes('.'));
      expect(hasNestedPath).toBe(true);
    }
  });
});

// ============================================================================
// 4. sanitizeHtml()
// ============================================================================

describe('sanitizeHtml()', () => {
  it('strips script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('strips script tags with attributes', () => {
    const input = '<script type="text/javascript">evil()</script>';
    expect(sanitizeHtml(input)).toBe('');
  });

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtml(input)).toBe('');
  });

  it('strips iframe tags with content', () => {
    const input = '<p>Before</p><iframe src="x">fallback</iframe><p>After</p>';
    expect(sanitizeHtml(input)).toBe('<p>Before</p><p>After</p>');
  });

  it('strips double-quoted onclick handlers', () => {
    const input = '<button onclick="alert(1)">Click</button>';
    expect(sanitizeHtml(input)).toBe('<button >Click</button>');
  });

  it('strips single-quoted onmouseover handlers', () => {
    const input = "<div onmouseover='hack()'>Hover</div>";
    expect(sanitizeHtml(input)).toBe('<div >Hover</div>');
  });

  it('strips multiple event handlers', () => {
    const input = '<a onclick="x()" onmouseover="y()">link</a>';
    expect(sanitizeHtml(input)).toBe('<a  >link</a>');
  });

  it('preserves normal HTML content', () => {
    const input = '<h1>Title</h1><p>Paragraph with <strong>bold</strong></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('preserves plain text without HTML', () => {
    const input = 'Just some text with no tags';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('trims leading and trailing whitespace', () => {
    const input = '  <p>Content</p>  ';
    expect(sanitizeHtml(input)).toBe('<p>Content</p>');
  });

  it('handles nested script tags', () => {
    const input = '<script><script>nested</script></script>rest';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
  });

  it('is case-insensitive for script tags', () => {
    const input = '<SCRIPT>alert(1)</SCRIPT>';
    expect(sanitizeHtml(input)).toBe('');
  });

  it('is case-insensitive for iframe tags', () => {
    const input = '<IFRAME src="evil"></IFRAME>';
    expect(sanitizeHtml(input)).toBe('');
  });

  it('handles empty string input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

// ============================================================================
// 5. sanitizeSearchQuery()
// ============================================================================

describe('sanitizeSearchQuery()', () => {
  it('preserves alphanumeric characters', () => {
    expect(sanitizeSearchQuery('abc123')).toBe('abc123');
  });

  it('preserves spaces', () => {
    expect(sanitizeSearchQuery('hello world')).toBe('hello world');
  });

  it('preserves hyphens', () => {
    expect(sanitizeSearchQuery('first-class')).toBe('first-class');
  });

  it('preserves underscores', () => {
    expect(sanitizeSearchQuery('snake_case')).toBe('snake_case');
  });

  it('removes special characters', () => {
    expect(sanitizeSearchQuery("hello!@#$%^&*()+=world")).toBe('helloworld');
  });

  it('removes SQL injection characters', () => {
    // ' and ; are removed by [^\w\s-], then .trim() strips leading space
    expect(sanitizeSearchQuery("'; DROP TABLE users; --")).toBe('DROP TABLE users --');
  });

  it('removes quotes and semicolons', () => {
    expect(sanitizeSearchQuery('"hello"')).toBe('hello');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeSearchQuery('  search term  ')).toBe('search term');
  });

  it('limits output to 100 characters', () => {
    const longQuery = 'a'.repeat(200);
    expect(sanitizeSearchQuery(longQuery).length).toBeLessThanOrEqual(100);
  });

  it('limits to exactly 100 characters for long input', () => {
    const longQuery = 'abcdefghij'.repeat(20); // 200 chars, all alphanumeric
    expect(sanitizeSearchQuery(longQuery).length).toBe(100);
  });

  it('handles empty string', () => {
    expect(sanitizeSearchQuery('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  it('preserves mixed valid content', () => {
    expect(sanitizeSearchQuery('linear-algebra 101')).toBe('linear-algebra 101');
  });
});
