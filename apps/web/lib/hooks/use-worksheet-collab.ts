/**
 * useWorksheetCollab — real-time collaboration sync hook
 *
 * Transport hierarchy:
 *   1. BroadcastChannel (same-origin tabs, offline-capable, primary for presence)
 *   2. graphql-sse SSE (cross-device data sync via worksheetUpdated subscription)
 *
 * BroadcastChannel handles: presence (heartbeat), join/leave, patches (same-device)
 * SSE handles: cross-device worksheet data sync (worksheetUpdated subscription)
 *
 * Protocol (JSON messages over BroadcastChannel):
 *
 *   { type: 'join',       peer, worksheetSessionId, worksheet }
 *   { type: 'heartbeat',  peer, worksheetSessionId, activeCellId }
 *   { type: 'patch',      peer, worksheetSessionId, patch }
 *   { type: 'leave',      peer, worksheetSessionId }
 *   { type: 'welcome',    peer, worksheetSessionId, worksheet }   -- host → joiner
 *
 * Conflict resolution: last-write-wins per cell, governed by cell.updatedAt.
 * The `patch` message carries only changed cells; receivers apply them only if
 * the incoming updatedAt is newer than the local version.
 *
 * Usage:
 *   const { startCollab, stopCollab } = useWorksheetCollab(worksheetSessionId);
 *
 * The hook is intentionally side-effect-only; all state mutations go through
 * useCollabStore and useWorksheetStore.
 */

'use client';

import { createClient } from 'graphql-sse';
import { useCallback, useEffect, useRef } from 'react';
import {
  COLLAB_COLORS,
  type CollabColor,
  localActiveCellRef,
  type RemoteCollaborator,
  useCollabActions,
  useCollabStore,
} from '@/lib/stores/collab-store';
import { useWorksheetStore, type WorksheetCell } from '@/lib/stores/worksheet-store';

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

interface CollabPeerDescriptor {
  id: string;
  name: string;
  color: CollabColor;
}

type CollabMessage =
  | {
      type: 'join';
      peer: CollabPeerDescriptor;
      worksheetSessionId: string;
      /** Full worksheet snapshot for late joiners. */
      worksheet: unknown;
    }
  | {
      type: 'welcome';
      peer: CollabPeerDescriptor;
      worksheetSessionId: string;
      /** Host sends full worksheet state back to the new joiner. */
      worksheet: unknown;
    }
  | {
      type: 'heartbeat';
      peer: CollabPeerDescriptor;
      worksheetSessionId: string;
      activeCellId: string | null;
    }
  | {
      type: 'patch';
      peer: CollabPeerDescriptor;
      worksheetSessionId: string;
      /** Sparse array of changed cells (only changed cells included). */
      changedCells: WorksheetCell[];
      worksheetTitle?: string;
      worksheetUpdatedAt: number;
    }
  | {
      type: 'leave';
      peer: CollabPeerDescriptor;
      worksheetSessionId: string;
    };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 4_000;
const STALE_PEER_TIMEOUT_MS = 12_000;
const PRUNE_INTERVAL_MS = 6_000;

// Polling fallback (used when the SSE live path is unavailable)
const POLL_INTERVAL_MS = 5_000;

/** Shape of the worksheet payload returned by both the SSE subscription and the polling query. */
interface RemoteWorksheet {
  id: string;
  title: string;
  content: unknown;
  updatedAt: string;
}

/**
 * GraphQL query mirroring the `worksheetUpdated` subscription selection set so
 * the polling fallback applies identical data through the same LWW merge.
 */
const WORKSHEET_POLL_QUERY = `query WorksheetSync($worksheetId: ID!) {
  worksheet(id: $worksheetId) {
    id
    title
    content
    updatedAt
  }
}`;

// SSE client for cross-device subscription (graphql-sse 2.6.0)
const sseClient =
  typeof window !== 'undefined'
    ? createClient({
        url: `${window.location.origin}/api/graphql/stream`,
        singleConnection: true,
      })
    : null;

