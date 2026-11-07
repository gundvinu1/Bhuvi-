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

  it('rejects circular dependencies with BadRequestException (does not silently linearize)', () => {
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

    expect(() => service.validatePlanStructure(circularSteps)).toThrow(BadRequestException);
    expect(() => service.validatePlanStructure(circularSteps)).toThrow(
      /Circular dependency detected in plan steps/i,
    );
  });

  it('rejects missing dependency references with BadRequestException', () => {
    const missingDepSteps = [
      {
        stepKey: 'step-1',
        stepIndex: 1,
        title: 'Step 1',
        description: 'Desc 1',
        assignedAgent: 'PLANNING' as const,
        dependencies: [],
        requiresApproval: false,
      },
      {
        stepKey: 'step-2',
        stepIndex: 2,
        title: 'Step 2',
        description: 'Desc 2',
        assignedAgent: 'RESEARCH' as const,
        dependencies: ['non-existent-step'], // Missing dependency
        requiresApproval: false,
      },
    ];

    expect(() => service.validatePlanStructure(missingDepSteps)).toThrow(BadRequestException);
    expect(() => service.validatePlanStructure(missingDepSteps)).toThrow(
      /references non-existent dependency/i,
    );
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
    expect(() => service.validatePlanStructure(selfDepSteps)).toThrow(/self-dependency/i);
  });

  it('accepts valid acyclic dependency graphs (DAG) in correct execution order', () => {
    const validDagSteps = [
      {
        stepKey: 'step-1',
        stepIndex: 1,
        title: 'Step 1',
        description: 'Desc 1',
        assignedAgent: 'PLANNING' as const,
        dependencies: [],
        requiresApproval: false,
      },
      {
        stepKey: 'step-2',
        stepIndex: 2,
        title: 'Step 2',
        description: 'Desc 2',
        assignedAgent: 'RESEARCH' as const,
        dependencies: ['step-1'],
        requiresApproval: false,
      },
      {
        stepKey: 'step-3',
        stepIndex: 3,
        title: 'Step 3',
        description: 'Desc 3',
        assignedAgent: 'TASK' as const,
        dependencies: ['step-1', 'step-2'],
        requiresApproval: false,
      },
    ];

    expect(() => service.validatePlanStructure(validDagSteps)).not.toThrow();
  });

  it('produces deterministic fallback plan when Ollama fails', async () => {
    mockOllamaProvider.chat.mockRejectedValue(new Error('Connection timed out'));

    const plan = await service.generatePlan('Prepare client presentation', mockIntent);

    expect(plan.title).toContain('Execution Plan');
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.steps[0]?.assignedAgent).toBe('PLANNING');
  });
});
