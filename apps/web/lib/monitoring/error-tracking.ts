/**
 * Error Tracking and Monitoring Utilities
 *
 * Provides a centralized interface for error tracking that can be configured
 * to use various monitoring services (Sentry, DataDog, Rollbar, etc.)
 *
 * @module lib/monitoring/error-tracking
 */

/**
 * Error context with additional metadata
 */
export interface ErrorContext {
  /** Component or module where error occurred */
  component?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Error level/severity */
  level?: 'info' | 'warning' | 'error' | 'fatal';
  /** Error digest from Next.js */
  digest?: string;
  /** Tags for categorization */
  tags?: Record<string, string>;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  tags?: Record<string, string>;
  timestamp?: string;
}

/**
 * Analytics event interface
 */
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  userId?: string;
  timestamp?: string;
}

/**
 * Error tracking service interface
 * Implement this to connect to specific monitoring services
 */
export interface ErrorTrackingService {
  captureError(error: Error, context?: ErrorContext): Promise<void>;
  captureMessage(message: string, context?: ErrorContext): Promise<void>;
  setUser(userId: string, userData?: Record<string, unknown>): void;
  addBreadcrumb(message: string, data?: Record<string, unknown>): void;
}

/**
 * Metrics service interface
 */
export interface MetricsService {
  recordMetric(metric: PerformanceMetric): Promise<void>;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): Promise<void>;
  incrementCounter(name: string, tags?: Record<string, string>): Promise<void>;
}

/**
 * Analytics service interface
 */
export interface AnalyticsService {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  identifyUser(userId: string, traits?: Record<string, unknown>): void;
  trackPageView(path: string, properties?: Record<string, unknown>): void;
}

// ============================================================================
// Structured Log Helper (browser-safe JSON logging)
// ============================================================================

type WebLogLevel = 'debug' | 'info' | 'warn' | 'error';

function structuredLog(level: WebLogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'nextcalc-web',
    ...(meta ?? {}),
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else if (level === 'debug') {
    console.debug(output);
  } else {
    console.log(output);
  }
}

// ============================================================================
// Default Console Implementation (Development/Fallback)
// ============================================================================

class ConsoleErrorTracking implements ErrorTrackingService {
  async captureError(error: Error, context?: ErrorContext): Promise<void> {
    structuredLog('error', 'Error captured', {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...(context ?? {}),
    });
  }

  async captureMessage(message: string, context?: ErrorContext): Promise<void> {
    const level: WebLogLevel =
      context?.level === 'error' || context?.level === 'fatal'
        ? 'error'
        : context?.level === 'warning'
          ? 'warn'
          : 'info';

    structuredLog(level, message, context ? { ...context } : undefined);
  }

  setUser(userId: string, userData?: Record<string, unknown>): void {
    structuredLog('debug', 'User context set', { userId, ...userData });
  }

  addBreadcrumb(message: string, data?: Record<string, unknown>): void {
    structuredLog('debug', `Breadcrumb: ${message}`, data);
  }
}

class ConsoleMetrics implements MetricsService {
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    structuredLog('debug', 'Metric recorded', {
      ...metric,
      timestamp: metric.timestamp || new Date().toISOString(),
    });
  }

  async recordHistogram(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    structuredLog('debug', 'Histogram recorded', { name, value, ...(tags ? { tags } : {}) });
  }

  async incrementCounter(name: string, tags?: Record<string, string>): Promise<void> {
    structuredLog('debug', 'Counter incremented', { name, ...(tags ? { tags } : {}) });
  }
}

class ConsoleAnalytics implements AnalyticsService {
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    structuredLog('debug', 'Analytics event', {
      eventName: event.name,
      ...(event.properties ? { properties: event.properties } : {}),
      ...(event.userId ? { userId: event.userId } : {}),
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  identifyUser(userId: string, traits?: Record<string, unknown>): void {
    structuredLog('debug', 'User identified', { userId, ...(traits ?? {}) });
  }

  trackPageView(path: string, properties?: Record<string, unknown>): void {
    structuredLog('debug', 'Page view', { path, ...(properties ?? {}) });
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

let errorTrackingService: ErrorTrackingService = new ConsoleErrorTracking();
let metricsService: MetricsService = new ConsoleMetrics();
let analyticsService: AnalyticsService = new ConsoleAnalytics();

/**
 * Configure the error tracking service
 * Call this early in app initialization to set up your preferred service
 */
export function configureErrorTracking(service: ErrorTrackingService): void {
  errorTrackingService = service;
}

/**
 * Configure the metrics service
 */
export function configureMetrics(service: MetricsService): void {
  metricsService = service;
}

/**
 * Configure the analytics service
 */
export function configureAnalytics(service: AnalyticsService): void {
  analyticsService = service;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Capture and report an error
 */
export async function captureError(error: Error, context?: ErrorContext): Promise<void> {
  try {
    await errorTrackingService.captureError(error, context);
  } catch (e) {
    // Fail silently to avoid cascading errors
    structuredLog('error', 'Failed to capture error', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Capture and report a message
 */
export async function captureMessage(message: string, context?: ErrorContext): Promise<void> {
  try {
    await errorTrackingService.captureMessage(message, context);
  } catch (e) {
    structuredLog('error', 'Failed to capture message', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Set the current user for error context
 */
export function setUser(userId: string, userData?: Record<string, unknown>): void {
  try {
    errorTrackingService.setUser(userId, userData);
    analyticsService.identifyUser(userId, userData);
  } catch (e) {
    structuredLog('error', 'Failed to set user', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  try {
    errorTrackingService.addBreadcrumb(message, data);
  } catch (e) {
    structuredLog('error', 'Failed to add breadcrumb', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Record a performance metric
 */
export async function recordMetric(metric: PerformanceMetric): Promise<void> {
  try {
    await metricsService.recordMetric(metric);
  } catch (e) {
    structuredLog('error', 'Failed to record metric', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Record a histogram value
 */
export async function recordHistogram(
  name: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  try {
    await metricsService.recordHistogram(name, value, tags);
  } catch (e) {
    structuredLog('error', 'Failed to record histogram', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Increment a counter
 */
export async function incrementCounter(name: string, tags?: Record<string, string>): Promise<void> {
  try {
    await metricsService.incrementCounter(name, tags);
  } catch (e) {
    structuredLog('error', 'Failed to increment counter', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Track an analytics event
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    await analyticsService.trackEvent(event);
  } catch (e) {
    structuredLog('error', 'Failed to track event', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Track a page view
 */
export function trackPageView(path: string, properties?: Record<string, unknown>): void {
  try {
    analyticsService.trackPageView(path, properties);
  } catch (e) {
    structuredLog('error', 'Failed to track page view', { error: e instanceof Error ? e.message : String(e) });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap a function with error capturing
 */
export function withErrorCapture<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: ErrorContext
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          captureError(error, context);
          throw error;
        });
      }
      return result;
    } catch (error) {
      captureError(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * Create a timed operation that records duration
 */
export function startTimer(name: string, tags?: Record<string, string>): () => Promise<void> {
  const startTime = performance.now();
  return async () => {
    const duration = performance.now() - startTime;
    await recordMetric({
      name,
      value: duration,
      unit: 'ms',
      ...(tags ? { tags } : {}),
      timestamp: new Date().toISOString(),
    });
  };
}
