/**
 * API Monitoring and Metrics Utilities
 *
 * Provides centralized monitoring interfaces for the GraphQL API server.
 * Can be configured to send metrics to DataDog, New Relic, Prometheus, etc.
 *
 * @module apps/api/src/lib/monitoring
 */

import { logger } from './logger';

/**
 * Performance metric interface
 */
export interface PerformanceMetric {
  operationName?: string | null;
  operationType?: string;
  duration: number;
  resolverDurations?: Map<string, number>;
  errors: number;
  timestamp: string;
  tags?: Record<string, string>;
}

/**
 * Error context for tracking
 */
export interface ErrorContext {
  operationName?: string | null;
  path?: readonly (string | number)[];
  extensions?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  userId?: string;
}

/**
 * Analytics event
 */
export interface AnalyticsUsage {
  operationName?: string | null;
  operationType?: string;
  userId?: string;
  timestamp: string;
}

/**
 * Monitoring service interface
 */
export interface MonitoringService {
  sendMetrics(metrics: PerformanceMetric): Promise<void>;
  sendError(error: Error, context?: ErrorContext): Promise<void>;
  sendUsage(usage: AnalyticsUsage): Promise<void>;
}

// ============================================================================
// Default Console Implementation
// ============================================================================

class ConsoleMonitoringService implements MonitoringService {
  async sendMetrics(metrics: PerformanceMetric): Promise<void> {
    logger.info('Performance metrics', {
      type: 'METRICS',
      operationName: metrics.operationName ?? 'anonymous',
      operationType: metrics.operationType,
      durationMs: metrics.duration,
      errors: metrics.errors,
      ...(metrics.resolverDurations
        ? { resolverDurations: Object.fromEntries(metrics.resolverDurations) }
        : {}),
      ...(metrics.tags ? { tags: metrics.tags } : {}),
    });
  }

  async sendError(error: Error, context?: ErrorContext): Promise<void> {
    logger.error('Monitoring error captured', {
      type: 'ERROR',
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...(context ? context : {}),
    });
  }

  async sendUsage(usage: AnalyticsUsage): Promise<void> {
    logger.debug('Usage analytics', {
      type: 'USAGE',
      operationName: usage.operationName ?? 'anonymous',
      operationType: usage.operationType,
      ...(usage.userId ? { userId: usage.userId } : {}),
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let monitoringService: MonitoringService = new ConsoleMonitoringService();

/**
 * Configure the monitoring service
 */
export function configureMonitoring(service: MonitoringService): void {
  monitoringService = service;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send performance metrics to monitoring service
 */
export async function sendMetrics(metrics: PerformanceMetric): Promise<void> {
  try {
    await monitoringService.sendMetrics(metrics);
  } catch (e) {
    logger.error('Failed to send metrics', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Send error to tracking service
 */
export async function sendError(error: Error, context?: ErrorContext): Promise<void> {
  try {
    await monitoringService.sendError(error, context);
  } catch (e) {
    logger.error('Failed to send error report', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Send usage analytics
 */
export async function sendUsage(usage: AnalyticsUsage): Promise<void> {
  try {
    await monitoringService.sendUsage(usage);
  } catch (e) {
    logger.error('Failed to send usage analytics', { error: e instanceof Error ? e.message : String(e) });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a timer for measuring operation duration
 */
export function startTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1_000_000; // Convert to milliseconds
  };
}

/**
 * Format resolver durations for logging
 */
export function formatResolverDurations(
  durations: Map<string, number>,
  totalDuration: number,
  limit = 10
): Array<{ field: string; duration: string; percentage: string }> {
  return Array.from(durations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([field, ms]) => ({
      field,
      duration: `${ms}ms`,
      percentage: `${((ms / totalDuration) * 100).toFixed(1)}%`,
    }));
}
