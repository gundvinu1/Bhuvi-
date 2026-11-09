import { WhatsAppEncryptionService } from './whatsapp-encryption.service';

describe('WhatsAppEncryptionService', () => {
  let service: WhatsAppEncryptionService;

  beforeEach(() => {
    process.env['WHATSAPP_TOKEN_ENCRYPTION_KEY'] = 'test_whatsapp_secret_key_32_bytes_long_exact!';
    service = new WhatsAppEncryptionService();
  });

  afterEach(() => {
    delete process.env['WHATSAPP_TOKEN_ENCRYPTION_KEY'];
  });

  it('encrypts and decrypts access token correctly', () => {
    const rawToken = 'EAABwzLIX564BAO7...mock_meta_access_token';
    const encrypted = service.encrypt(rawToken);

    expect(encrypted.encryptedText).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes = 32 hex chars

    const decrypted = service.decrypt(encrypted.encryptedText, encrypted.iv, encrypted.authTag);
    expect(decrypted).toBe(rawToken);
  });

  it('produces different ciphertexts for the same plaintext due to random IV', () => {
    const rawToken = 'sample_whatsapp_token_12345';
    const enc1 = service.encrypt(rawToken);
    const enc2 = service.encrypt(rawToken);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encryptedText).not.toBe(enc2.encryptedText);

    expect(service.decrypt(enc1.encryptedText, enc1.iv, enc1.authTag)).toBe(rawToken);
    expect(service.decrypt(enc2.encryptedText, enc2.iv, enc2.authTag)).toBe(rawToken);
  });

  it('rejects tampered ciphertext with authentication error', () => {
    const rawToken = 'secure_whatsapp_token';
    const encrypted = service.encrypt(rawToken);

    // Tamper with one character of ciphertext
    const tamperedText =
      encrypted.encryptedText.slice(0, -1) + (encrypted.encryptedText.endsWith('a') ? 'b' : 'a');

    expect(() => service.decrypt(tamperedText, encrypted.iv, encrypted.authTag)).toThrow(
      /Failed to decrypt token/,
    );
  });

  it('rejects tampered auth tag', () => {
    const rawToken = 'secure_whatsapp_token';
    const encrypted = service.encrypt(rawToken);

    const tamperedTag = '0'.repeat(32);

    expect(() => service.decrypt(encrypted.encryptedText, encrypted.iv, tamperedTag)).toThrow(
      /Failed to decrypt token/,
    );
  });
});
