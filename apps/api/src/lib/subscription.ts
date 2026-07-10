/**
 * WebSocket Subscription Server for GraphQL
 *
 * Implements real-time GraphQL subscriptions using graphql-ws (WebSocket).
 * Supports authenticated subscriptions with context creation.
 *
 * PubSub: Hybrid Upstash Redis Streams + in-memory, actually consumed.
 * - Every publish writes to the local (same-process) PubSub AND, when
 *   Upstash is configured, XADDs the payload to a Redis Stream tagged with
 *   this process's instance ID.
 * - Every subscription's async iterator merges two sources: the local
 *   PubSub (same-instance, push-based, near-instant) and a periodic
 *   XRANGE poll of the Redis Stream (cross-instance delivery). Upstash's
 *   REST API has no blocking XREAD, so polling (every POLL_INTERVAL_MS) is
 *   the only viable cross-instance mechanism.
 * - Stream entries tagged with this process's own instance ID are skipped
 *   during polling — they were already delivered via the local PubSub, so
 *   re-delivering them would produce duplicate events.
 * - When Upstash is unavailable, only local (single-instance) delivery
 *   happens, same as before.
 * - The poll timer is cleared and local subscriptions are torn down as
 *   soon as the consumer calls `.return()` on the iterator (graphql-ws /
 *   Apollo do this automatically when a client unsubscribes or disconnects).
 *
 * @see https://the-guild.dev/graphql/ws
 * @see https://www.apollographql.com/docs/apollo-server/data/subscriptions/
 * @see https://redis.io/docs/latest/commands/xrange/
 */

import { randomUUID } from 'node:crypto';
import type { ExecutionArgs } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { redis } from './cache';
import type { GraphQLContext } from './context';
import { createDataLoaders } from './dataloaders';
import { logger } from './logger';
import { prisma } from './prisma';

// ---------------------------------------------------------------------------
// Hybrid PubSub: Upstash Redis Streams + in-memory, merged on consumption
// ---------------------------------------------------------------------------

/** In-memory PubSub — always available, single-instance only */
const localPubSub = new PubSub();

/** Redis Stream key prefix for subscription channels */
const STREAM_PREFIX = '@nextcalc/pubsub:';

/** Max stream length (auto-trimmed via MAXLEN ~) */
const STREAM_MAXLEN = 1000;

/** How often to poll Redis Streams for cross-instance events. */
const POLL_INTERVAL_MS = 2000;

/**
 * Unique ID for this process. Published events are tagged with it so that,
 * when this same process polls the stream, it can skip its own publishes
 * (already delivered via localPubSub) and only deliver events that
 * originated on a different instance.
 */
const INSTANCE_ID = randomUUID();

interface StreamEntryFields extends Record<string, unknown> {
  /**
   * The event payload. The Upstash client (automaticDeserialization: true)
   * JSON-serializes non-string field values on XADD and JSON-parses every
   * field value on XRANGE, so this arrives already deserialized — parsing
   * it again here would throw on every cross-instance event.
   */
  payload: unknown;
  instanceId: string;
}

/**
 * Publish to both Redis (for cross-instance) and local (for same-instance).
 * If Redis is unavailable, local-only delivery still works.
 */
