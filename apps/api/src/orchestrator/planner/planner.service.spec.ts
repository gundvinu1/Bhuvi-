import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PlannerService, MAX_PLAN_STEPS } from './planner.service';
import { OllamaProvider } from '../../ai/ollama.provider';
import { IntentAnalysisResult } from '../intent/intent.types';

describe('PlannerService', () => {
  let service: PlannerService;

  const mockOllamaProvider = {
    chat: jest.fn(),
  };

  const mockIntent: IntentAnalysisResult = {
    intent: 'PLANNING',
    explanation: 'User wants meeting preparation',
    confidence: 0.95,
    selectedAgents: ['PLANNING', 'TASK'],
    clarificationNeeded: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlannerService,
        {
          provide: OllamaProvider,
          useValue: mockOllamaProvider,
        },
      ],
    }).compile();

    service = module.get<PlannerService>(PlannerService);
    jest.clearAllMocks();
  });

  it('generates a valid multi-step plan from model JSON', async () => {
    mockOllamaProvider.chat.mockResolvedValue({
      content: JSON.stringify({
        title: 'Meeting Preparation Plan',
        steps: [
          {
            stepKey: 'step-1',
            title: 'Identify Meeting Goals',
            description: 'Determine goals',
            assignedAgent: 'PLANNING',
            dependencies: [],
            requiresApproval: false,
          },
          {
            stepKey: 'step-2',
            title: 'Prepare Talking Points',
            description: 'List agenda items',
            assignedAgent: 'RESEARCH',
            dependencies: ['step-1'],
            requiresApproval: false,
          },
        ],
      }),
      model: 'qwen2.5:3b',
      durationMs: 250,
    });

    const plan = await service.generatePlan('Prepare for meeting', mockIntent);

    expect(plan.title).toBe('Meeting Preparation Plan');
    expect(plan.steps.length).toBe(2);
    expect(plan.steps[0]?.assignedAgent).toBe('PLANNING');
    expect(plan.steps[1]?.dependencies).toEqual(['step-1']);
  });

  it('enforces maximum plan steps limit and truncates excess steps', async () => {
    const rawSteps = [];
    for (let i = 1; i <= 15; i++) {
      rawSteps.push({
        stepKey: `step-${i}`,
        title: `Step Title ${i}`,
        description: `Description ${i}`,
        assignedAgent: 'PLANNING',
        dependencies: i > 1 ? [`step-${i - 1}`] : [],
      });
    }

    mockOllamaProvider.chat.mockResolvedValue({
      content: JSON.stringify({
        title: 'Huge Plan',
        steps: rawSteps,
      }),
      model: 'qwen2.5:3b',
      durationMs: 250,
    });

    const plan = await service.generatePlan('Huge task', mockIntent);

    expect(plan.steps.length).toBe(MAX_PLAN_STEPS);
    expect(plan.steps.length).toBeLessThanOrEqual(10);
  });

  it('detects and resolves circular dependencies into linear order', () => {
    const circularSteps = [
      {
        stepKey: 'step-1',
        stepIndex: 1,
        title: 'Step 1',
        description: 'Desc 1',
        assignedAgent: 'PLANNING' as const,
        dependencies: ['step-2'], // Circular
        requiresApproval: false,
      },
      {
        stepKey: 'step-2',
        stepIndex: 2,
        title: 'Step 2',
        description: 'Desc 2',
        assignedAgent: 'TASK' as const,
        dependencies: ['step-1'], // Circular
        requiresApproval: false,
      },
    ];

    service.validatePlanStructure(circularSteps);

    // After resolution, step-1 has no dependencies and step-2 depends on step-1
    expect(circularSteps[0]?.dependencies).toEqual([]);
    expect(circularSteps[1]?.dependencies).toEqual(['step-1']);
  });

  it('rejects self-dependent steps with BadRequestException', () => {
    const selfDepSteps = [
      {
        stepKey: 'step-1',
        stepIndex: 1,
        title: 'Step 1',
        description: 'Desc 1',
        assignedAgent: 'PLANNING' as const,
        dependencies: ['step-1'], // Self dependency
        requiresApproval: false,
      },
    ];

    expect(() => service.validatePlanStructure(selfDepSteps)).toThrow(BadRequestException);
  });

  it('produces deterministic fallback plan when Ollama fails', async () => {
    mockOllamaProvider.chat.mockRejectedValue(new Error('Connection timed out'));

    const plan = await service.generatePlan('Prepare client presentation', mockIntent);

    expect(plan.title).toContain('Execution Plan');
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.steps[0]?.assignedAgent).toBe('PLANNING');
  });
});
