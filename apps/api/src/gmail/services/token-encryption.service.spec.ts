import { InternalServerErrorException } from '@nestjs/common';
import { TokenEncryptionService } from './token-encryption.service';

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;
  const originalEnv = process.env['GMAIL_TOKEN_ENCRYPTION_KEY'];

  beforeEach(() => {
    process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] =
      'bhuvi_super_secret_test_encryption_key_32_bytes_length';
    service = new TokenEncryptionService();
  });

  afterAll(() => {
    if (originalEnv) {
      process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] = originalEnv;
    } else {
      delete process.env['GMAIL_TOKEN_ENCRYPTION_KEY'];
    }
  });

  it('should encrypt plaintext into iv:authTag:ciphertext format', () => {
    const secretToken = 'ya29.a0AfH6SMD_test_google_oauth_access_token_12345';
    const encrypted = service.encrypt(secretToken);

    expect(typeof encrypted).toBe('string');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    const [iv, authTag, ciphertext] = parts;
    expect(iv.length).toBe(24); // 12 bytes = 24 hex characters
    expect(authTag.length).toBe(32); // 16 bytes = 32 hex characters
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(encrypted).not.toContain(secretToken);
  });

  it('should decrypt ciphertext back to original plaintext accurately', () => {
    const refreshToken = '1//0gK7_test_google_refresh_token_xyz987654321';
    const encrypted = service.encrypt(refreshToken);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(refreshToken);
  });

  it('should generate distinct ciphertexts for identical plaintext due to random IVs', () => {
    const token = 'identical_secret_token_value';
    const enc1 = service.encrypt(token);
    const enc2 = service.encrypt(token);

    expect(enc1).not.toBe(enc2);
    expect(service.decrypt(enc1)).toBe(token);
    expect(service.decrypt(enc2)).toBe(token);
  });

  it('should reject tampered ciphertext with InternalServerErrorException', () => {
    const token = 'genuine_token_payload';
    const encrypted = service.encrypt(token);
    const parts = encrypted.split(':');

    // Tamper with ciphertext payload
    const tamperedPayload = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${tamperedPayload}`;

    expect(() => service.decrypt(tamperedCiphertext)).toThrow(InternalServerErrorException);
  });

  it('should reject altered authentication tag with InternalServerErrorException', () => {
    const token = 'genuine_token_payload';
    const encrypted = service.encrypt(token);
    const parts = encrypted.split(':');

    // Tamper with auth tag
    const tamperedTag = '0'.repeat(32);
    const tamperedCiphertext = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => service.decrypt(tamperedCiphertext)).toThrow(InternalServerErrorException);
  });

  it('should reject malformed ciphertext lacking delimiter parts', () => {
    expect(() => service.decrypt('not_valid_format')).toThrow(InternalServerErrorException);
    expect(() => service.decrypt('only:two_parts')).toThrow(InternalServerErrorException);
  });

  it('should handle empty strings safely without throwing', () => {
    expect(service.encrypt('')).toBe('');
    expect(service.decrypt('')).toBe('');
  });
});
