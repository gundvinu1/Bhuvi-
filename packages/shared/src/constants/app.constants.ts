// ============================================================
// Application Constants
// ============================================================

export const APP_NAME = 'BHUVI' as const;
export const APP_FULL_NAME = 'Brain for Human Virtual Intelligence' as const;
export const APP_VERSION = '1.0.0' as const;
export const API_VERSION = 'v1' as const;
export const API_PREFIX = `/api/${API_VERSION}` as const;

/** Default ports – override via environment variables */
export const DEFAULT_PORTS = {
  WEB: 3000,
  API: 3001,
  WORKER: 3002,
} as const;

/** HTTP status codes used by BHUVI */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** Module identifiers – for future use in logging and telemetry */
export const MODULES = {
  FOUNDATION: 'module:01:foundation',
  AUTH: 'module:02:auth',
  DATABASE: 'module:03:database',
  DASHBOARD: 'module:04:dashboard',
  AI_BRAIN: 'module:05:ai-brain',
  AGENT_ORCHESTRATOR: 'module:06:agent-orchestrator',
  MESSAGE_INTELLIGENCE: 'module:07:message-intelligence',
  MEMORY: 'module:08:memory',
  GMAIL: 'module:09:gmail',
  WHATSAPP: 'module:10:whatsapp',
  SOCIAL_MEDIA: 'module:11:social-media',
  CALENDAR: 'module:12:calendar',
  MORNING_INTELLIGENCE: 'module:13:morning-intelligence',
  COMMAND_CENTER: 'module:14:command-center',
  ACTION_ENGINE: 'module:15:action-engine',
  VOICE: 'module:16:voice',
  MOBILE: 'module:17:mobile',
  SECURITY: 'module:18:security',
} as const;
