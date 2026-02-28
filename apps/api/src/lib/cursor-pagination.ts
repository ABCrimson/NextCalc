/**
 * Cursor-based Pagination Utilities
 *
 * Provides helper functions for Relay-style cursor pagination using Prisma.
 * Cursors are opaque base64-encoded strings wrapping the record ID.
 *
 * @see https://relay.dev/graphql/connections.htm
 */

// ---------------------------------------------------------------------------
// Cursor encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Encode a record ID into an opaque cursor string.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(`cursor:${id}`).toString('base64url');
}

/**
 * Decode an opaque cursor string back to the original record ID.
 * Returns `null` when the cursor is invalid.
 */
export function decodeCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    if (!decoded.startsWith('cursor:')) return null;
    return decoded.slice('cursor:'.length);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape required from every database record used in a connection. */
interface Identifiable {
  id: string;
}

/** Arguments accepted by a cursor-paginated query. */
export interface CursorPaginationArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

/** The connection result returned to GraphQL. */
export interface CursorConnectionResult<T extends Identifiable> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Prisma argument builder
// ---------------------------------------------------------------------------

/**
 * Parameters passed to `prisma.<model>.findMany()` for cursor pagination.
 */
export interface PrismaCursorParams {
  take: number;
  skip: number;
  cursor: { id: string } | undefined;
}

/**
 * Validate and normalise cursor pagination arguments, returning the Prisma
 * parameters needed for the query.
 *
 * Supports forward pagination (`first` / `after`) and backward pagination
 * (`last` / `before`). When both directions are supplied, forward takes
 * precedence.
 *
 * @param args    Raw GraphQL arguments.
 * @param maxSize Hard upper-limit for page size (default 100).
 * @param defaultSize Default page size when none is provided (default 20).
 */
export function buildCursorParams(
  args: CursorPaginationArgs,
  maxSize = 100,
  defaultSize = 20,
): PrismaCursorParams & { isBackward: boolean; requestedSize: number } {
  const isBackward = args.last != null && args.first == null;

  const requestedSize = Math.min(
    Math.max((isBackward ? args.last : args.first) ?? defaultSize, 1),
    maxSize,
  );

  const cursorId = isBackward
    ? (args.before ? decodeCursor(args.before) : null)
    : (args.after ? decodeCursor(args.after) : null);

  // Fetch one extra item to determine has{Next,Previous}Page.
  const take = isBackward ? -(requestedSize + 1) : requestedSize + 1;

  return {
    take,
    skip: cursorId ? 1 : 0, // skip the cursor item itself
    cursor: cursorId ? { id: cursorId } : undefined,
    isBackward,
    requestedSize,
  };
}

// ---------------------------------------------------------------------------
// Connection builder
// ---------------------------------------------------------------------------

/**
 * Build a complete Relay-style connection from a list of database records.
 *
 * The list should be the raw result from `prisma.findMany()` using the params
 * from `buildCursorParams` (which fetches one extra item for boundary
 * detection).
 *
 * @param items       Raw Prisma result (may include the extra boundary item).
 * @param params      The params returned by `buildCursorParams`.
 * @param totalCount  Total number of matching records (from `prisma.count`).
 */
export function buildConnection<T extends Identifiable>(
  items: T[],
  params: ReturnType<typeof buildCursorParams>,
  totalCount: number,
): CursorConnectionResult<T> {
  const { isBackward, requestedSize } = params;

  let hasMore: boolean;
  let trimmed: T[];

  if (isBackward) {
    // Prisma returns results in reverse order when take is negative,
    // so the extra item (if present) is at the beginning.
    hasMore = items.length > requestedSize;
    trimmed = hasMore ? items.slice(1) : items;
  } else {
    hasMore = items.length > requestedSize;
    trimmed = hasMore ? items.slice(0, requestedSize) : items;
  }

  const edges = trimmed.map((item) => ({
    node: item,
    cursor: encodeCursor(item.id),
  }));

  const firstEdge = edges[0];
  const lastEdge = edges[edges.length - 1];
  const startCursor = firstEdge ? firstEdge.cursor : null;
  const endCursor = lastEdge ? lastEdge.cursor : null;

  return {
    edges,
    pageInfo: {
      hasNextPage: isBackward ? (params.cursor != null) : hasMore,
      hasPreviousPage: isBackward ? hasMore : (params.cursor != null),
      startCursor,
      endCursor,
    },
    totalCount,
  };
}
