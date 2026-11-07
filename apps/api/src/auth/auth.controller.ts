import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse, AuthResponseData, SafeUser, APP_VERSION } from '@bhuvi/shared';

@Controller('auth')
export class AuthController {
  private readonly COOKIE_NAME = 'bhuvi_token';
  private readonly COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

  constructor(private readonly authService: AuthService) {}

  /**
   * Helper to format standardized ApiResponse envelopes
   */
  private formatResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
      },
    };
  }

  /**
   * Helper to set secure HttpOnly authentication cookie
   */
  private setAuthCookie(res: Response | undefined, token: string): void {
    if (!res || typeof res.cookie !== 'function') {
      return;
    }
    const isProd = process.env['NODE_ENV'] === 'production';
    res.cookie(this.COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: this.COOKIE_MAX_AGE_MS,
    });
  }

  /**
   * POST /api/v1/auth/register
   * Registers a new user account, sets HttpOnly cookie, and returns access token.
   * Throttled: max 5 registration attempts per minute per IP.
   */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<ApiResponse<AuthResponseData>> {
    const result = await this.authService.register(dto);
    this.setAuthCookie(res, result.accessToken);
    return this.formatResponse(result);
  }

  /**
   * POST /api/v1/auth/login
   * Authenticates user credentials, sets HttpOnly cookie, and returns access token.
   * Throttled: max 5 login attempts per minute per IP to defend against brute force.
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<ApiResponse<AuthResponseData>> {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result.accessToken);
    return this.formatResponse(result);
  }

  /**
   * POST /api/v1/auth/logout
   * Clears the secure HttpOnly authentication cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) res?: Response,
  ): Promise<ApiResponse<{ message: string }>> {
    const isProd = process.env['NODE_ENV'] === 'production';
    if (res && typeof res.clearCookie === 'function') {
      res.clearCookie(this.COOKIE_NAME, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
      });
    }
    return this.formatResponse({ message: 'Successfully signed out' });
  }

  /**
   * GET /api/v1/auth/me
   * Protected endpoint returning the safe profile of the currently authenticated user.
   * Accepts both Bearer token header and HttpOnly cookie.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: SafeUser): Promise<ApiResponse<SafeUser>> {
    const current = await this.authService.getMe(user.id);
    return this.formatResponse(current);
  }
}
