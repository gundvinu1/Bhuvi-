import { ConflictException, NotFoundException } from '@nestjs/common';
import { WhatsAppConnectionService } from './whatsapp-connection.service';

describe('WhatsAppConnectionService (Multi-Account & Security)', () => {
  let service: WhatsAppConnectionService;
  let mockPrisma: any;
  let mockEncryption: any;

  beforeEach(() => {
    mockPrisma = {
      whatsAppConnection: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockEncryption = {
      encrypt: jest.fn().mockReturnValue({
        encryptedText: 'enc_token_123',
        iv: 'iv_hex_123',
        authTag: 'tag_hex_123',
      }),
      decrypt: jest.fn().mockReturnValue('decrypted_token_real'),
    };

    service = new WhatsAppConnectionService(mockPrisma as any, mockEncryption as any);
  });

  it('allows a user to connect multiple WhatsApp accounts/phone numbers', async () => {
    const userId = 'user-1';

    // Account 1
    mockPrisma.whatsAppConnection.findUnique.mockResolvedValueOnce(null);
    mockPrisma.whatsAppConnection.create.mockResolvedValueOnce({
      id: 'conn-1',
      userId,
      businessAccountId: 'waba-1',
      phoneNumberId: 'phone-id-1',
      displayPhoneNumber: '+1 555-0101',
      displayName: 'Customer Support',
      status: 'CONNECTED',
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const conn1 = await service.createConnection(userId, {
      businessAccountId: 'waba-1',
      phoneNumberId: 'phone-id-1',
      displayPhoneNumber: '+1 555-0101',
      displayName: 'Customer Support',
      accessToken: 'token-1',
    });

    // Account 2
    mockPrisma.whatsAppConnection.findUnique.mockResolvedValueOnce(null);
    mockPrisma.whatsAppConnection.create.mockResolvedValueOnce({
      id: 'conn-2',
      userId,
      businessAccountId: 'waba-2',
      phoneNumberId: 'phone-id-2',
      displayPhoneNumber: '+1 555-0102',
      displayName: 'Sales Line',
      status: 'CONNECTED',
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const conn2 = await service.createConnection(userId, {
      businessAccountId: 'waba-2',
      phoneNumberId: 'phone-id-2',
      displayPhoneNumber: '+1 555-0102',
      displayName: 'Sales Line',
      accessToken: 'token-2',
    });

    expect(conn1.id).toBe('conn-1');
    expect(conn2.id).toBe('conn-2');
    expect(conn1.displayPhoneNumber).toBe('+1 555-0101');
    expect(conn2.displayPhoneNumber).toBe('+1 555-0102');
    expect((conn1 as any).encryptedAccessToken).toBeUndefined();
    expect((conn2 as any).encryptedAccessToken).toBeUndefined();
  });

  it('prevents duplicate connection of the same phone number for the same user', async () => {
    const userId = 'user-1';

    mockPrisma.whatsAppConnection.findUnique.mockResolvedValue({
      id: 'conn-existing',
      userId,
      phoneNumberId: 'phone-id-dup',
      status: 'CONNECTED',
    });

    await expect(
      service.createConnection(userId, {
        businessAccountId: 'waba-1',
        phoneNumberId: 'phone-id-dup',
        displayPhoneNumber: '+1 555-0100',
        displayName: 'Support',
        accessToken: 'token-dup',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('reconnects a previously disconnected account', async () => {
    const userId = 'user-1';

    mockPrisma.whatsAppConnection.findUnique.mockResolvedValue({
      id: 'conn-reconnect',
      userId,
      phoneNumberId: 'phone-id-recon',
      status: 'DISCONNECTED',
    });

    mockPrisma.whatsAppConnection.update.mockResolvedValue({
      id: 'conn-reconnect',
      userId,
      businessAccountId: 'waba-1',
      phoneNumberId: 'phone-id-recon',
      displayPhoneNumber: '+1 555-0100',
      displayName: 'Support Reconnected',
      status: 'CONNECTED',
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const reconnected = await service.createConnection(userId, {
      businessAccountId: 'waba-1',
      phoneNumberId: 'phone-id-recon',
      displayPhoneNumber: '+1 555-0100',
      displayName: 'Support Reconnected',
      accessToken: 'new-token',
    });

    expect(reconnected.status).toBe('CONNECTED');
    expect(mockPrisma.whatsAppConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-reconnect' },
        data: expect.objectContaining({ status: 'CONNECTED' }),
      }),
    );
  });

  it('disconnects one connection without affecting others', async () => {
    const userId = 'user-1';
    const connectionId = 'conn-1';

    mockPrisma.whatsAppConnection.findFirst.mockResolvedValue({
      id: connectionId,
      userId,
      displayPhoneNumber: '+1 555-0101',
      status: 'CONNECTED',
    });

    mockPrisma.whatsAppConnection.update.mockResolvedValue({
      id: connectionId,
      status: 'DISCONNECTED',
    });

    const result = await service.disconnectConnection(userId, connectionId);

    expect(result.disconnected).toBe(true);
    expect(result.connectionId).toBe(connectionId);
    expect(mockPrisma.whatsAppConnection.update).toHaveBeenCalledWith({
      where: { id: connectionId },
      data: { status: 'DISCONNECTED' },
    });
  });

  it('strictly rejects cross-user access to connections', async () => {
    mockPrisma.whatsAppConnection.findFirst.mockResolvedValue(null);

    await expect(service.getConnection('user-attacker', 'conn-victim')).rejects.toThrow(
      NotFoundException,
    );

    await expect(service.disconnectConnection('user-attacker', 'conn-victim')).rejects.toThrow(
      NotFoundException,
    );
  });
});
