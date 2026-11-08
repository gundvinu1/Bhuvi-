import { Injectable, Logger } from '@nestjs/common';

export interface SecretDetectionResult {
  hasSecret: boolean;
  reason?: string;
  matchedType?: string;
}

@Injectable()
export class SecretDetectorService {
  private readonly logger = new Logger(SecretDetectorService.name);

  // Regex patterns targeting obvious credentials, keys, and tokens
  private readonly secretPatterns: Array<{ type: string; regex: RegExp; description: string }> = [
    {
      type: 'PRIVATE_KEY',
      regex: /-----BEGIN\s+(?:[A-Z0-9_-]+\s+)*(?:PRIVATE\s+KEY|KEY\s+BLOCK)[^-]*-----/i,
      description: 'Cryptographic private key',
    },
    {
      type: 'OPENAI_API_KEY',
      regex: /\bsk-[a-zA-Z0-9_-]{20,}\b/,
      description: 'OpenAI API key',
    },
    {
      type: 'GITHUB_PAT',
      regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/,
      description: 'GitHub Personal Access Token',
    },
    {
      type: 'GITHUB_FINE_GRAINED_PAT',
      regex: /\bgithub_pat_[a-zA-Z0-9_]{50,}\b/,
      description: 'GitHub Fine-grained token',
    },
    {
      type: 'AWS_ACCESS_KEY',
      regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/,
      description: 'AWS Access Key ID',
    },
    {
      type: 'SLACK_TOKEN',
      regex: /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/,
      description: 'Slack access token',
    },
    {
      type: 'JWT_TOKEN',
      regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
      description: 'JSON Web Token (JWT)',
    },
    {
      type: 'GENERIC_SECRET_ASSIGNMENT',
      regex:
        /(?:password|passwd|pwd|secret_key|api_key|apikey|access_token|auth_token|client_secret)\s*[:=]\s*["']?([^\s"';,]{8,})["']?/i,
      description: 'Explicit password or secret assignment',
    },
  ];

  /**
   * Scans text for high-entropy tokens, passwords, private keys, or API credentials.
   */
  detectSecret(text: string): SecretDetectionResult {
    if (!text || typeof text !== 'string') {
      return { hasSecret: false };
    }

    for (const pattern of this.secretPatterns) {
      if (pattern.regex.test(text)) {
        this.logger.warn(`Rejected sensitive secret of type ${pattern.type} in memory content`);
        return {
          hasSecret: true,
          reason: `Detected potential ${pattern.description}. BHUVI is not a password manager or secret vault; plaintext credential storage is strictly prohibited.`,
          matchedType: pattern.type,
        };
      }
    }

    return { hasSecret: false };
  }

  /**
   * Redacts any detected credentials from output or logs, replacing them with [REDACTED_SECRET].
   */
  redactSecrets(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let sanitized = text;
    for (const pattern of this.secretPatterns) {
      if (pattern.type === 'GENERIC_SECRET_ASSIGNMENT') {
        sanitized = sanitized.replace(
          /((?:password|passwd|pwd|secret_key|api_key|apikey|access_token|auth_token|client_secret)\s*[:=]\s*["']?)[^\s"';,]{8,}(["']?)/gi,
          '$1[REDACTED_SECRET]$2',
        );
      } else {
        const globalRegex = new RegExp(pattern.regex.source, 'gi');
        sanitized = sanitized.replace(globalRegex, '[REDACTED_SECRET]');
      }
    }

    return sanitized;
  }
}
