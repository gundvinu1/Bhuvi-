import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseData, JwtPayload, SafeUser } from '@bhuvi/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;
  private readonly tokenExpiry: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.tokenExpiry = this.configService.get<string>('auth.jwtExpiresIn') ?? '15m';
  }

  /**
   * Registers a new user account.
   * - Normalizes email.
   * - Rejects duplicates.
   * - Hashes password using bcrypt.
   * - Emits access token and safe user profile.
   */
  async register(dto: RegisterDto): Promise<AuthResponseData> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(normalizedEmail);

    if (existing) {
      this.logger.warn(`Registration rejected: duplicate email attempted for [${normalizedEmail}]`);
      throw new ConflictException('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.create(dto.name.trim(), normalizedEmail, passwordHash);

    const safeUser = this.usersService.toSafeUser(user);
    const accessToken = await this.generateToken(safeUser);

    this.logger.log(`User registered successfully: [${safeUser.id}] ${safeUser.email}`);

    return {
      user: safeUser,
      accessToken,
      expiresIn: this.tokenExpiry,
    };
  }

  /**
   * Authenticates user credentials.
   * - Uses constant-time comparison via bcrypt.
   * - Employs a generic error message to mitigate user enumeration attacks.
   */
  async login(dto: LoginDto): Promise<AuthResponseData> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      // Prevent user enumeration by not revealing whether email exists
      this.logger.warn(`Login failed: user not found for [${normalizedEmail}]`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for [${normalizedEmail}]`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const safeUser = this.usersService.toSafeUser(user);
    const accessToken = await this.generateToken(safeUser);

    this.logger.log(`User authenticated successfully: [${safeUser.id}] ${safeUser.email}`);

    return {
      user: safeUser,
      accessToken,
      expiresIn: this.tokenExpiry,
    };
  }

  /**
   * Retrieves the current user's safe profile.
   */
  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }
    return this.usersService.toSafeUser(user);
  }

  /**
   * Generates a signed JWT access token.
   */
  private async generateToken(user: SafeUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return this.jwtService.signAsync(payload);
  }
}
