import { SecretDetectorService } from './secret-detector.service';

describe('SecretDetectorService', () => {
  let service: SecretDetectorService;

  beforeEach(() => {
    service = new SecretDetectorService();
  });

  it('should return hasSecret: false for normal notes and text', () => {
    const normalText =
      'Discussed Project Phoenix roadmap today with the team. Target launch is Q3 2026.';
    const res = service.detectSecret(normalText);
    expect(res.hasSecret).toBe(false);
  });

  it('should detect private keys', () => {
    const text =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----';
    const res = service.detectSecret(text);
    expect(res.hasSecret).toBe(true);
    expect(res.matchedType).toBe('PRIVATE_KEY');
  });

  it('should detect OpenAI API keys', () => {
    const text = 'Here is my key: sk-abcdef12345678901234567890abcdef for testing';
    const res = service.detectSecret(text);
    expect(res.hasSecret).toBe(true);
    expect(res.matchedType).toBe('OPENAI_API_KEY');
  });

  it('should detect GitHub Personal Access Tokens', () => {
    const text = 'GitHub token is ghp_1234567890abcdefghijklmnopqrstuvwxyz';
    const res = service.detectSecret(text);
    expect(res.hasSecret).toBe(true);
    expect(res.matchedType).toBe('GITHUB_PAT');
  });

  it('should detect AWS Access Keys', () => {
    const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const res = service.detectSecret(text);
    expect(res.hasSecret).toBe(true);
    expect(res.matchedType).toBe('AWS_ACCESS_KEY');
  });

  it('should detect explicit password assignments', () => {
    const text = 'My router password = SuperSecretP@ssw0rd99';
    const res = service.detectSecret(text);
    expect(res.hasSecret).toBe(true);
    expect(res.matchedType).toBe('GENERIC_SECRET_ASSIGNMENT');
  });

  it('should redact detected secrets with [REDACTED_SECRET]', () => {
    const text = 'Use sk-abcdef12345678901234567890abcdef to authenticate.';
    const redacted = service.redactSecrets(text);
    expect(redacted).toBe('Use [REDACTED_SECRET] to authenticate.');
  });
});
