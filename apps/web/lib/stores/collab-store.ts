/**
 * Collaboration Store
 *
 * Manages real-time collaborative session state for worksheets.
 * Tracks local peer identity, remote collaborator presence, and
 * the session parameters needed to sync with the BroadcastChannel
 * or WebSocket transport.
 *
 * Architecture notes:
 *   - This store intentionally holds ONLY presence/session state.
 *   - Actual worksheet mutations still flow through worksheet-store.ts.
 *   - The sync hook (use-worksheet-collab.ts) bridges the two stores.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { generateId } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * Collaborator avatar color palette — 12 visually distinct, WCAG-contrast-safe
 * hues that work on both dark and light backgrounds.
 */
export const COLLAB_COLORS = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#facc15', // yellow-400
  '#2dd4bf', // teal-400
  '#f87171', // red-400
  '#c084fc', // purple-400
  '#4ade80', // green-400
  '#38bdf8', // sky-400
  '#e879f9', // fuchsia-400
] as const;

export type CollabColor = (typeof COLLAB_COLORS)[number];

/** The local peer's own descriptor, generated once per browser tab. */
export interface LocalPeer {
  readonly id: string;
  /** Display name — defaults to "You" until the user sets one. */
  name: string;
  /** Assigned color from COLLAB_COLORS. */
  color: CollabColor;
}

/** Transport mechanism in use for the current session. */
export type CollabTransport = 'broadcastchannel' | 'websocket' | 'polling';

/** Connection state of the collaborative session. */
export type CollabStatus =
  | 'idle'       // not in any session
  | 'connecting' // handshake in progress
  | 'live'       // active and syncing
  | 'error';     // transport failed

/** A remote collaborator's presence snapshot. */
export interface RemoteCollaborator {
  readonly id: string;
  name: string;
  color: CollabColor;
  /** Cell ID the collaborator is currently editing, null if idle. */
  activeCellId: string | null;
  /** Last heartbeat timestamp (ms since epoch). */
  lastSeenAt: number;
}

/** Full collaborative session descriptor. */
export interface CollabSession {
  /** Worksheet-scoped session ID, embedded in the share URL. */
  readonly worksheetSessionId: string;
  /** Human-readable shareable URL. */
  readonly shareUrl: string;
  readonly transport: CollabTransport;
  readonly status: CollabStatus;
  /** Remote peers, keyed by peer ID. */
  readonly peers: Record<string, RemoteCollaborator>;
  /** ISO timestamp when this session was started by the local peer. */
  readonly startedAt: string;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface CollabStore {
  /** The local peer. Generated on first use and stable for the browser tab lifetime. */
  localPeer: LocalPeer;

  /** Active session or null when in solo mode. */
  session: CollabSession | null;

  // ---- Actions ----

  /** Set local peer display name. */
  setLocalName: (name: string) => void;

  /** Start or join a collaborative session for a given worksheet. */
  startSession: (worksheetSessionId: string, transport: CollabTransport) => void;

  /** Mark the session as live (handshake completed). */
  markLive: () => void;

  /** Mark the session as errored. */
  markError: () => void;

  /** Add or update a remote collaborator. */
  upsertPeer: (peer: RemoteCollaborator) => void;

  /** Remove a collaborator (they disconnected). */
  removePeer: (peerId: string) => void;

  /** Prune collaborators whose heartbeat is older than `maxAgeMs`. */
  pruneStale: (maxAgeMs: number) => void;

  /** Update the cell the local peer is currently editing. */
  setLocalActiveCell: (cellId: string | null) => void;

  /** End the session and return to solo mode. */
  endSession: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickColor(peerId: string): CollabColor {
  // Deterministic colour derived from the peer ID string so the same peer
  // always gets the same color within a session.
  let hash = 0;
  for (let i = 0; i < peerId.length; i++) {
    hash = (hash * 31 + peerId.charCodeAt(i)) >>> 0;
  }
  return COLLAB_COLORS[hash % COLLAB_COLORS.length] as CollabColor;
}

function buildShareUrl(worksheetSessionId: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.pathname = '/worksheet';
  url.searchParams.set('collab', worksheetSessionId);
  return url.toString();
}

function makeLocalPeer(): LocalPeer {
  const id = generateId();
  return {
    id,
    name: 'You',
    color: pickColor(id),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCollabStore = create<CollabStore>()(
  devtools(
    (set) => ({
      localPeer: makeLocalPeer(),
      session: null,

      setLocalName: (name) => {
        set((s) => ({ localPeer: { ...s.localPeer, name } }));
      },

      startSession: (worksheetSessionId, transport) => {
        set({
          session: {
            worksheetSessionId,
            shareUrl: buildShareUrl(worksheetSessionId),
            transport,
            status: 'connecting',
            peers: {},
            startedAt: new Date().toISOString(),
          },
        });
      },

      markLive: () => {
        set((s) => {
          if (!s.session) return s;
          return { session: { ...s.session, status: 'live' } };
        });
      },

      markError: () => {
        set((s) => {
          if (!s.session) return s;
          return { session: { ...s.session, status: 'error' } };
        });
      },

      upsertPeer: (peer) => {
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              peers: { ...s.session.peers, [peer.id]: peer },
            },
          };
        });
      },

      removePeer: (peerId) => {
        set((s) => {
          if (!s.session) return s;
          const peers = { ...s.session.peers };
          delete peers[peerId];
          return { session: { ...s.session, peers } };
        });
      },

      pruneStale: (maxAgeMs) => {
        const now = Date.now();
        set((s) => {
          if (!s.session) return s;
          const peers: Record<string, RemoteCollaborator> = {};
          for (const [id, peer] of Object.entries(s.session.peers)) {
            if (now - peer.lastSeenAt < maxAgeMs) {
              peers[id] = peer;
            }
          }
          return { session: { ...s.session, peers } };
        });
      },

      setLocalActiveCell: (_cellId) => {
        // Active cell is tracked via localActiveCellRef (mutable ref) to avoid
        // triggering full re-renders on every keystroke. The sync hook reads the
        // ref directly on each heartbeat interval.
        // This action is a no-op in the store; callers should update localActiveCellRef.
      },

      endSession: () => {
        set({ session: null });
      },
    }),
    {
      name: 'collab-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ---------------------------------------------------------------------------
// Ephemeral local active cell (not in main state to avoid re-render cascade)
// ---------------------------------------------------------------------------

/** Mutable ref-like slot for the current local active cell ID. */
export const localActiveCellRef = { current: null as string | null };

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export const useCollabSession = () => useCollabStore((s) => s.session);
export const useLocalPeer = () => useCollabStore((s) => s.localPeer);
export const useCollabStatus = () => useCollabStore((s) => s.session?.status ?? 'idle');
export const useRemotePeers = () =>
  useCollabStore(useShallow((s) =>
    s.session ? Object.values(s.session.peers) : []
  ));
export const useCollabActions = () =>
  useCollabStore(useShallow((s) => ({
    setLocalName: s.setLocalName,
    startSession: s.startSession,
    markLive: s.markLive,
    markError: s.markError,
    upsertPeer: s.upsertPeer,
    removePeer: s.removePeer,
    pruneStale: s.pruneStale,
    setLocalActiveCell: s.setLocalActiveCell,
    endSession: s.endSession,
  })));
