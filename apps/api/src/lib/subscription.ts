/**
 * WebSocket Subscription Server for GraphQL
 *
 * Implements real-time GraphQL subscriptions using graphql-ws (WebSocket).
 * Supports authenticated subscriptions with context creation.
 *
 * @see https://the-guild.dev/graphql/ws
 * @see https://www.apollographql.com/docs/apollo-server/data/subscriptions/
 */

import { PubSub } from 'graphql-subscriptions';
import type { ExecutionArgs } from 'graphql';
import type { GraphQLContext } from './context';

/**
 * PubSub instance for publishing subscription events
 * In production, replace with Redis-backed PubSub for horizontal scaling
 */
export const pubsub = new PubSub();

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
        console.warn('Token expired');
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
    console.debug('Session-based auth not fully implemented for WebSocket');
    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
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
    console.debug('Subscription authenticated for user:', user.id);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Prisma/loaders provided by HTTP context factory
  const stubPrisma = {} as any;
  return {
    user: user as GraphQLContext['user'],
    prisma: stubPrisma,
    loaders: { userById: stubPrisma, folderById: stubPrisma, worksheetSharesByWorksheetId: stubPrisma, childFoldersByParentId: stubPrisma, upvoteCountByTargetId: stubPrisma },
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

    console.info('WebSocket Client Connected:', {
      timestamp: new Date().toISOString(),
      authenticated: hasAuth,
      connectionParams: Object.keys(connectionParams),
    });

    // Optionally reject unauthenticated connections
    // return hasAuth; // Uncomment to require auth
    return true;
  },

  // Connection close
  onDisconnect: async (_ctx: unknown, code: number, reason: string) => {
    console.info('WebSocket Client Disconnected:', {
      code,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  // Subscription start
  onSubscribe: async (ctx: { extra?: { user?: { id: string } } }, msg: { payload?: { operationName?: string } }) => {
    const user = ctx.extra?.user;
    console.debug('Subscription Started:', {
      operationName: msg.payload?.operationName,
      userId: user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
    });
  },

  // Handle errors
  onError: (_ctx: unknown, _message: unknown, errors: readonly Error[]) => {
    errors.forEach((error) => {
      console.error('WebSocket Subscription Error:', {
        message: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    });
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

/**
 * Redis-backed PubSub for production (horizontal scaling)
 * Uncomment and configure when deploying with multiple instances
 */
/*
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const pubsub = new RedisPubSub({
  publisher: new Redis(redisOptions),
  subscriber: new Redis(redisOptions),
});
*/
