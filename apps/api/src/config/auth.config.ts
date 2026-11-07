import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  authDevMode: boolean;
}

export default registerAs('auth', (): AuthConfig => {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const isProd = nodeEnv === 'production';
  const rawSecret = process.env['JWT_SECRET'];

  if (isProd) {
    if (!rawSecret || rawSecret.trim().length < 32) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: JWT_SECRET must be configured and be at least 32 characters long in production.',
      );
    }

    const insecurePatterns = ['change_this', 'dev_', 'secret', 'password', '123456'];
    const lower = rawSecret.toLowerCase();
    if (insecurePatterns.some((pattern) => lower.includes(pattern))) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Insecure or placeholder JWT_SECRET detected in production environment.',
      );
    }
  }

  const jwtSecret =
    rawSecret && rawSecret.trim().length > 0
      ? rawSecret.trim()
      : 'bhuvi_dev_super_secret_jwt_key_min_32_characters_for_testing';

  const jwtExpiresIn = process.env['JWT_ACCESS_TOKEN_EXPIRY'] ?? '15m';
  const authDevMode = process.env['AUTH_DEV_MODE'] !== 'false';

  return {
    jwtSecret,
    jwtExpiresIn,
    authDevMode,
  };
});
