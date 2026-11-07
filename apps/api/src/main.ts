import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { API_PREFIX, APP_NAME, APP_VERSION } from '@bhuvi/shared';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // Global API prefix: /api/v1
  app.setGlobalPrefix(API_PREFIX);

  // Cookie parser for secure HttpOnly cookie handling
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS – with credentials enabled for secure cookies
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
  await app.listen(port);

  logger.log(
    `🚀 ${APP_NAME} API v${APP_VERSION} is running on http://localhost:${port}${API_PREFIX}`,
  );
}

void bootstrap();
