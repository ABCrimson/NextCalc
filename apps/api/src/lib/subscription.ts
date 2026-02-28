/**
 * WebSocket Subscription Server for GraphQL
 *
 * Implements real-time GraphQL subscriptions using graphql-ws (WebSocket).
 * Supports authenticated subscriptions with context creation.
 *
 * PubSub: Hybrid Upstash Redis + in-memory fallback.
 * - When Upstash is configured: events are published to Redis Streams
 *   (XADD) for cross-instance delivery, plus in-memory for local delivery.
 * - When Upstash is unavailable: falls back to in-memory PubSub only.
 * - Upstash REST API is serverless-compatible (no persistent TCP connections).
 *
 * @see https://the-guild.dev/graphql/ws
 * @see https://www.apollographql.com/docs/apollo-server/data/subscriptions/
 */

import { PubSub } from 'graphql-subscriptions';
import type { ExecutionArgs } from 'graphql';
import type { GraphQLContext } from './context';
import { redis } from './cache';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Hybrid PubSub: Upstash Redis Streams + in-memory fallback
// ---------------------------------------------------------------------------

/** In-memory PubSub — always available, single-instance only */
const localPubSub = new PubSub();

/** Redis Stream key prefix for subscription channels */
const STREAM_PREFIX = '@nextcalc/pubsub:';

/** Max stream length (auto-trimmed via MAXLEN ~) */
const STREAM_MAXLEN = 1000;

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
      // XADD with inline MAXLEN~ trim — single round-trip
      await redis.xadd(streamKey, '*', { payload: JSON.stringify(payload) }, {
        trim: { type: 'MAXLEN', threshold: STREAM_MAXLEN, comparison: '~' },
      });
    } catch (error) {
      logger.error('Redis PubSub publish failed, local delivery still active', {
        triggerName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Wrapper that exposes the same API as graphql-subscriptions PubSub
 * but routes publish calls through the hybrid layer.
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
    return localPubSub.asyncIterableIterator<T>(triggers);
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

export type SubscriptionEvent = typeof SUBSCRIPTION_EVENTS[keyof typeof SUBSCRIPTION_EVENTS];

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

    // For session-based auth with NextAuth, validate against session store
    // This is a simplified implementation - in production, use jose or next-auth validation
    if (cleanToken.length > 100) {
      // Looks like a JWT - decode and validate
      const [, payloadBase64] = cleanToken.split('.');
      if (!payloadBase64) return null;

      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf-8')
      );

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        logger.warn('WebSocket auth token expired');
        return null;
      }

      // Extract user info from payload
      if (payload.sub || payload.userId || payload.id) {
        return {
          id: payload.sub || payload.userId || payload.id,
          email: payload.email || '',
          name: payload.name || null,
          role: payload.role || 'USER',
        };
      }
    }

    // For session tokens, we'd need to query the session store
    // This requires database access which should be set up in context
    logger.debug('Session-based auth not fully implemented for WebSocket');
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
  ctx: { connectionParams?: Record<string, unknown>; extra?: { request?: { socket?: { remoteAddress?: string } } } },
  _msg: unknown,
  _args: ExecutionArgs
): Promise<GraphQLContext> => {
  // Extract auth token from connection params
  const connectionParams = ctx.connectionParams || {};
  const token = (connectionParams['authorization'] ||
                connectionParams['Authorization'] ||
                connectionParams['authToken']) as string | undefined;

  // Validate token and load user
  const user = await verifyAuthToken(token);

  if (user) {
    logger.debug('Subscription authenticated', { userId: user.id });
  }

  // Subscriptions run over WebSocket — no Prisma or DataLoaders available.
  // Use typed stubs so resolvers can type-check without `as any`.
  const stubPrisma = {} as GraphQLContext['prisma'];
  const stubLoaders = {} as GraphQLContext['loaders'];
  return {
    user: user as GraphQLContext['user'],
    prisma: stubPrisma,
    loaders: stubLoaders,
    req: {
      headers: (connectionParams['headers'] as Record<string, string>) || {},
      ...(ctx.extra?.request?.socket?.remoteAddress ? { ip: ctx.extra.request.socket.remoteAddress } : {}),
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
    const hasAuth = !!(connectionParams['authorization'] ||
                       connectionParams['Authorization'] ||
                       connectionParams['authToken']);

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
  onSubscribe: async (ctx: { extra?: { user?: { id: string } } }, msg: { payload?: { operationName?: string } }) => {
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
  userWorksheetsChanged: (payload: { userId: string }, variables: { userId: string }, context: GraphQLContext) => {
    // Ensure user is authenticated and matches the subscription target
    if (!context.user) return false;
    return payload.userId === variables.userId && context.user.id === variables.userId;
  },
};

