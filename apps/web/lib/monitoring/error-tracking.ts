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
// Default Console Implementation (Development/Fallback)
// ============================================================================

class ConsoleErrorTracking implements ErrorTrackingService {
  async captureError(error: Error, context?: ErrorContext): Promise<void> {
    console.error('[ErrorTracking] Error captured:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  async captureMessage(message: string, context?: ErrorContext): Promise<void> {
    const logFn = context?.level === 'error' || context?.level === 'fatal'
      ? console.error
      : context?.level === 'warning'
        ? console.warn
        : console.info;

    logFn('[ErrorTracking] Message:', {
      message,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  setUser(userId: string, userData?: Record<string, unknown>): void {
    console.debug('[ErrorTracking] User set:', { userId, ...userData });
  }

  addBreadcrumb(message: string, data?: Record<string, unknown>): void {
    console.debug('[ErrorTracking] Breadcrumb:', { message, ...data });
  }
}

class ConsoleMetrics implements MetricsService {
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    console.debug('[Metrics] Recorded:', {
      ...metric,
      timestamp: metric.timestamp || new Date().toISOString(),
    });
  }

  async recordHistogram(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    console.debug('[Metrics] Histogram:', { name, value, tags });
  }

  async incrementCounter(name: string, tags?: Record<string, string>): Promise<void> {
    console.debug('[Metrics] Counter incremented:', { name, tags });
  }
}

class ConsoleAnalytics implements AnalyticsService {
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    console.debug('[Analytics] Event:', {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  identifyUser(userId: string, traits?: Record<string, unknown>): void {
    console.debug('[Analytics] User identified:', { userId, ...traits });
  }

  trackPageView(path: string, properties?: Record<string, unknown>): void {
    console.debug('[Analytics] Page view:', { path, ...properties });
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
    console.error('Failed to capture error:', e);
  }
}

/**
 * Capture and report a message
 */
export async function captureMessage(message: string, context?: ErrorContext): Promise<void> {
  try {
    await errorTrackingService.captureMessage(message, context);
  } catch (e) {
    console.error('Failed to capture message:', e);
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
    console.error('Failed to set user:', e);
  }
}

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  try {
    errorTrackingService.addBreadcrumb(message, data);
  } catch (e) {
    console.error('Failed to add breadcrumb:', e);
  }
}

/**
 * Record a performance metric
 */
export async function recordMetric(metric: PerformanceMetric): Promise<void> {
  try {
    await metricsService.recordMetric(metric);
  } catch (e) {
    console.error('Failed to record metric:', e);
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
    console.error('Failed to record histogram:', e);
  }
}

/**
 * Increment a counter
 */
export async function incrementCounter(name: string, tags?: Record<string, string>): Promise<void> {
  try {
    await metricsService.incrementCounter(name, tags);
  } catch (e) {
    console.error('Failed to increment counter:', e);
  }
}

/**
 * Track an analytics event
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    await analyticsService.trackEvent(event);
  } catch (e) {
    console.error('Failed to track event:', e);
  }
}

/**
 * Track a page view
 */
export function trackPageView(path: string, properties?: Record<string, unknown>): void {
  try {
    analyticsService.trackPageView(path, properties);
  } catch (e) {
    console.error('Failed to track page view:', e);
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
