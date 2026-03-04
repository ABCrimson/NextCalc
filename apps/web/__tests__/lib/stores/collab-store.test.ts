import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COLLAB_COLORS,
  type RemoteCollaborator,
  useCollabStore,
} from '@/lib/stores/collab-store';

function getStore() {
  return useCollabStore.getState();
}

const makePeer = (id: string, lastSeenAt = Date.now()): RemoteCollaborator => ({
  id,
  name: `Peer ${id}`,
  color: COLLAB_COLORS[0],
  activeCellId: null,
  lastSeenAt,
});

describe('collab-store', () => {
  beforeEach(() => {
    getStore().endSession();
  });

  afterEach(() => {
    getStore().endSession();
  });

  describe('initial state', () => {
    it('has a local peer with default name "You"', () => {
      expect(getStore().localPeer.name).toBe('You');
      expect(getStore().localPeer.id).toBeTypeOf('string');
      expect(COLLAB_COLORS).toContain(getStore().localPeer.color);
    });

    it('starts with no session', () => {
      expect(getStore().session).toBeNull();
    });
  });

  describe('setLocalName', () => {
    it('updates the local peer name', () => {
      getStore().setLocalName('Alice');
      expect(getStore().localPeer.name).toBe('Alice');
    });

    it('preserves id and color', () => {
      const { id, color } = getStore().localPeer;
      getStore().setLocalName('Bob');
      expect(getStore().localPeer.id).toBe(id);
      expect(getStore().localPeer.color).toBe(color);
    });
  });

  describe('startSession', () => {
    it('creates a session with connecting status', () => {
      getStore().startSession('ws-session-1', 'broadcastchannel');
      const session = getStore().session;
      expect(session).not.toBeNull();
      expect(session?.worksheetSessionId).toBe('ws-session-1');
      expect(session?.transport).toBe('broadcastchannel');
      expect(session?.status).toBe('connecting');
      expect(session?.peers).toEqual({});
    });
  });

  describe('markLive / markError', () => {
    it('transitions to live', () => {
      getStore().startSession('ws-1', 'websocket');
      getStore().markLive();
      expect(getStore().session?.status).toBe('live');
    });

    it('transitions to error', () => {
      getStore().startSession('ws-1', 'websocket');
      getStore().markError();
      expect(getStore().session?.status).toBe('error');
    });

    it('is a no-op when no session', () => {
      getStore().markLive();
      expect(getStore().session).toBeNull();
    });
  });

  describe('peer management', () => {
    beforeEach(() => {
      getStore().startSession('ws-1', 'broadcastchannel');
    });

    it('adds a remote peer', () => {
      getStore().upsertPeer(makePeer('peer-1'));
      expect(getStore().session?.peers['peer-1']?.name).toBe('Peer peer-1');
    });

    it('updates an existing peer', () => {
      getStore().upsertPeer(makePeer('peer-1'));
      getStore().upsertPeer({ ...makePeer('peer-1'), name: 'Updated' });
      expect(getStore().session?.peers['peer-1']?.name).toBe('Updated');
    });

    it('removes a peer', () => {
      getStore().upsertPeer(makePeer('peer-1'));
      getStore().upsertPeer(makePeer('peer-2'));
      getStore().removePeer('peer-1');
      expect(getStore().session?.peers['peer-1']).toBeUndefined();
      expect(getStore().session?.peers['peer-2']).toBeDefined();
    });

    it('prunes stale peers', () => {
      const recent = Date.now();
      const stale = Date.now() - 60_000;
      getStore().upsertPeer(makePeer('recent', recent));
      getStore().upsertPeer(makePeer('stale', stale));

      getStore().pruneStale(30_000);

      expect(getStore().session?.peers['recent']).toBeDefined();
      expect(getStore().session?.peers['stale']).toBeUndefined();
    });
  });

  describe('endSession', () => {
    it('clears the session', () => {
      getStore().startSession('ws-1', 'websocket');
      getStore().upsertPeer(makePeer('peer-1'));
      getStore().endSession();
      expect(getStore().session).toBeNull();
    });
  });
});
