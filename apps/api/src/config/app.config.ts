import { registerAs } from '@nestjs/config';
import { APP_NAME, APP_VERSION, DEFAULT_PORTS } from '@bhuvi/shared';

export default registerAs('app', () => ({
  name: APP_NAME,
  version: APP_VERSION,
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['API_PORT'] ?? String(DEFAULT_PORTS.API), 10),
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
}));

