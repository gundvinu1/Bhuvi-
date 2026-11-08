import { SanitizedRedisConfig } from './queue.types';

export interface RedisConfigOptions {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null; // Required by BullMQ
  enableReadyCheck: false; // Recommended for BullMQ
  lazyConnect?: boolean;
}

/**
 * Extracts and sanitizes Redis configuration options suitable for BullMQ and ioredis.
 */
export function getRedisConnectionOptions(): RedisConfigOptions {
  const redisUrl = process.env['REDIS_URL'];

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      const host =
        parsed.hostname === 'localhost' || !parsed.hostname ? '127.0.0.1' : parsed.hostname;
      return {
        host,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
        password: parsed.password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      };
    } catch {
      // Fallback if URL cannot be parsed
    }
  }

  const rawHost = process.env['REDIS_HOST'] || '127.0.0.1';
  const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
  const port = parseInt(process.env['REDIS_PORT'] || '6379', 10);
  const password = process.env['REDIS_PASSWORD'] || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  };
}

/**
 * Sanitized connection details suitable for logs and health checks.
 */
export function getSanitizedRedisConfig(): SanitizedRedisConfig {
  const options = getRedisConnectionOptions();
  return {
    host: options.host,
    port: options.port,
    hasPassword: Boolean(options.password),
  };
}
