import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptedData {
  encryptedText: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class WhatsAppEncryptionService {
  private readonly logger = new Logger(WhatsAppEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';

  private getKey(): Buffer {
    const rawKey =
      process.env['WHATSAPP_TOKEN_ENCRYPTION_KEY'] ||
      process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] ||
      process.env['JWT_SECRET'] ||
      'bhuvi_default_dev_encryption_key_32_bytes_min_length_for_testing';

    if (!rawKey || rawKey.length < 16) {
      this.logger.error('WHATSAPP_TOKEN_ENCRYPTION_KEY is missing or too short.');
      throw new InternalServerErrorException(
        'Server token encryption key is unconfigured or insecure.',
      );
    }

    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }

    return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
  }

  encrypt(plaintext: string): EncryptedData {
    if (!plaintext) {
      return { encryptedText: '', iv: '', authTag: '' };
    }

    try {
      const key = this.getKey();
      const iv = crypto.randomBytes(12); // 96-bit IV standard for AES-GCM
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');
      return {
        encryptedText: encrypted,
        iv: iv.toString('hex'),
        authTag,
      };
    } catch (err: unknown) {
      this.logger.error(`Token encryption failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to encrypt sensitive WhatsApp token data');
    }
  }

  decrypt(encryptedText: string, ivHex: string, authTagHex: string): string {
    if (!encryptedText || !ivHex || !authTagHex) {
      return '';
    }

    try {
      const key = this.getKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err: unknown) {
      this.logger.error(`Token decryption failed: ${(err as Error).message}`);
      throw new InternalServerErrorException(
        'Failed to decrypt token: authentication tag mismatch or invalid key',
      );
    }
  }
}
