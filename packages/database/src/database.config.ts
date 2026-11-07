import { SanitizedDatabaseConfig } from './database.types';

/**
 * Parses and sanitizes a PostgreSQL connection URL into safe metadata.
 * Strips password and sensitive credentials to guarantee they are never logged.
 */
export function parseSanitizedDatabaseConfig(url?: string): SanitizedDatabaseConfig | null {
  const connectionUrl = url ?? process.env['DATABASE_URL'];
  if (!connectionUrl) {
    return null;
  }

  try {
    const parsed = new URL(connectionUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'bhuvi',
      user: parsed.username || 'unknown',
      ssl:
        parsed.searchParams.get('sslmode') === 'require' ||
        parsed.searchParams.get('ssl') === 'true',
    };
  } catch {
    return {
      host: 'unparseable',
      port: 5432,
      database: 'unparseable',
      user: 'unparseable',
      ssl: false,
    };
  }
}