// ---------------------------------------------------------------------------
// Colour assignment for unknown peers
// ---------------------------------------------------------------------------

function safeColor(value: unknown): CollabColor {
  if (typeof value === 'string' && (COLLAB_COLORS as readonly string[]).includes(value)) {
    return value as CollabColor;
  }
  return COLLAB_COLORS[0];
}

function descriptorToPeer(
  d: CollabPeerDescriptor,
  activeCellId: string | null = null,
): RemoteCollaborator {
  return {
    id: d.id,
    name: d.name,
    color: safeColor(d.color),
    activeCellId,
    lastSeenAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorksheetCollab(worksheetSessionId: string | null) {
  const actions = useCollabActions();
  const channelRef = useRef<BroadcastChannel | null>(null);

  // SSE subscription dispose ref
  const sseDisposeRef = useRef<(() => void) | null>(null);

  // Whether the SSE live path is currently delivering updates. While true, the
  // polling fallback stays dormant to avoid duplicating SSE-delivered data.
  const sseLiveRef = useRef(false);

  // Polling fallback refs (cross-device without SSE)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // DB worksheet id the poller is currently tracking.
  const pollWorksheetIdRef = useRef<string | null>(null);
  // Newest `updatedAt` (epoch ms) already applied from a remote source. Shared
  // by the SSE and polling paths to suppress duplicate / stale updates.
  const lastRemoteUpdatedAtRef = useRef(0);
  // Guards against overlapping in-flight poll fetches.
  const pollInFlightRef = useRef(false);

  // Heartbeat timer
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stale peer pruning timer
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a stable reference to the current localPeer without causing re-renders
  const localPeerRef = useRef(useCollabStore.getState().localPeer);
  useEffect(() => {
    return useCollabStore.subscribe((s) => {
      localPeerRef.current = s.localPeer;
    });
  }, []);

  // Track whether this tab was the session host (sent 'join' first)
  const isHostRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Message dispatch
  // ---------------------------------------------------------------------------

  const dispatch = useCallback((msg: CollabMessage) => {
    // BroadcastChannel (primary — same-device sync)
    if (channelRef.current) {
      try {
        channelRef.current.postMessage(msg);
      } catch {
        // Channel may have been closed; ignore
      }
    }

    // SSE is receive-only (cross-device sync comes from worksheetUpdated subscription)
  }, []);

  // ---------------------------------------------------------------------------
  // Receive a collab message and mutate stores accordingly
  // ---------------------------------------------------------------------------

  const receive = useCallback(
    (msg: unknown, sessionId: string) => {
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as Record<string, unknown>;
      if (m['worksheetSessionId'] !== sessionId) return;

      const peerRaw = m['peer'] as CollabPeerDescriptor | undefined;
      if (!peerRaw || peerRaw.id === localPeerRef.current.id) return; // skip own messages

      const type = m['type'] as string;

      switch (type) {
        case 'join': {
          // A new peer joined — upsert them and send a welcome with full worksheet
          actions.upsertPeer(descriptorToPeer(peerRaw));
          actions.markLive();

          if (isHostRef.current) {
            const worksheet = useWorksheetStore.getState().worksheet;
            const welcome: CollabMessage = {
              type: 'welcome',
              peer: localPeerRef.current,
              worksheetSessionId: sessionId,
              worksheet,
            };
            dispatch(welcome);
          }
          break;
        }

        case 'welcome': {
          // Host gave us the authoritative worksheet snapshot
          actions.upsertPeer(descriptorToPeer(peerRaw));
          actions.markLive();
          const wsData = m['worksheet'];
          if (
            wsData &&
            typeof wsData === 'object' &&
            'cells' in wsData &&
            Array.isArray((wsData as Record<string, unknown>)['cells'])
          ) {
            const incoming = wsData as {
              cells: WorksheetCell[];
              title?: string;
              updatedAt?: number;
            };
            const local = useWorksheetStore.getState().worksheet;
            // Only accept the welcome snapshot if it's newer
            if (!incoming.updatedAt || incoming.updatedAt >= (local.updatedAt ?? 0)) {
              useWorksheetStore.getState().importFromJSON(JSON.stringify(wsData));
            }
          }
          break;
        }

        case 'heartbeat': {
          const activeCellId = typeof m['activeCellId'] === 'string' ? m['activeCellId'] : null;
          actions.upsertPeer(descriptorToPeer(peerRaw, activeCellId));
          break;
        }

        case 'patch': {
          actions.upsertPeer(descriptorToPeer(peerRaw));
          const changedCells = m['changedCells'];
          if (!Array.isArray(changedCells)) break;

          // Apply LWW merge: accept incoming cell only if updatedAt is newer
          const localStore = useWorksheetStore.getState();
          const localCells = localStore.worksheet.cells;

          for (const incoming of changedCells as WorksheetCell[]) {
            const local = localCells.find((c) => c.id === incoming.id);
            if (!local || incoming.updatedAt >= local.updatedAt) {
              // Apply cell-level patch through store actions
              if (incoming.kind === 'math') {
                localStore.updateMathInput(incoming.id, incoming.input);
                if (incoming.status === 'success' && incoming.result !== null) {
                  localStore.setMathResult(
                    incoming.id,
                    incoming.result,
                    incoming.latex ?? '',
                    incoming.variables,
                  );
                } else if (incoming.status === 'error' && incoming.errorMessage) {
                  localStore.setMathError(incoming.id, incoming.errorMessage);
                }
              } else if (incoming.kind === 'text') {
                localStore.updateTextContent(incoming.id, incoming.content);
              } else if (incoming.kind === 'plot') {
                localStore.updatePlotExpressions(incoming.id, incoming.expressions);
                localStore.updatePlotViewport(incoming.id, {
                  xMin: incoming.xMin,
                  xMax: incoming.xMax,
                  yMin: incoming.yMin,
                  yMax: incoming.yMax,
                });
              }
            }
          }

          // Sync title if provided and newer
          if (typeof m['worksheetTitle'] === 'string') {
            const incomingUpdatedAt =
              typeof m['worksheetUpdatedAt'] === 'number' ? m['worksheetUpdatedAt'] : 0;
            if (incomingUpdatedAt >= localStore.worksheet.updatedAt) {
              localStore.setTitle(m['worksheetTitle'] as string);
            }
          }
          break;
        }

        case 'leave': {
          actions.removePeer(peerRaw.id);
          break;
        }
      }
    },
    [actions, dispatch],
  );

  // ---------------------------------------------------------------------------
  // BroadcastChannel transport
  // ---------------------------------------------------------------------------

  const openBroadcastChannel = useCallback(
    (sessionId: string) => {
      if (typeof BroadcastChannel === 'undefined') return false;

      const channelName = `nextcalc-collab-${sessionId}`;
      const channel = new BroadcastChannel(channelName);
      channelRef.current = channel;

      channel.onmessage = (event: MessageEvent<unknown>) => {
        receive(event.data, sessionId);
      };

      channel.onmessageerror = () => {
        // Structured clone failed — ignore malformed message
      };

      return true;
    },
    [receive],
  );

  // ---------------------------------------------------------------------------
  // Shared remote-apply (used by both SSE and the polling fallback)
  // ---------------------------------------------------------------------------
  // Applies an authoritative worksheet snapshot using last-write-wins on
  // updatedAt. Returns true when the snapshot was applied. The
  // lastRemoteUpdatedAtRef guard ensures the same revision is never applied
  // twice, regardless of which transport delivered it first.

  const applyRemoteWorksheet = useCallback(
    (updated: RemoteWorksheet, version?: number): boolean => {
      const incomingUpdatedAt = new Date(updated.updatedAt).getTime();
      if (!Number.isFinite(incomingUpdatedAt)) return false;

      // Skip if we already applied this (or a newer) remote revision.
      if (incomingUpdatedAt <= lastRemoteUpdatedAtRef.current) return false;

      if (!Array.isArray(updated.content)) return false;

      const localStore = useWorksheetStore.getState();
      // LWW: only adopt the remote snapshot when it is strictly newer locally.
      if (incomingUpdatedAt <= localStore.worksheet.updatedAt) {
        // Local is at least as new; record the revision so we don't reconsider it.
        lastRemoteUpdatedAtRef.current = incomingUpdatedAt;
        return false;
      }

      const cells = updated.content as WorksheetCell[];
      localStore.hydrate({
        worksheetId: updated.id,
        title: updated.title,
        cells,
        version: version ?? localStore.version,
      });
      lastRemoteUpdatedAtRef.current = incomingUpdatedAt;
      return true;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Polling fallback (cross-device data sync when SSE is unavailable)
  // ---------------------------------------------------------------------------
  // Periodically fetches the authoritative worksheet snapshot via the GraphQL
  // `worksheet(id)` query — the same data the SSE `worksheetUpdated`
  // subscription delivers — and applies it through `applyRemoteWorksheet`
  // (shared LWW + dedupe). Active only while the SSE live path is down.

  const pollOnce = useCallback(async () => {
    const worksheetId = pollWorksheetIdRef.current;
    if (!worksheetId) return;
    // SSE recovered between ticks — let it own the sync.
    if (sseLiveRef.current) return;
    // Skip if a previous fetch is still resolving.
    if (pollInFlightRef.current) return;

    pollInFlightRef.current = true;
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          query: WORKSHEET_POLL_QUERY,
          variables: { worksheetId },
        }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as {
        data?: { worksheet?: RemoteWorksheet | null } | null;
      };
      const worksheet = payload.data?.worksheet;
      if (worksheet) {
        applyRemoteWorksheet(worksheet);
      }
    } catch {
      // Network blip — keep the interval running and retry on the next tick.
    } finally {
      pollInFlightRef.current = false;
    }
  }, [applyRemoteWorksheet]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollWorksheetIdRef.current = null;
  }, []);

  const startPolling = useCallback(
    (worksheetId: string) => {
      // Nothing to poll without a persisted worksheet id, and never poll while
      // the SSE live path is active.
      if (!worksheetId || sseLiveRef.current) return;
      // Already polling this worksheet — don't stack intervals.
      if (pollTimerRef.current && pollWorksheetIdRef.current === worksheetId) return;

      // Re-point an existing timer at a new worksheet id.
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollWorksheetIdRef.current = worksheetId;
      // Fetch immediately so the fallback doesn't wait a full interval.
      void pollOnce();
      pollTimerRef.current = setInterval(() => {
        void pollOnce();
      }, POLL_INTERVAL_MS);
    },
    [pollOnce],
  );

  /**
   * Public entry point used by the session lifecycle. Arms the polling fallback
   * for the current DB-backed worksheet *only when SSE is unavailable* (e.g. the
   * browser cannot construct the graphql-sse client). When SSE is available,
   * `connectSSE` owns the fallback: its `error`/`complete` handlers start
   * polling, and its `next` handler stops it once the live path recovers.
   */
  const openPollingFallback = useCallback(
    (_sessionId: string) => {
      if (sseClient) return;
      const worksheetId = useWorksheetStore.getState().worksheetId;
      if (!worksheetId) return;
      startPolling(worksheetId);
    },
    [startPolling],
  );

  // ---------------------------------------------------------------------------
  // SSE transport (cross-device data sync via graphql-sse)
  // ---------------------------------------------------------------------------

  const connectSSE = useCallback(
    (worksheetId: string) => {
      if (!sseClient) return;

      // Dispose previous subscription if any
      sseDisposeRef.current?.();

      const dispose = sseClient.subscribe(
        {
          query: `subscription WorksheetUpdated($worksheetId: ID!) {
            worksheetUpdated(worksheetId: $worksheetId) {
              id title content version updatedAt
            }
          }`,
          variables: { worksheetId },
        },
        {
          next: (result) => {
            const updated = (result.data as Record<string, unknown> | null)?.['worksheetUpdated'] as
              | (RemoteWorksheet & { version: number })
              | undefined;
            if (!updated) return;

            // SSE is delivering — keep the polling fallback dormant.
            sseLiveRef.current = true;
            stopPolling();

            applyRemoteWorksheet(updated, updated.version);
          },
          error: (err) => {
            console.error('SSE subscription error:', err);
            // SSE failed — fall back to polling so cross-device sync continues.
            sseLiveRef.current = false;
            startPolling(worksheetId);
          },
          complete: () => {
            // SSE connection closed — fall back to polling. graphql-sse may
            // still reconnect; the next `next` event flips us back to SSE.
            sseLiveRef.current = false;
            startPolling(worksheetId);
          },
        },
      );

      sseDisposeRef.current = dispose;
    },
    [applyRemoteWorksheet, startPolling, stopPolling],
  );

  // ---------------------------------------------------------------------------
  // Heartbeat sender
  // ---------------------------------------------------------------------------

  const sendHeartbeat = useCallback(
    (sessionId: string) => {
      const peer = localPeerRef.current;
      const msg: CollabMessage = {
        type: 'heartbeat',
        peer,
        worksheetSessionId: sessionId,
        activeCellId: localActiveCellRef.current,
      };
      dispatch(msg);
    },
    [dispatch],
  );

  // ---------------------------------------------------------------------------
  // Patch broadcaster — called by the editor on every worksheet mutation
  // ---------------------------------------------------------------------------

  const broadcastPatch = useCallback(
    (
      changedCells: WorksheetCell[],
      sessionId: string,
      worksheetTitle: string,
      worksheetUpdatedAt: number,
    ) => {
      if (!sessionId) return;
      const peer = localPeerRef.current;
      const msg: CollabMessage = {
        type: 'patch',
        peer,
        worksheetSessionId: sessionId,
        changedCells,
        worksheetTitle,
        worksheetUpdatedAt,
      };
      dispatch(msg);
    },
    [dispatch],
  );

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  const startCollab = useCallback(
    (sessionId: string) => {
      isHostRef.current = true;
      actions.startSession(sessionId, 'broadcastchannel');

      const hasBc = openBroadcastChannel(sessionId);
      openPollingFallback(sessionId);

      // Connect SSE for cross-device data sync (if we have a worksheet DB ID)
      const worksheetId = useWorksheetStore.getState().worksheetId;
      if (worksheetId) {
        connectSSE(worksheetId);
      }

      if (hasBc) {
        // Immediately mark as live for BC (no handshake needed within same origin)
        actions.markLive();
      }

      // Announce our presence
      const peer = localPeerRef.current;
      const worksheet = useWorksheetStore.getState().worksheet;
      const joinMsg: CollabMessage = {
        type: 'join',
        peer,
        worksheetSessionId: sessionId,
        worksheet,
      };
      dispatch(joinMsg);

      // Heartbeat loop
      heartbeatTimerRef.current = setInterval(
        () => sendHeartbeat(sessionId),
        HEARTBEAT_INTERVAL_MS,
      );

      // Stale peer pruning
      pruneTimerRef.current = setInterval(
        () => actions.pruneStale(STALE_PEER_TIMEOUT_MS),
        PRUNE_INTERVAL_MS,
      );
    },
    [actions, openBroadcastChannel, connectSSE, openPollingFallback, dispatch, sendHeartbeat],
  );

  const stopCollab = useCallback(
    (sessionId: string) => {
      // Send leave message
      const peer = localPeerRef.current;
      const leaveMsg: CollabMessage = {
        type: 'leave',
        peer,
        worksheetSessionId: sessionId,
      };
      dispatch(leaveMsg);

      // Tear down transports
      channelRef.current?.close();
      channelRef.current = null;
      sseDisposeRef.current?.();
      sseDisposeRef.current = null;
      sseLiveRef.current = false;

      // Clear timers
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pruneTimerRef.current) clearInterval(pruneTimerRef.current);
      stopPolling();
      lastRemoteUpdatedAtRef.current = 0;

      isHostRef.current = false;
      actions.endSession();
    },
    [dispatch, actions, stopPolling],
  );

  // ---------------------------------------------------------------------------
  // Auto-join from URL param (when a user follows a share link)
  // ---------------------------------------------------------------------------

  const joinSession = useCallback(
    (sessionId: string) => {
      isHostRef.current = false;
      actions.startSession(sessionId, 'broadcastchannel');

      const hasBc = openBroadcastChannel(sessionId);
      openPollingFallback(sessionId);

      // Connect SSE for cross-device data sync (if we have a worksheet DB ID)
      const worksheetId = useWorksheetStore.getState().worksheetId;
      if (worksheetId) {
        connectSSE(worksheetId);
      }

      if (hasBc) {
        actions.markLive();
      }

      // Send join — host tab(s) will respond with 'welcome'
      const peer = localPeerRef.current;
      const worksheet = useWorksheetStore.getState().worksheet;
      const joinMsg: CollabMessage = {
        type: 'join',
        peer,
        worksheetSessionId: sessionId,
        worksheet,
      };
      dispatch(joinMsg);

      heartbeatTimerRef.current = setInterval(
        () => sendHeartbeat(sessionId),
        HEARTBEAT_INTERVAL_MS,
      );

      pruneTimerRef.current = setInterval(
        () => actions.pruneStale(STALE_PEER_TIMEOUT_MS),
        PRUNE_INTERVAL_MS,
      );
    },
    [actions, openBroadcastChannel, connectSSE, openPollingFallback, dispatch, sendHeartbeat],
  );

  // ---------------------------------------------------------------------------
  // Auto-cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      // Cleanup on component unmount without explicit stopCollab call
      channelRef.current?.close();
      channelRef.current = null;
      sseDisposeRef.current?.();
      sseDisposeRef.current = null;
      sseLiveRef.current = false;
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pruneTimerRef.current) clearInterval(pruneTimerRef.current);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollWorksheetIdRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Subscribe to worksheet store changes and broadcast patches
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!worksheetSessionId) return;
    const sessionId = worksheetSessionId;

    // Track previous cell states for delta computation
    let prevCells = useWorksheetStore.getState().worksheet.cells;
    let prevTitle = useWorksheetStore.getState().worksheet.title;

    const unsub = useWorksheetStore.subscribe((state) => {
      const session = useCollabStore.getState().session;
      if (session?.status !== 'live') return;

      const newCells = state.worksheet.cells;
      const newTitle = state.worksheet.title;

      // Compute changed cells (by updatedAt or new IDs)
      const prevMap = new Map(prevCells.map((c) => [c.id, c]));
      const changed: WorksheetCell[] = [];
      for (const cell of newCells) {
        const prev = prevMap.get(cell.id);
        if (!prev || cell.updatedAt !== prev.updatedAt) {
          changed.push(cell);
        }
      }

      const titleChanged = newTitle !== prevTitle;

      if (changed.length > 0 || titleChanged) {
        broadcastPatch(changed, sessionId, newTitle, state.worksheet.updatedAt);
      }

      prevCells = newCells;
      prevTitle = newTitle;
    });

    return unsub;
  }, [worksheetSessionId, broadcastPatch]);

  return { startCollab, stopCollab, joinSession, broadcastPatch };
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------
export { localActiveCellRef };
