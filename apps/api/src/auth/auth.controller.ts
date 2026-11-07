import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse, AuthResponseData, SafeUser, APP_VERSION } from '@bhuvi/shared';

@Controller('auth')
export class AuthController {
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
   * POST /api/v1/auth/register
   * Registers a new user account and returns an access token with safe user profile.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<ApiResponse<AuthResponseData>> {
    const result = await this.authService.register(dto);
    return this.formatResponse(result);
  }

  /**
   * POST /api/v1/auth/login
   * Authenticates user credentials and returns an access token with safe user profile.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<ApiResponse<AuthResponseData>> {
    const result = await this.authService.login(dto);
    return this.formatResponse(result);
  }

  /**
   * GET /api/v1/auth/me
   * Protected endpoint returning the safe profile of the currently authenticated user.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: SafeUser): Promise<ApiResponse<SafeUser>> {
    // Re-verify user via service to ensure fresh state
    const current = await this.authService.getMe(user.id);
    return this.formatResponse(current);
  }
}
