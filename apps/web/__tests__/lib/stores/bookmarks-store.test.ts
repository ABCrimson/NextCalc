import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Bookmark, useBookmarksStore } from '@/lib/stores/bookmarks-store';

const makeBookmark = (
  id: string,
  type: Bookmark['type'] = 'topic',
): Omit<Bookmark, 'createdAt'> => ({
  id,
  type,
  title: `Bookmark ${id}`,
  path: `/learn/${id}`,
});

describe('bookmarks-store', () => {
  beforeEach(() => {
    useBookmarksStore.setState({ bookmarks: [] });
  });

  afterEach(() => {
    useBookmarksStore.setState({ bookmarks: [] });
  });

  describe('addBookmark', () => {
    it('adds a bookmark to the store', () => {
      const { addBookmark } = useBookmarksStore.getState();
      addBookmark(makeBookmark('topic:algebra'));

      const { bookmarks } = useBookmarksStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe('topic:algebra');
      expect(bookmarks[0].title).toBe('Bookmark topic:algebra');
      expect(bookmarks[0].createdAt).toBeTypeOf('number');
    });

    it('does not add duplicate bookmarks', () => {
      const { addBookmark } = useBookmarksStore.getState();
      addBookmark(makeBookmark('topic:algebra'));
      addBookmark(makeBookmark('topic:algebra'));

      const { bookmarks } = useBookmarksStore.getState();
      expect(bookmarks).toHaveLength(1);
    });

    it('adds multiple different bookmarks', () => {
      const { addBookmark } = useBookmarksStore.getState();
      addBookmark(makeBookmark('topic:algebra'));
      addBookmark(makeBookmark('topic:calculus'));
      addBookmark(makeBookmark('def:derivative', 'definition'));

      const { bookmarks } = useBookmarksStore.getState();
      expect(bookmarks).toHaveLength(3);
    });
  });

  describe('removeBookmark', () => {
    it('removes an existing bookmark', () => {
      const { addBookmark } = useBookmarksStore.getState();
      addBookmark(makeBookmark('topic:algebra'));
      addBookmark(makeBookmark('topic:calculus'));

      useBookmarksStore.getState().removeBookmark('topic:algebra');

      const { bookmarks } = useBookmarksStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe('topic:calculus');
    });

    it('does nothing for non-existent id', () => {
      const { addBookmark } = useBookmarksStore.getState();
      addBookmark(makeBookmark('topic:algebra'));

      useBookmarksStore.getState().removeBookmark('nonexistent');

      expect(useBookmarksStore.getState().bookmarks).toHaveLength(1);
    });
  });

  describe('isBookmarked', () => {
    it('returns true for an existing bookmark', () => {
      useBookmarksStore.getState().addBookmark(makeBookmark('topic:algebra'));
      expect(useBookmarksStore.getState().isBookmarked('topic:algebra')).toBe(true);
    });

    it('returns false for a non-existent bookmark', () => {
      expect(useBookmarksStore.getState().isBookmarked('nonexistent')).toBe(false);
    });
  });

  describe('toggleBookmark', () => {
    it('adds a bookmark when not present', () => {
      useBookmarksStore.getState().toggleBookmark(makeBookmark('topic:algebra'));
      expect(useBookmarksStore.getState().bookmarks).toHaveLength(1);
    });

    it('removes a bookmark when already present', () => {
      useBookmarksStore.getState().addBookmark(makeBookmark('topic:algebra'));
      useBookmarksStore.getState().toggleBookmark(makeBookmark('topic:algebra'));
      expect(useBookmarksStore.getState().bookmarks).toHaveLength(0);
    });
  });

  describe('getBookmarksByType', () => {
    it('filters bookmarks by type', () => {
      const store = useBookmarksStore.getState();
      store.addBookmark(makeBookmark('topic:algebra', 'topic'));
      store.addBookmark(makeBookmark('def:derivative', 'definition'));
      store.addBookmark(makeBookmark('topic:calculus', 'topic'));
      store.addBookmark(makeBookmark('prob:integral', 'problem'));

      const topics = useBookmarksStore.getState().getBookmarksByType('topic');
      expect(topics).toHaveLength(2);
      expect(topics.every((b) => b.type === 'topic')).toBe(true);
    });

    it('returns empty array when no bookmarks of type exist', () => {
      useBookmarksStore.getState().addBookmark(makeBookmark('topic:algebra', 'topic'));
      const formulas = useBookmarksStore.getState().getBookmarksByType('formula');
      expect(formulas).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('removes all bookmarks', () => {
      const store = useBookmarksStore.getState();
      store.addBookmark(makeBookmark('a'));
      store.addBookmark(makeBookmark('b'));
      store.addBookmark(makeBookmark('c'));

      store.clearAll();
      expect(useBookmarksStore.getState().bookmarks).toHaveLength(0);
    });
  });
});
