'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useActionState, useCallback, useEffect, useRef } from 'react';
import type { ActionResult } from '@/app/actions/problems';
import type { LoadWorksheetResult, SaveWorksheetResult } from '@/app/actions/worksheet';
import { loadWorksheet, saveWorksheet } from '@/app/actions/worksheet';
import type { WorksheetCell } from '@/lib/stores/worksheet-store';
import { useWorksheetStore } from '@/lib/stores/worksheet-store';

const WorksheetEditor = dynamic(
  () =>
    import('@/components/worksheet/worksheet-editor').then((m) => ({
      default: m.WorksheetEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-4 text-muted-foreground rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md px-10 py-8 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          <p className="text-sm">Loading worksheet editor...</p>
        </div>
      </div>
    ),
  },
);

interface WorksheetClientWrapperProps {
  worksheetId?: string;
}

const initialSaveState: ActionResult<SaveWorksheetResult> = { success: false };
const initialLoadState: ActionResult<LoadWorksheetResult> = { success: false };

export function WorksheetClientWrapper({
  worksheetId: initialWorksheetId,
}: WorksheetClientWrapperProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, saveAction] = useActionState(saveWorksheet, initialSaveState);
  const [loadState, loadAction] = useActionState(loadWorksheet, initialLoadState);

  const store = useWorksheetStore;

  // Load worksheet from DB if ID provided
  useEffect(() => {
    if (initialWorksheetId) {
      const fd = new FormData();
      fd.set('worksheetId', initialWorksheetId);
      loadAction(fd);
    }
  }, [initialWorksheetId, loadAction]);

  // Hydrate store when load completes
  useEffect(() => {
    if (loadState.success && loadState.data) {
      const { worksheetId, title, cells, version } = loadState.data;
      store.getState().hydrate({
        worksheetId,
        title,
        cells: cells as WorksheetCell[],
        version,
      });
    }
  }, [loadState, store]);

  // Track save responses to update version
  useEffect(() => {
    if (saveState.success && saveState.data && !saveState.data.conflict) {
      store.getState().markClean(saveState.data.version, saveState.data.worksheetId);
    }
  }, [saveState, store]);

  // Autosave: 1.5s debounce on store changes
  const doSave = useCallback(() => {
    const state = store.getState();
    if (!state.isDirty) return;

    const fd = new FormData();
    if (state.worksheetId) fd.set('worksheetId', state.worksheetId);
    fd.set('title', state.worksheet.title);
    fd.set('cells', JSON.stringify(state.worksheet.cells));
    fd.set('expectedVersion', state.version.toString());
    saveAction(fd);
  }, [store, saveAction]);

  useEffect(() => {
    const unsub = store.subscribe((state, prevState) => {
      if (state.isDirty && state.worksheet.updatedAt !== prevState.worksheet.updatedAt) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(doSave, 1500);
      }
    });
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [store, doSave]);

  return <WorksheetEditor />;
}
