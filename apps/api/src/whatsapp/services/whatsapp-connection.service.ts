import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { WhatsAppConnectionDto, WhatsAppConnectionStatus } from '@bhuvi/shared';
import { WhatsAppEncryptionService } from './whatsapp-encryption.service';
import { ConnectWhatsAppDto } from '../dto/create-connection.dto';

@Injectable()
export class WhatsAppConnectionService {
  private readonly logger = new Logger(WhatsAppConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: WhatsAppEncryptionService,
  ) {}

  /**
   * Lists all WhatsApp connections belonging to the specified user.
   * Access tokens and cryptographic tags are never returned.
   */
  async getConnections(userId: string): Promise<WhatsAppConnectionDto[]> {
    const connections = await this.prisma.whatsAppConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((conn) => this.toDto(conn));
  }

  /**
   * Retrieves a single connection ensuring user ownership.
   */
  async getConnection(userId: string, connectionId: string): Promise<WhatsAppConnectionDto> {
    const conn = await this.prisma.whatsAppConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!conn) {
      throw new NotFoundException(`WhatsApp connection '${connectionId}' not found.`);
    }

    return this.toDto(conn);
  }

  /**
   * Connects a new WhatsApp Business phone number.
   * Prevents duplicate phone number connections under the same BHUVI user.
   */
  async createConnection(userId: string, dto: ConnectWhatsAppDto): Promise<WhatsAppConnectionDto> {
    const existing = await this.prisma.whatsAppConnection.findUnique({
      where: {
        userId_phoneNumberId: {
          userId,
          phoneNumberId: dto.phoneNumberId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'DISCONNECTED') {
        // Reconnect previously disconnected account
        const encrypted = this.encryptionService.encrypt(dto.accessToken);
        const updated = await this.prisma.whatsAppConnection.update({
          where: { id: existing.id },
          data: {
            businessAccountId: dto.businessAccountId,
            displayPhoneNumber: dto.displayPhoneNumber,
            displayName: dto.displayName,
            encryptedAccessToken: encrypted.encryptedText,
            tokenIV: encrypted.iv,
            tokenAuthTag: encrypted.authTag,
            status: 'CONNECTED',
            lastActivityAt: new Date(),
          },
        });
        return this.toDto(updated);
      }
      throw new ConflictException(
        `Phone number ID '${dto.phoneNumberId}' is already connected to your account.`,
      );
    }

    const encrypted = this.encryptionService.encrypt(dto.accessToken);

    const created = await this.prisma.whatsAppConnection.create({
      data: {
        userId,
        businessAccountId: dto.businessAccountId,
        phoneNumberId: dto.phoneNumberId,
        displayPhoneNumber: dto.displayPhoneNumber,
        displayName: dto.displayName,
        encryptedAccessToken: encrypted.encryptedText,
        tokenIV: encrypted.iv,
        tokenAuthTag: encrypted.authTag,
        status: 'CONNECTED',
        lastActivityAt: new Date(),
      },
    });

    this.logger.log(`Connected WhatsApp account: ${created.displayPhoneNumber} (${created.id})`);
    return this.toDto(created);
  }

  /**
   * Gracefully disconnects a WhatsApp Business account without destroying past conversation history.
   */
  async disconnectConnection(
    userId: string,
    connectionId: string,
  ): Promise<{ disconnected: boolean; connectionId: string }> {
    const conn = await this.prisma.whatsAppConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!conn) {
      throw new NotFoundException(`WhatsApp connection '${connectionId}' not found.`);
    }

    await this.prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: {
        status: 'DISCONNECTED',
      },
    });

    this.logger.log(`Disconnected WhatsApp account: ${conn.displayPhoneNumber} (${conn.id})`);
    return { disconnected: true, connectionId };
  }

  /**
   * Decrypts the access token for internal API operations.
   */
  async getDecryptedToken(connectionId: string): Promise<string> {
    const conn = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    if (!conn) {
      throw new NotFoundException(`WhatsApp connection '${connectionId}' not found.`);
    }

    return this.encryptionService.decrypt(
      conn.encryptedAccessToken,
      conn.tokenIV,
      conn.tokenAuthTag,
    );
  }

  private toDto(conn: {
    id: string;
    userId: string;
    businessAccountId: string;
    phoneNumberId: string;
    displayPhoneNumber: string;
    displayName: string;
    status: string;
    lastActivityAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WhatsAppConnectionDto {
    return {
      id: conn.id,
      userId: conn.userId,
      businessAccountId: conn.businessAccountId,
      phoneNumberId: conn.phoneNumberId,
      displayPhoneNumber: conn.displayPhoneNumber,
      displayName: conn.displayName,
      status: conn.status as WhatsAppConnectionStatus,
      lastActivityAt: conn.lastActivityAt?.toISOString() ?? null,
      createdAt: conn.createdAt.toISOString(),
      updatedAt: conn.updatedAt.toISOString(),
    };
  }
}
