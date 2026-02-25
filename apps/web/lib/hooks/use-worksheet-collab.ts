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

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from 'graphql-sse';
import {
  useCollabStore,
  useCollabActions,
  localActiveCellRef,
  type RemoteCollaborator,
  type CollabColor,
  COLLAB_COLORS,
} from '@/lib/stores/collab-store';
import {
  useWorksheetStore,
  type WorksheetCell,
} from '@/lib/stores/worksheet-store';

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

// SSE client for cross-device subscription (graphql-sse 2.6.0)
const sseClient = typeof window !== 'undefined'
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
  activeCellId: string | null = null
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

  // Polling fallback refs (cross-device without SSE)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          const activeCellId =
            typeof m['activeCellId'] === 'string' ? m['activeCellId'] : null;
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
                    incoming.variables
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
    [actions, dispatch]
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
    [receive]
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
            const updated = (result.data as Record<string, unknown> | null)?.['worksheetUpdated'] as {
              id: string;
              title: string;
              content: unknown;
              version: number;
              updatedAt: string;
            } | undefined;
            if (!updated) return;

            // Apply incoming worksheet data using LWW
            const localStore = useWorksheetStore.getState();
            const localUpdatedAt = localStore.worksheet.updatedAt;
            const incomingUpdatedAt = new Date(updated.updatedAt).getTime();

            if (incomingUpdatedAt > localUpdatedAt) {
              // The SSE update is newer — hydrate from it
              if (Array.isArray(updated.content)) {
                const cells = updated.content as WorksheetCell[];
                localStore.hydrate({
                  worksheetId: updated.id,
                  title: updated.title,
                  cells,
                  version: updated.version,
                });
              }
            }
          },
          error: (err) => {
            console.error('SSE subscription error:', err);
          },
          complete: () => {
            // SSE connection closed — no automatic retry (graphql-sse handles reconnection)
          },
        },
      );

      sseDisposeRef.current = dispose;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Polling fallback (cross-device, no SSE)
  // ---------------------------------------------------------------------------
  // This is a stub placeholder that keeps the hook interface stable.
  // SSE via graphql-sse is the primary cross-device transport.
  const openPollingFallback = useCallback(
    (_sessionId: string) => {
      // Polling is deferred to a future implementation.
      // The BroadcastChannel is the primary mechanism for same-device sync,
      // which covers the most common collaboration scenario.
    },
    []
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
    [dispatch]
  );

  // ---------------------------------------------------------------------------
  // Patch broadcaster — called by the editor on every worksheet mutation
  // ---------------------------------------------------------------------------

  const broadcastPatch = useCallback(
    (changedCells: WorksheetCell[], sessionId: string, worksheetTitle: string, worksheetUpdatedAt: number) => {
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
    [dispatch]
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
        HEARTBEAT_INTERVAL_MS
      );

      // Stale peer pruning
      pruneTimerRef.current = setInterval(
        () => actions.pruneStale(STALE_PEER_TIMEOUT_MS),
        PRUNE_INTERVAL_MS
      );
    },
    [actions, openBroadcastChannel, connectSSE, openPollingFallback, dispatch, sendHeartbeat]
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

      // Clear timers
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pruneTimerRef.current) clearInterval(pruneTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      isHostRef.current = false;
      actions.endSession();
    },
    [dispatch, actions]
  );

  // ---------------------------------------------------------------------------
  // Auto-join from URL param (when a user follows a share link)
  // ---------------------------------------------------------------------------

  const joinSession = useCallback(
    (sessionId: string) => {
      isHostRef.current = false;
      actions.startSession(sessionId, 'broadcastchannel');

      const hasBc = openBroadcastChannel(sessionId);

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
        HEARTBEAT_INTERVAL_MS
      );

      pruneTimerRef.current = setInterval(
        () => actions.pruneStale(STALE_PEER_TIMEOUT_MS),
        PRUNE_INTERVAL_MS
      );
    },
    [actions, openBroadcastChannel, connectSSE, dispatch, sendHeartbeat]
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
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pruneTimerRef.current) clearInterval(pruneTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
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
      if (!session || session.status !== 'live') return;

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
