/**
 * Structured Logger for the GraphQL API
 *
 * Provides JSON-formatted structured logging with:
 * - Configurable log levels via LOG_LEVEL env var
 * - ISO 8601 timestamps on every entry
 * - Arbitrary metadata via Record<string, unknown>
 * - Proper routing to console.error/warn/log based on severity
 * - Child loggers for scoped context (e.g. per-request, per-module)
 *
 * In production, all output is single-line JSON suitable for log aggregation
 * services (CloudWatch, Datadog, Loki, etc.). In development, output remains
 * JSON for consistency but at a human-readable level.
 *
 * @module apps/api/src/lib/logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	service: string;
	[key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel: LogLevel = (() => {
	const envLevel = process.env['LOG_LEVEL'];
	if (envLevel && envLevel in LOG_LEVELS) {
		return envLevel as LogLevel;
	}
	return process.env['NODE_ENV'] === 'production' ? 'info' : 'debug';
})();

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'nextcalc-api';

function log(
	level: LogLevel,
	message: string,
	meta?: Record<string, unknown>,
): void {
	if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
		service: SERVICE_NAME,
		...(meta ? meta : {}),
	};

	const output = JSON.stringify(entry);

	if (level === 'error') {
		console.error(output);
	} else if (level === 'warn') {
		console.warn(output);
	} else {
		console.log(output);
	}
}

export interface Logger {
	debug: (msg: string, meta?: Record<string, unknown>) => void;
	info: (msg: string, meta?: Record<string, unknown>) => void;
	warn: (msg: string, meta?: Record<string, unknown>) => void;
	error: (msg: string, meta?: Record<string, unknown>) => void;
	child: (defaultMeta: Record<string, unknown>) => Logger;
}

function createLogger(defaultMeta?: Record<string, unknown>): Logger {
	const mergeMeta = (
		meta?: Record<string, unknown>,
	): Record<string, unknown> | undefined => {
		if (!defaultMeta && !meta) return undefined;
		return { ...(defaultMeta ?? {}), ...(meta ?? {}) };
	};

	return {
		debug: (msg, meta) => log('debug', msg, mergeMeta(meta)),
		info: (msg, meta) => log('info', msg, mergeMeta(meta)),
		warn: (msg, meta) => log('warn', msg, mergeMeta(meta)),
		error: (msg, meta) => log('error', msg, mergeMeta(meta)),
		child: (childMeta) =>
			createLogger({ ...(defaultMeta ?? {}), ...childMeta }),
	};
}

/**
 * Root logger instance for the API package.
 *
 * Usage:
 * ```ts
 * import { logger } from './lib/logger';
 *
 * logger.info('Server started', { port: 3000 });
 * logger.error('Database connection failed', { error: err.message });
 *
 * // Scoped child logger
 * const resolverLog = logger.child({ module: 'worksheet-resolver' });
 * resolverLog.info('Worksheet created', { worksheetId: '123' });
 * ```
 */
export const logger: Logger = createLogger();
