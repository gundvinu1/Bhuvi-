import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from '@bhuvi/shared';

/**
 * Parameter decorator to extract the authenticated user from the HTTP request.
 * Populated by JwtAuthGuard / JwtStrategy.
 *
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentUser() user: SafeUser) { ... }
 *
 *   @Get('id')
 *   getId(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof SafeUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: SafeUser }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
