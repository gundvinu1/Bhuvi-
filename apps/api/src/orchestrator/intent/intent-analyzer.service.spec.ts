import { Test, TestingModule } from '@nestjs/testing';
import { IntentAnalyzerService } from './intent-analyzer.service';
import { OllamaProvider } from '../../ai/ollama.provider';

describe('IntentAnalyzerService', () => {
  let service: IntentAnalyzerService;

  const mockOllamaProvider = {
    chat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentAnalyzerService,
        {
          provide: OllamaProvider,
          useValue: mockOllamaProvider,
        },
      ],
    }).compile();

    service = module.get<IntentAnalyzerService>(IntentAnalyzerService);
    jest.clearAllMocks();
  });

  it('classifies valid model JSON output into structured IntentAnalysisResult', async () => {
    mockOllamaProvider.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'PLANNING',
        explanation: 'User wants to organize an upcoming event',
        confidence: 0.95,
        selectedAgents: ['PLANNING', 'TASK'],
        clarificationNeeded: false,
      }),
      model: 'qwen2.5:3b',
      durationMs: 200,
    });

    const result = await service.analyze('Plan my team offsite next month');

    expect(result.intent).toBe('PLANNING');
    expect(result.explanation).toBe('User wants to organize an upcoming event');
    expect(result.confidence).toBe(0.95);
    expect(result.selectedAgents).toEqual(['PLANNING', 'TASK']);
    expect(result.clarificationNeeded).toBe(false);
  });

  it('handles markdown code block JSON returned by model', async () => {
    mockOllamaProvider.chat.mockResolvedValue({
      content:
        '```json\n{\n  "intent": "COMMUNICATION",\n  "explanation": "Drafting message",\n  "confidence": 0.88,\n  "selectedAgents": ["COMMUNICATION"]\n}\n```',
      model: 'qwen2.5:3b',
      durationMs: 150,
    });

    const result = await service.analyze('Draft an apology email for being late');

    expect(result.intent).toBe('COMMUNICATION');
    expect(result.selectedAgents).toContain('COMMUNICATION');
  });

  it('safely handles invalid JSON from model and uses keyword fallback', async () => {
    mockOllamaProvider.chat.mockResolvedValue({
      content: 'This is not valid JSON at all, sorry!',
      model: 'qwen2.5:3b',
      durationMs: 150,
    });

    const result = await service.analyze('Draft an email to John about tomorrow meeting');

    expect(result.intent).toBe('COMMUNICATION');
    expect(result.selectedAgents).toContain('COMMUNICATION');
  });

  it('handles empty input cleanly without calling Ollama', async () => {
    const result = await service.analyze('   ');

    expect(result.intent).toBe('UNKNOWN');
    expect(result.clarificationNeeded).toBe(true);
    expect(mockOllamaProvider.chat).not.toHaveBeenCalled();
  });

  it('clamps confidence to [0, 1] range and filters unrecognized agent roles', async () => {
    mockOllamaProvider.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'RESEARCH',
        explanation: 'Analyzing facts',
        confidence: 1.5, // Out of bounds
        selectedAgents: ['RESEARCH', 'HACKER_AGENT_INVALID'],
      }),
      model: 'qwen2.5:3b',
      durationMs: 150,
    });

    const result = await service.analyze('Analyze quantum computing advancements');

    expect(result.confidence).toBe(1.0);
    expect(result.selectedAgents).toEqual(['RESEARCH']);
  });
});
