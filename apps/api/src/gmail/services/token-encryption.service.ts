import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class TokenEncryptionService {
  private readonly logger = new Logger(TokenEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';

  /**
   * Retrieves and normalizes the 256-bit AES encryption key.
   * Derives a cryptographic 32-byte buffer using SHA-256 if a string key is provided.
   */
  private getKey(): Buffer {
    const rawKey =
      process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] ||
      process.env['JWT_SECRET'] ||
      'bhuvi_default_dev_encryption_key_32_bytes_min_length_for_testing';

    if (!rawKey || rawKey.length < 16) {
      this.logger.error(
        'GMAIL_TOKEN_ENCRYPTION_KEY is missing or too short (min 16 chars required).',
      );
      throw new InternalServerErrorException(
        'Server token encryption key is unconfigured or insecure.',
      );
    }

    // If 64-char hex string, parse directly; otherwise hash with SHA-256 to ensure exact 32-byte (256-bit) key
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }

    return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM with a random IV and authenticated tag.
   * Format: `ivHex:authTagHex:encryptedHex`
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    try {
      const key = this.getKey();
      const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err: unknown) {
      this.logger.error(`Token encryption failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to encrypt sensitive token data');
    }
  }

  /**
   * Decrypts ciphertext formatted as `ivHex:authTagHex:encryptedHex` using AES-256-GCM.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      return '';
    }

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format. Expected iv:authTag:encrypted');
      }

      const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
      const key = this.getKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
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
