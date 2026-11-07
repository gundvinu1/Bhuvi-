import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SafeUser } from '@bhuvi/shared';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser = SafeUser>(
    err: unknown,
    user: TUser,
    info: unknown,
  ): TUser {
    if (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Authentication failed');
    }

    if (!user) {
      if (info instanceof Error) {
        if (info.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Token has expired');
        }
        if (info.name === 'JsonWebTokenError') {
          throw new UnauthorizedException('Invalid authentication token');
        }
      }
      throw new UnauthorizedException('Authentication required: missing or invalid bearer token');
    }

    return user;
  }
}

