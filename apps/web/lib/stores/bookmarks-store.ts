/**
 * Bookmarks Store
 *
 * Zustand 5.0.11 store for learning bookmarks. Users can bookmark topics,
 * definitions, and problems for quick access. Persisted to localStorage.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Bookmark {
  /** Unique ID (type:slug format) */
  readonly id: string;
  /** What kind of content is bookmarked */
  readonly type: 'topic' | 'definition' | 'problem' | 'formula';
  /** Display title */
  readonly title: string;
  /** URL path (without locale prefix) */
  readonly path: string;
  /** When bookmarked */
  readonly createdAt: number;
  /** Optional metadata */
  readonly category?: string;
}

interface BookmarksState {
  readonly bookmarks: readonly Bookmark[];
}

interface BookmarksActions {
  addBookmark: (bookmark: Omit<Bookmark, 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (bookmark: Omit<Bookmark, 'createdAt'>) => void;
  getBookmarksByType: (type: Bookmark['type']) => readonly Bookmark[];
  clearAll: () => void;
}

type BookmarksStore = BookmarksState & BookmarksActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBookmarksStore = create<BookmarksStore>()(
  devtools(
    persist(
      (set, get) => ({
        bookmarks: [],

        addBookmark: (bookmark) => {
          const existing = get().bookmarks;
          if (existing.some((b) => b.id === bookmark.id)) return;
          set(
            {
              bookmarks: [...existing, { ...bookmark, createdAt: Date.now() }],
            },
            false,
            'addBookmark',
          );
        },

        removeBookmark: (id) => {
          set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) }, false, 'removeBookmark');
        },

        isBookmarked: (id) => get().bookmarks.some((b) => b.id === id),

        toggleBookmark: (bookmark) => {
          const state = get();
          if (state.bookmarks.some((b) => b.id === bookmark.id)) {
            set(
              { bookmarks: state.bookmarks.filter((b) => b.id !== bookmark.id) },
              false,
              'removeBookmark',
            );
          } else {
            set(
              {
                bookmarks: [...state.bookmarks, { ...bookmark, createdAt: Date.now() }],
              },
              false,
              'addBookmark',
            );
          }
        },

        getBookmarksByType: (type) => get().bookmarks.filter((b) => b.type === type),

        clearAll: () => {
          set({ bookmarks: [] }, false, 'clearAll');
        },
      }),
      {
        name: 'nextcalc-bookmarks-store',
      },
    ),
    {
      name: 'bookmarks-store',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export const useBookmarks = (): readonly Bookmark[] => useBookmarksStore((s) => s.bookmarks);

export const useBookmarkActions = () =>
  useBookmarksStore(
    useShallow((s) => ({
      add: s.addBookmark,
      remove: s.removeBookmark,
      toggle: s.toggleBookmark,
      isBookmarked: s.isBookmarked,
      clear: s.clearAll,
    })),
  );
