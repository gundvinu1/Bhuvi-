import { BadRequestException } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { AgentRegistryService } from './agent-registry.service';
import { PlanningAgent } from './planning.agent';
import { ResearchAgent } from './research.agent';
import { CommunicationAgent } from './communication.agent';
import { TaskAgent } from './task.agent';

describe('AgentRegistryService', () => {
  let registry: AgentRegistryService;

  const mockPlanningAgent = {
    role: 'PLANNING',
    description: 'Planning agent',
  } as unknown as PlanningAgent;
  const mockResearchAgent = {
    role: 'RESEARCH',
    description: 'Research agent',
  } as unknown as ResearchAgent;
  const mockCommAgent = {
    role: 'COMMUNICATION',
    description: 'Communication agent',
  } as unknown as CommunicationAgent;
  const mockTaskAgent = { role: 'TASK', description: 'Task agent' } as unknown as TaskAgent;

  beforeEach(() => {
    registry = new AgentRegistryService(
      mockPlanningAgent,
      mockResearchAgent,
      mockCommAgent,
      mockTaskAgent,
    );
  });

  it('retrieves registered agents by authorized role', () => {
    expect(registry.getAgent('PLANNING')).toBe(mockPlanningAgent);
    expect(registry.getAgent('RESEARCH')).toBe(mockResearchAgent);
    expect(registry.getAgent('COMMUNICATION')).toBe(mockCommAgent);
    expect(registry.getAgent('TASK')).toBe(mockTaskAgent);
  });

  it('rejects dynamic or unauthorized agent creation with BadRequestException', () => {
    expect(() => registry.getAgent('SHELL_EXECUTION_AGENT' as unknown as AgentRole)).toThrow(
      BadRequestException,
    );
    expect(() => registry.getAgent('DYNAMIC_BOT' as unknown as AgentRole)).toThrow(
      BadRequestException,
    );
  });

  it('lists all registered agents and their capabilities', () => {
    const list = registry.getRegisteredAgents();
    expect(list.length).toBe(4);
    expect(list.map((a) => a.role)).toEqual(['PLANNING', 'RESEARCH', 'COMMUNICATION', 'TASK']);
  });
});
