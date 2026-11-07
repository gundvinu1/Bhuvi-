import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse, APP_VERSION, BhuviErrorCode } from '@bhuvi/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException ? exception.message : 'An unexpected error occurred';

    const rawResponse = exception instanceof HttpException ? exception.getResponse() : undefined;

    let details: unknown = rawResponse;

    // Handle NestJS validation pipe error objects
    if (typeof rawResponse === 'object' && rawResponse !== null) {
      const respObj = rawResponse as Record<string, unknown>;
      if (Array.isArray(respObj['message'])) {
        message = respObj['message'].join('; ');
        details = respObj['message'];
      } else if (typeof respObj['message'] === 'string') {
        message = respObj['message'];
      }
    }

    this.logger.error(
      `${request.method} ${request.url} → ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    let errorCode: string;
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        errorCode = BhuviErrorCode.VALIDATION_FAILED;
        break;
      case HttpStatus.UNAUTHORIZED:
        errorCode = BhuviErrorCode.UNAUTHORIZED;
        break;
      case HttpStatus.FORBIDDEN:
        errorCode = BhuviErrorCode.FORBIDDEN;
        break;
      case HttpStatus.NOT_FOUND:
        errorCode = BhuviErrorCode.NOT_FOUND;
        break;
      case HttpStatus.CONFLICT:
        errorCode = BhuviErrorCode.USER_ALREADY_EXISTS;
        break;
      case HttpStatus.TOO_MANY_REQUESTS:
        errorCode = BhuviErrorCode.RATE_LIMIT_EXCEEDED;
        break;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        errorCode = BhuviErrorCode.INTERNAL;
        break;
      default:
        errorCode = 'REQUEST_ERROR';
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details: status !== HttpStatus.INTERNAL_SERVER_ERROR ? details : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
      },
    };

    response.status(status).json(errorResponse);
  }
}
