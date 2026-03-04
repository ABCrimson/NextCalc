import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  buildCursorParams,
  buildConnection,
} from '../../lib/cursor-pagination';

// ---------------------------------------------------------------------------
// encodeCursor / decodeCursor
// ---------------------------------------------------------------------------

describe('encodeCursor / decodeCursor', () => {
  it('round-trips an id correctly', () => {
    const id = 'abc-123';
    const cursor = encodeCursor(id);
    expect(decodeCursor(cursor)).toBe(id);
  });

  it('round-trips a UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(decodeCursor(encodeCursor(id))).toBe(id);
  });

  it('round-trips an empty string id', () => {
    expect(decodeCursor(encodeCursor(''))).toBe('');
  });

  it('returns null for a completely invalid cursor', () => {
    expect(decodeCursor('not-a-valid-cursor!!!')).toBeNull();
  });

  it('returns null for a valid base64url string missing the "cursor:" prefix', () => {
    // Encode a string that does NOT start with "cursor:"
    const noPrefixCursor = Buffer.from('nope:abc').toString('base64url');
    expect(decodeCursor(noPrefixCursor)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('produces a base64url-safe string (no +, /, = characters)', () => {
    const cursor = encodeCursor('id-with-special-chars/+=');
    expect(cursor).not.toMatch(/[+/=]/);
  });
});

// ---------------------------------------------------------------------------
// buildCursorParams
// ---------------------------------------------------------------------------

describe('buildCursorParams', () => {
  it('uses default forward pagination when no args are supplied', () => {
    const params = buildCursorParams({});

    expect(params.isBackward).toBe(false);
    expect(params.requestedSize).toBe(20); // defaultSize
    expect(params.take).toBe(21); // requestedSize + 1 for boundary detection
    expect(params.skip).toBe(0);
    expect(params.cursor).toBeUndefined();
  });

  it('applies custom first with an after cursor', () => {
    const afterCursor = encodeCursor('item-42');
    const params = buildCursorParams({ first: 10, after: afterCursor });

    expect(params.isBackward).toBe(false);
    expect(params.requestedSize).toBe(10);
    expect(params.take).toBe(11);
    expect(params.skip).toBe(1); // skip the cursor item itself
    expect(params.cursor).toEqual({ id: 'item-42' });
  });

  it('supports backward pagination with last and before', () => {
    const beforeCursor = encodeCursor('item-99');
    const params = buildCursorParams({ last: 5, before: beforeCursor });

    expect(params.isBackward).toBe(true);
    expect(params.requestedSize).toBe(5);
    expect(params.take).toBe(-6); // -(requestedSize + 1) for backward
    expect(params.skip).toBe(1);
    expect(params.cursor).toEqual({ id: 'item-99' });
  });

  it('clamps requested size to maxSize (default 100)', () => {
    const params = buildCursorParams({ first: 500 });

    expect(params.requestedSize).toBe(100);
    expect(params.take).toBe(101);
  });

  it('clamps requested size to a custom maxSize', () => {
    const params = buildCursorParams({ first: 50 }, 25);

    expect(params.requestedSize).toBe(25);
    expect(params.take).toBe(26);
  });

  it('enforces a minimum size of 1', () => {
    const params = buildCursorParams({ first: 0 });

    expect(params.requestedSize).toBe(1);
    expect(params.take).toBe(2);
  });

  it('enforces minimum size of 1 for negative values', () => {
    const params = buildCursorParams({ first: -10 });

    expect(params.requestedSize).toBe(1);
    expect(params.take).toBe(2);
  });

  it('forward pagination takes precedence when both first and last are provided', () => {
    const params = buildCursorParams({ first: 10, last: 5 });

    expect(params.isBackward).toBe(false);
    expect(params.requestedSize).toBe(10);
    expect(params.take).toBe(11);
  });

  it('uses a custom defaultSize when no first/last is provided', () => {
    const params = buildCursorParams({}, 100, 50);

    expect(params.requestedSize).toBe(50);
    expect(params.take).toBe(51);
  });

  it('backward pagination without a cursor sets skip to 0 and cursor to undefined', () => {
    const params = buildCursorParams({ last: 10 });

    expect(params.isBackward).toBe(true);
    expect(params.skip).toBe(0);
    expect(params.cursor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildConnection
// ---------------------------------------------------------------------------

describe('buildConnection', () => {
  function makeItems(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i + 1}`,
      title: `Item ${i + 1}`,
    }));
  }

  it('returns an empty connection for an empty result set', () => {
    const params = buildCursorParams({});
    const connection = buildConnection([], params, 0);

    expect(connection.edges).toHaveLength(0);
    expect(connection.pageInfo.hasNextPage).toBe(false);
    expect(connection.pageInfo.hasPreviousPage).toBe(false);
    expect(connection.pageInfo.startCursor).toBeNull();
    expect(connection.pageInfo.endCursor).toBeNull();
    expect(connection.totalCount).toBe(0);
  });

  it('returns a single page when items fit exactly (no extra boundary item)', () => {
    const params = buildCursorParams({ first: 5 });
    // 5 items returned means no extra item => no next page
    const items = makeItems(5);
    const connection = buildConnection(items, params, 5);

    expect(connection.edges).toHaveLength(5);
    expect(connection.pageInfo.hasNextPage).toBe(false);
    expect(connection.pageInfo.hasPreviousPage).toBe(false);
    expect(connection.totalCount).toBe(5);
  });

  it('detects hasNextPage when forward pagination returns an extra item', () => {
    const params = buildCursorParams({ first: 3 });
    // 4 items returned (3 requested + 1 extra) => has next page
    const items = makeItems(4);
    const connection = buildConnection(items, params, 10);

    expect(connection.edges).toHaveLength(3);
    expect(connection.pageInfo.hasNextPage).toBe(true);
    expect(connection.pageInfo.hasPreviousPage).toBe(false);
    expect(connection.totalCount).toBe(10);
  });

  it('sets hasPreviousPage when forward pagination uses a cursor', () => {
    const afterCursor = encodeCursor('item-0');
    const params = buildCursorParams({ first: 3, after: afterCursor });
    const items = makeItems(3);
    const connection = buildConnection(items, params, 10);

    expect(connection.pageInfo.hasPreviousPage).toBe(true);
    expect(connection.pageInfo.hasNextPage).toBe(false);
  });

  it('detects hasPreviousPage for backward pagination with extra item', () => {
    const beforeCursor = encodeCursor('item-10');
    const params = buildCursorParams({ last: 3, before: beforeCursor });
    // 4 items returned => extra boundary item at index 0
    const items = makeItems(4);
    const connection = buildConnection(items, params, 10);

    expect(connection.edges).toHaveLength(3);
    expect(connection.pageInfo.hasPreviousPage).toBe(true);
    // hasNextPage is true because we have a cursor (backward from item-10)
    expect(connection.pageInfo.hasNextPage).toBe(true);
  });

  it('sets correct startCursor and endCursor', () => {
    const params = buildCursorParams({ first: 3 });
    const items = makeItems(3);
    const connection = buildConnection(items, params, 3);

    expect(connection.pageInfo.startCursor).toBe(encodeCursor('item-1'));
    expect(connection.pageInfo.endCursor).toBe(encodeCursor('item-3'));
  });

  it('passes totalCount through', () => {
    const params = buildCursorParams({ first: 2 });
    const items = makeItems(2);
    const connection = buildConnection(items, params, 999);

    expect(connection.totalCount).toBe(999);
  });

  it('builds edges with correct node and cursor pairs', () => {
    const params = buildCursorParams({ first: 2 });
    const items = makeItems(2);
    const connection = buildConnection(items, params, 2);

    expect(connection.edges[0]).toEqual({
      node: { id: 'item-1', title: 'Item 1' },
      cursor: encodeCursor('item-1'),
    });
    expect(connection.edges[1]).toEqual({
      node: { id: 'item-2', title: 'Item 2' },
      cursor: encodeCursor('item-2'),
    });
  });

  it('trims the extra boundary item from the end in forward pagination', () => {
    const params = buildCursorParams({ first: 2 });
    // 3 items => the third is the boundary item
    const items = makeItems(3);
    const connection = buildConnection(items, params, 5);

    const ids = connection.edges.map((e) => e.node.id);
    expect(ids).toEqual(['item-1', 'item-2']);
  });

  it('trims the extra boundary item from the start in backward pagination', () => {
    const params = buildCursorParams({ last: 2 });
    // 3 items in backward => the first is the boundary item
    const items = makeItems(3);
    const connection = buildConnection(items, params, 5);

    const ids = connection.edges.map((e) => e.node.id);
    // Boundary item (item-1) trimmed from start
    expect(ids).toEqual(['item-2', 'item-3']);
  });
});
