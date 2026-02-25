'use client';

import { useOptimistic, useActionState, useCallback } from 'react';
import { KnowledgeExplorer } from '@/components/math/knowledge-explorer';
import { toggleBookmark } from '@/app/actions/learn';
import type { ToggleBookmarkResult } from '@/app/actions/learn';
import type { ActionResult } from '@/app/actions/problems';
import type { Definition } from '@nextcalc/math-engine/knowledge';

interface BookmarkExplorerClientProps {
  definitions: ReadonlyArray<Definition>;
  bookmarkedIds: ReadonlyArray<string>;
}

const initialState: ActionResult<ToggleBookmarkResult> = { success: false };

export function BookmarkExplorerClient({ definitions, bookmarkedIds }: BookmarkExplorerClientProps) {
  const [optimisticIds, toggleOptimistic] = useOptimistic(
    bookmarkedIds,
    (current: ReadonlyArray<string>, definitionId: string) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId],
  );

  const [_state, bookmarkAction] = useActionState(toggleBookmark, initialState);

  const handleToggleBookmark = useCallback(
    (definitionId: string) => {
      toggleOptimistic(definitionId);
      const fd = new FormData();
      fd.set('definitionId', definitionId);
      bookmarkAction(fd);
    },
    [toggleOptimistic, bookmarkAction],
  );

  return (
    <KnowledgeExplorer
      definitions={definitions}
      bookmarkedIds={[...optimisticIds]}
      onToggleBookmark={handleToggleBookmark}
    />
  );
}
