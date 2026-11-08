import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { PrismaService } from '@bhuvi/database';
import { GmailConnectionDto, GmailConnectionStatus } from '@bhuvi/shared';
import { TokenEncryptionService } from './token-encryption.service';

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export const DEFAULT_GMAIL_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

@Injectable()
export class GmailOAuthService {
  private readonly logger = new Logger(GmailOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  /**
   * Returns true if Google OAuth credentials are configured.
   */
  isConfigured(): boolean {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    return Boolean(clientId && clientSecret && clientId.trim() && clientSecret.trim());
  }

  /**
   * Instantiates a new Google OAuth2 client.
   */
  getOAuth2Client(): OAuth2Client {
    const clientId = process.env['GOOGLE_CLIENT_ID'] || '';
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] || '';
    const redirectUri =
      process.env['GOOGLE_REDIRECT_URI'] || 'http://localhost:3001/api/v1/gmail/oauth/callback';

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private readonly consumedNonces = new Map<string, number>();

  /**
   * Cleans up expired nonces.
   */
  private cleanExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, expiry] of this.consumedNonces.entries()) {
      if (now > expiry) {
        this.consumedNonces.delete(nonce);
      }
    }
  }

  /**
   * Generates secure signed state token encoding userId, timestamp, and HMAC signature.
   * State format: `userId:timestamp:signature`
   */
  generateState(userId: string): string {
    const secret = process.env['JWT_SECRET'] || 'bhuvi_state_secret_key';
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(8).toString('hex');
    const data = `${userId}:${timestamp}:${nonce}`;
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return Buffer.from(`${data}:${hmac}`).toString('base64url');
  }

  /**
   * Validates state parameter and extracts the authenticated userId.
   * If consume=true, marks the nonce as used to prevent replay attacks.
   */
  validateState(state: string, consume = false): { valid: boolean; userId?: string } {
    if (!state) return { valid: false };

    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 4) return { valid: false };

      const [userId, timestampStr, nonce, receivedHmac] = parts as [string, string, string, string];
      const ts = parseInt(timestampStr, 10);
      const now = Date.now();
      // State valid for 15 minutes (900,000 ms)
      if (isNaN(ts) || now - ts > 15 * 60 * 1000) {
        this.logger.warn(`OAuth state expired for user [${userId}]`);
        return { valid: false };
      }

      this.cleanExpiredNonces();
      if (this.consumedNonces.has(nonce)) {
        this.logger.warn(
          `OAuth state replay attempted for user [${userId}]. Nonce already consumed.`,
        );
        return { valid: false };
      }

      const secret = process.env['JWT_SECRET'] || 'bhuvi_state_secret_key';
      const data = `${userId}:${timestampStr}:${nonce}`;
      const expectedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
        this.logger.warn(`OAuth state HMAC mismatch for user [${userId}]`);
        return { valid: false };
      }

      if (consume) {
        this.consumedNonces.set(nonce, ts + 15 * 60 * 1000);
      }

      return { valid: true, userId };
    } catch (err: unknown) {
      this.logger.warn(`Failed to parse OAuth state: ${(err as Error).message}`);
      return { valid: false };
    }
  }

  /**
   * Generates Google OAuth consent URL.
   * Uses prompt='consent select_account' to allow connecting multiple Google accounts.
   */
  getConnectUrl(userId: string): { url: string; state: string } {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      );
    }

    const oauth2Client = this.getOAuth2Client();
    const state = this.generateState(userId);
    const configuredScopes = process.env['GOOGLE_OAUTH_SCOPES']
      ? process.env['GOOGLE_OAUTH_SCOPES'].split(/\s+/)
      : DEFAULT_GMAIL_SCOPES;

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: configuredScopes,
      prompt: 'consent select_account',
      state,
    });

    return { url, state };
  }

  /**
   * Exchanges authorization code for tokens and registers or updates connection.
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ connectionId: string; email: string }> {
    const { valid, userId } = this.validateState(state, true);
    if (!valid || !userId) {
      throw new BadRequestException('Invalid or expired OAuth state parameter.');
    }

    const oauth2Client = this.getOAuth2Client();
    let tokens;
    try {
      const response = await oauth2Client.getToken(code);
      tokens = response.tokens;
    } catch (tokenErr: unknown) {
      this.logger.error(`Google token exchange failed: ${(tokenErr as Error).message}`);
      throw new BadRequestException('Failed to exchange authorization code with Google.');
    }

    if (!tokens.access_token) {
      throw new BadRequestException('Google did not return an access token.');
    }

    oauth2Client.setCredentials(tokens);

    // Fetch authorized user identity directly from Gmail API (never trust frontend)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    let profile;
    try {
      const profileRes = await gmail.users.getProfile({ userId: 'me' });
      profile = profileRes.data;
    } catch (profileErr: unknown) {
      this.logger.error(`Failed to fetch Gmail profile: ${(profileErr as Error).message}`);
      throw new InternalServerErrorException('Failed to retrieve authorized Gmail profile.');
    }

    const email = profile.emailAddress?.toLowerCase();
    if (!email) {
      throw new InternalServerErrorException('Google account has no associated email address.');
    }

    // Encrypt sensitive tokens using AES-256-GCM
    const encryptedAccessToken = this.tokenEncryption.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? this.tokenEncryption.encrypt(tokens.refresh_token)
      : null;

    const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    const scopes = tokens.scope ? tokens.scope.split(' ') : DEFAULT_GMAIL_SCOPES;

    // Upsert GmailConnection record
    const connection = await this.prisma.gmailConnection.upsert({
      where: {
        userId_googleAccountEmail: {
          userId,
          googleAccountEmail: email,
        },
      },
      create: {
        userId,
        googleAccountEmail: email,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        scopes,
        connectionStatus: 'CONNECTED',
      },
      update: {
        encryptedAccessToken,
        ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
        tokenExpiresAt,
        scopes,
        connectionStatus: 'CONNECTED',
      },
    });

    this.logger.log(`User [${userId}] successfully connected Gmail account [${email}]`);
    return { connectionId: connection.id, email };
  }

  /**
   * Retrieves an authenticated OAuth2Client for a GmailConnection, refreshing tokens if needed.
   */
  async getAuthenticatedClient(connectionId: string, userId: string): Promise<OAuth2Client> {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Gmail connection not found or unauthorized.');
    }

    if (connection.connectionStatus === 'DISCONNECTED') {
      throw new BadRequestException('Gmail connection is disconnected. Please reconnect.');
    }

    const oauth2Client = this.getOAuth2Client();
    const accessToken = this.tokenEncryption.decrypt(connection.encryptedAccessToken);
    const refreshToken = connection.encryptedRefreshToken
      ? this.tokenEncryption.decrypt(connection.encryptedRefreshToken)
      : undefined;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: connection.tokenExpiresAt ? connection.tokenExpiresAt.getTime() : undefined,
    });

    // Check if access token is expired or within 3 minutes of expiry
    const isExpiringSoon =
      connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() < 3 * 60 * 1000;

    if (isExpiringSoon && refreshToken) {
      try {
        this.logger.log(`Refreshing access token for connection [${connectionId}]…`);
        const refreshResponse = await oauth2Client.refreshAccessToken();
        const newTokens = refreshResponse.credentials;

        if (newTokens.access_token) {
          const encryptedNewAccess = this.tokenEncryption.encrypt(newTokens.access_token);
          const encryptedNewRefresh = newTokens.refresh_token
            ? this.tokenEncryption.encrypt(newTokens.refresh_token)
            : undefined;

          await this.prisma.gmailConnection.update({
            where: { id: connectionId },
            data: {
              encryptedAccessToken: encryptedNewAccess,
              ...(encryptedNewRefresh ? { encryptedRefreshToken: encryptedNewRefresh } : {}),
              tokenExpiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
              connectionStatus: 'CONNECTED',
            },
          });
        }
      } catch (refreshErr: unknown) {
        this.logger.error(
          `Token refresh failed for connection [${connectionId}]: ${(refreshErr as Error).message}`,
        );
        await this.prisma.gmailConnection.update({
          where: { id: connectionId },
          data: { connectionStatus: 'REQUIRES_REAUTH' },
        });
        throw new BadRequestException(
          'Gmail authorization expired or revoked by Google. Please reconnect your account.',
        );
      }
    }

    return oauth2Client;
  }

  /**
   * Lists all Gmail connections for a user.
   */
  async getConnections(userId: string): Promise<GmailConnectionDto[]> {
    const connections = await this.prisma.gmailConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((c) => ({
      id: c.id,
      userId: c.userId,
      googleAccountEmail: c.googleAccountEmail,
      googleAccountId: c.googleAccountId,
      connectionStatus: c.connectionStatus as GmailConnectionStatus,
      scopes: c.scopes,
      lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves a specific Gmail connection for a user.
   */
  async getConnection(userId: string, connectionId: string): Promise<GmailConnectionDto> {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Gmail connection not found or unauthorized.');
    }

    return {
      id: connection.id,
      userId: connection.userId,
      googleAccountEmail: connection.googleAccountEmail,
      googleAccountId: connection.googleAccountId,
      connectionStatus: connection.connectionStatus as GmailConnectionStatus,
      scopes: connection.scopes,
      lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  /**
   * Safely disconnects Gmail account: wipes tokens locally and marks status DISCONNECTED.
   * If connectionId is provided, disconnects only that specific connection.
   */
  async disconnect(userId: string, connectionId?: string): Promise<{ disconnected: boolean }> {
    if (connectionId) {
      const conn = await this.prisma.gmailConnection.findUnique({
        where: { id: connectionId },
      });
      if (!conn || conn.userId !== userId) {
        throw new NotFoundException('Gmail connection not found or unauthorized.');
      }
      await this.prisma.gmailConnection.update({
        where: { id: conn.id },
        data: {
          connectionStatus: 'DISCONNECTED',
          encryptedAccessToken: '',
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
        },
      });
      this.logger.log(`Disconnected Gmail connection [${conn.id}] for user [${userId}]`);
      return { disconnected: true };
    }

    const connections = await this.prisma.gmailConnection.findMany({ where: { userId } });
    if (connections.length === 0) {
      return { disconnected: true };
    }

    for (const conn of connections) {
      await this.prisma.gmailConnection.update({
        where: { id: conn.id },
        data: {
          connectionStatus: 'DISCONNECTED',
          encryptedAccessToken: '',
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
        },
      });
      this.logger.log(`Disconnected Gmail connection [${conn.id}] for user [${userId}]`);
    }

    return { disconnected: true };
  }
}
