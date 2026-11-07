export type { User as PrismaUser } from '@prisma/client';

/**
 * Health check result for PostgreSQL database connection.
 */
export interface DatabaseHealthStatus {
  status: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
}

/**
 * Sanitized database configuration metadata (never leaks credentials).
 */
export interface SanitizedDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
}