async function hybridPublish(triggerName: string, payload: unknown): Promise<void> {
  // Always publish locally for same-instance subscribers
  await localPubSub.publish(triggerName, payload);

  // Also publish to Redis Stream for cross-instance delivery
  if (redis) {
    try {
      const streamKey = `${STREAM_PREFIX}${triggerName}`;
      // XADD with inline MAXLEN~ trim — single round-trip. The payload is
      // passed as-is: the client's serializer JSON.stringifies object field
      // values, mirroring the JSON.parse its XRANGE deserializer applies.
      await redis.xadd(
        streamKey,
        '*',
        { payload, instanceId: INSTANCE_ID },
        {
          trim: { type: 'MAXLEN', threshold: STREAM_MAXLEN, comparison: '~' },
        },
      );
    } catch (error) {
      logger.error('Redis PubSub publish failed, local delivery still active', {
        triggerName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Numeric comparison of Redis Stream IDs ("<ms>-<seq>"), oldest first. */
function compareStreamIds(a: string, b: string): number {
  const [aMs = 0, aSeq = 0] = a.split('-').map(Number);
  const [bMs = 0, bSeq = 0] = b.split('-').map(Number);
  return aMs !== bMs ? aMs - bMs : aSeq - bSeq;
}

/**
 * Minimal push-based async queue. `push()` is called both from the local
 * PubSub subscription callback and from the Redis Stream poller; `next()` /
 * `return()` implement the async-iterator protocol the merged consumer uses.
 */
class AsyncPushQueue<T> {
  private readonly buffered: T[] = [];
  private readonly pending: Array<(result: IteratorResult<T>) => void> = [];
  private done = false;

  push(value: T): void {
    if (this.done) return;
    const resolve = this.pending.shift();
    if (resolve) {
      resolve({ value, done: false });
    } else {
      this.buffered.push(value);
    }
  }

  next(): Promise<IteratorResult<T>> {
    if (this.buffered.length > 0) {
      return Promise.resolve({ value: this.buffered.shift() as T, done: false });
    }
    if (this.done) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve) => this.pending.push(resolve));
  }

  return(): Promise<IteratorResult<T>> {
    this.done = true;
    for (const resolve of this.pending.splice(0)) {
      resolve({ value: undefined, done: true });
    }
    return Promise.resolve({ value: undefined, done: true });
  }
}

/**
 * Build a merged async iterator for one or more triggers: local PubSub
 * events plus a periodic Redis Stream poll for cross-instance delivery.
 * The poll timer and local subscriptions are torn down when the iterator's
 * `.return()` (or `.throw()`) is invoked — this is how graphql-ws / Apollo
 * signal that a client has unsubscribed or disconnected, so this is the
 * only place we need to release resources.
 */
function hybridAsyncIterableIterator<T>(triggers: string[]): AsyncIterableIterator<T> {
  const queue = new AsyncPushQueue<T>();

  // Local (same-instance) delivery — subscribe via the callback API so
  // incoming events can be pushed straight into the merged queue.
  const localSubscriptionIds = triggers.map((trigger) =>
    localPubSub.subscribe(trigger, (payload: unknown) => {
      queue.push(payload as T);
    }),
  );

  // Remote (cross-instance) delivery — poll Redis Streams since Upstash's
  // REST API doesn't support blocking XREAD.
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  if (redis) {
    const redisClient = redis;
    // Cursor per trigger, initialized lazily on the first poll from the
    // stream's own tip ID (XREVRANGE COUNT 1) rather than the local clock —
    // Redis Stream IDs come from the Redis server's clock, so seeding from
    // Date.now() would replay or drop events under clock skew.
    const lastSeenId = new Map<string, string>();

    const pollOnce = async (): Promise<void> => {
      await Promise.all(
        triggers.map(async (trigger) => {
          const streamKey = `${STREAM_PREFIX}${trigger}`;
          try {
            const since = lastSeenId.get(trigger);
            if (since === undefined) {
              // First poll — position the cursor at the stream's current
              // tip ('0' when empty) WITHOUT delivering anything. One extra
              // round-trip per trigger, paid once at subscribe time.
              const tip = await redisClient.xrevrange<StreamEntryFields>(streamKey, '+', '-', 1);
              const [tipId] = Object.keys(tip);
              lastSeenId.set(trigger, tipId ?? '0');
              return;
            }

            const entries = await redisClient.xrange<StreamEntryFields>(
              streamKey,
              `(${since}`,
              '+',
            );

            const ids = Object.keys(entries).sort(compareStreamIds);
            for (const id of ids) {
              lastSeenId.set(trigger, id);
              const fields = entries[id];
              // Skip our own publishes — already delivered via localPubSub.
              if (!fields || fields.instanceId === INSTANCE_ID) continue;

              try {
                // Already deserialized by the client — push as-is.
                queue.push(fields.payload as T);
              } catch (error) {
                logger.error('Failed to deliver Redis Stream payload', {
                  trigger,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          } catch (error) {
            logger.error('Redis Stream poll failed', {
              trigger,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );
    };

    // Self-scheduling loop instead of setInterval: the next tick is armed
    // only after the current poll settles, so a slow XRANGE round-trip can
    // never overlap the next tick and double-deliver from a stale cursor.
    const loop = async (): Promise<void> => {
      await pollOnce();
      if (!stopped) {
        pollTimer = setTimeout(() => void loop(), POLL_INTERVAL_MS);
      }
    };
    // Kick off immediately — the first pass only initializes cursors.
    void loop();
  }

  const cleanup = async (): Promise<void> => {
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    for (const id of await Promise.all(localSubscriptionIds)) {
      localPubSub.unsubscribe(id);
    }
  };

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: () => queue.next(),
    return: async () => {
      await cleanup();
      return queue.return();
    },
    throw: async (error?: unknown) => {
      await cleanup();
      await queue.return();
      throw error;
    },
  };
}

/**
 * Wrapper that exposes the same API as graphql-subscriptions PubSub
 * but routes publish/subscribe calls through the hybrid layer.
 */
export const pubsub = {
  publish: hybridPublish,

  subscribe(triggerName: string, onMessage: (...args: unknown[]) => void): Promise<number> {
    return localPubSub.subscribe(triggerName, onMessage);
  },

  unsubscribe(subId: number): void {
    localPubSub.unsubscribe(subId);
  },

  asyncIterableIterator<T>(triggers: string | string[]): AsyncIterableIterator<T> {
    return hybridAsyncIterableIterator<T>(Array.isArray(triggers) ? triggers : [triggers]);
  },
};

/**
 * Subscription event types
 * Used as constants to prevent typos and enable type safety
 */
export const SUBSCRIPTION_EVENTS = {
  WORKSHEET_UPDATED: 'WORKSHEET_UPDATED',
  USER_WORKSHEETS_CHANGED: 'USER_WORKSHEETS_CHANGED',
  CALCULATION_COMPLETED: 'CALCULATION_COMPLETED',
} as const;

export type SubscriptionEvent = (typeof SUBSCRIPTION_EVENTS)[keyof typeof SUBSCRIPTION_EVENTS];

/**
 * User payload from decoded token
 */
interface TokenUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
}

/**
 * Verify and decode authentication token
 * Supports both JWT and session-based auth
 */
async function verifyAuthToken(token: string | undefined): Promise<TokenUser | null> {
  if (!token) return null;

  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Verify JWT signature using the same secret as NextAuth
    const secret = process.env['NEXTAUTH_SECRET'] || process.env['AUTH_SECRET'];
    if (!secret) {
      logger.error('NEXTAUTH_SECRET not set — WebSocket auth unavailable');
      return null;
    }

    if (cleanToken.includes('.')) {
      // JWT token — verify signature with jose
      const { jwtVerify } = await import('jose');
      const secretKey = new TextEncoder().encode(secret);
      // Pin the accepted algorithm — without this, a token signed with an
      // attacker-chosen "alg" (e.g. "none") could bypass verification.
      const { payload } = await jwtVerify(cleanToken, secretKey, { algorithms: ['HS256'] });

      if (payload.sub || payload['userId'] || payload['id']) {
        return {
          id: (payload.sub || payload['userId'] || payload['id']) as string,
          email: (payload['email'] as string) || '',
          name: (payload['name'] as string) || null,
          role: (payload['role'] as string) || 'USER',
        };
      }
    }

    // Session tokens require database access not available in WS context
    logger.debug('Session-based auth not implemented for WebSocket');
    return null;
  } catch (error) {
    logger.error('WebSocket token verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Create subscription context for WebSocket connections
 * Similar to HTTP context but for WebSocket subscriptions
 */
export const createSubscriptionContext = async (
  ctx: {
    connectionParams?: Record<string, unknown>;
    extra?: { request?: { socket?: { remoteAddress?: string } } };
  },
  _msg: unknown,
  _args: ExecutionArgs,
): Promise<GraphQLContext> => {
  // Extract auth token from connection params
  const connectionParams = ctx.connectionParams || {};
  const token = (connectionParams['authorization'] ||
    connectionParams['Authorization'] ||
    connectionParams['authToken']) as string | undefined;

  // Validate the token, then load the full user record so the context carries a
  // real `User` (the JWT only yields id/email/role).
  const tokenUser = await verifyAuthToken(token);
  const user = tokenUser ? await prisma.user.findUnique({ where: { id: tokenUser.id } }) : null;

  if (user) {
    logger.debug('Subscription authenticated', { userId: user.id });
  }

  return {
    user,
    prisma,
    loaders: createDataLoaders(prisma),
    req: {
      headers: (connectionParams['headers'] as Record<string, string>) || {},
      ...(ctx.extra?.request?.socket?.remoteAddress
        ? { ip: ctx.extra.request.socket.remoteAddress }
        : {}),
    },
  };
};

/**
 * WebSocket server options for graphql-ws
 */
export const getWebSocketServerOptions = () => ({
  // Connection initialization
  onConnect: async (ctx: { connectionParams?: Record<string, unknown> }) => {
    const connectionParams = ctx.connectionParams || {};
    const hasAuth = !!(
      connectionParams['authorization'] ||
      connectionParams['Authorization'] ||
      connectionParams['authToken']
    );

    logger.info('WebSocket client connected', {
      authenticated: hasAuth,
      connectionParams: Object.keys(connectionParams),
    });

    // Optionally reject unauthenticated connections
    // return hasAuth; // Uncomment to require auth
    return true;
  },

  // Connection close
  onDisconnect: async (_ctx: unknown, code: number, reason: string) => {
    logger.info('WebSocket client disconnected', { code, reason });
  },

  // Subscription start
  onSubscribe: async (
    ctx: { extra?: { user?: { id: string } } },
    msg: { payload?: { operationName?: string } },
  ) => {
    const user = ctx.extra?.user;
    logger.debug('Subscription started', {
      operationName: msg.payload?.operationName ?? 'anonymous',
      userId: user?.id ?? 'anonymous',
    });
  },

  // Handle errors
  onError: (_ctx: unknown, _message: unknown, errors: readonly Error[]) => {
    for (const error of errors) {
      logger.error('WebSocket subscription error', {
        message: error.message,
        stack: error.stack,
      });
    }
  },
});

/**
 * Helper to publish worksheet update events
 */
export const publishWorksheetUpdate = async (worksheetId: string, worksheet: unknown) => {
  await pubsub.publish(SUBSCRIPTION_EVENTS.WORKSHEET_UPDATED, {
    worksheetUpdated: worksheet,
    worksheetId,
  });
};

/**
 * Helper to publish user worksheets changed events
 */
export const publishUserWorksheetsChanged = async (userId: string, worksheets: unknown[]) => {
  await pubsub.publish(SUBSCRIPTION_EVENTS.USER_WORKSHEETS_CHANGED, {
    userWorksheetsChanged: worksheets,
    userId,
  });
};

/**
 * Helper to publish calculation completed events
 */
export const publishCalculationCompleted = async (userId: string, result: unknown) => {
  await pubsub.publish(SUBSCRIPTION_EVENTS.CALCULATION_COMPLETED, {
    calculationCompleted: result,
    userId,
  });
};

/**
 * Subscription filter helpers
 * Used in resolvers to filter subscription events
 */
export const subscriptionFilters = {
  /**
   * Filter worksheet updates by worksheet ID
   */
  worksheetUpdated: (payload: { worksheetId: string }, variables: { worksheetId: string }) => {
    return payload.worksheetId === variables.worksheetId;
  },

  /**
   * Filter user worksheet changes by user ID
   */
  userWorksheetsChanged: (
    payload: { userId: string },
    variables: { userId: string },
    context: GraphQLContext,
  ) => {
    // Ensure user is authenticated and matches the subscription target
    if (!context.user) return false;
    return payload.userId === variables.userId && context.user.id === variables.userId;
  },
};
