import { parseSanitizedDatabaseConfig } from '@bhuvi/database';
import { getRedisConnectionOptions, getSanitizedRedisConfig } from '@bhuvi/queue';

describe('Infrastructure Configuration & Sanitization Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('PostgreSQL Configuration Sanitization', () => {
    it('should parse database URL without leaking password in sanitized output', () => {
      const url =
        'postgresql://bhuvi_admin:SuperSecretPassword123!@db.internal.host:5432/bhuvi_prod?sslmode=require';
      const sanitized = parseSanitizedDatabaseConfig(url);

      expect(sanitized).toBeDefined();
      expect(sanitized?.host).toBe('db.internal.host');
      expect(sanitized?.port).toBe(5432);
      expect(sanitized?.database).toBe('bhuvi_prod');
      expect(sanitized?.user).toBe('bhuvi_admin');
      expect(sanitized?.ssl).toBe(true);

      // Verify that no password property exists in sanitized object
      expect((sanitized as unknown as Record<string, unknown>)['password']).toBeUndefined();
      const stringified = JSON.stringify(sanitized);
      expect(stringified).not.toContain('SuperSecretPassword123!');
    });

    it('should return null when no database URL is provided and none in env', () => {
      delete process.env['DATABASE_URL'];
      const result = parseSanitizedDatabaseConfig(undefined);
      expect(result).toBeNull();
    });
  });

  describe('Redis Configuration Sanitization', () => {
    it('should parse Redis connection options correctly from URL', () => {
      process.env['REDIS_URL'] = 'redis://:SecretRedisAuthToken@redis.internal.host:6380';
      const options = getRedisConnectionOptions();

      expect(options.host).toBe('redis.internal.host');
      expect(options.port).toBe(6380);
      expect(options.password).toBe('SecretRedisAuthToken');
      expect(options.maxRetriesPerRequest).toBeNull();
      expect(options.enableReadyCheck).toBe(false);
    });

    it('should never expose Redis password in sanitized config', () => {
      process.env['REDIS_URL'] = 'redis://:SuperSecretRedisPass@cache.host:6379';
      const sanitized = getSanitizedRedisConfig();

      expect(sanitized.host).toBe('cache.host');
      expect(sanitized.port).toBe(6379);
      expect(sanitized.hasPassword).toBe(true);
      expect((sanitized as unknown as Record<string, unknown>)['password']).toBeUndefined();

      const stringified = JSON.stringify(sanitized);
      expect(stringified).not.toContain('SuperSecretRedisPass');
    });
  });
});
