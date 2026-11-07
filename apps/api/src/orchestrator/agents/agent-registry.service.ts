import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { BaseAgent } from './base-agent.interface';
import { PlanningAgent } from './planning.agent';
import { ResearchAgent } from './research.agent';
import { CommunicationAgent } from './communication.agent';
import { TaskAgent } from './task.agent';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents: Map<AgentRole, BaseAgent> = new Map();

  constructor(
    planningAgent: PlanningAgent,
    researchAgent: ResearchAgent,
    communicationAgent: CommunicationAgent,
    taskAgent: TaskAgent,
  ) {
    this.registerAgent(planningAgent);
    this.registerAgent(researchAgent);
    this.registerAgent(communicationAgent);
    this.registerAgent(taskAgent);
    this.logger.log(`Initialized AgentRegistry with ${this.agents.size} logical agents.`);
  }

  private registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.role, agent);
  }

  /**
   * Retrieves a registered agent by role. Throws BadRequestException if role is unapproved.
   */
  getAgent(role: AgentRole): BaseAgent {
    const agent = this.agents.get(role);
    if (!agent) {
      throw new BadRequestException(
        `Agent role "${role}" is not registered. Dynamic or arbitrary agent creation is forbidden.`,
      );
    }
    return agent;
  }

  /**
   * Verifies whether a role is registered
   */
  hasAgent(role: string): boolean {
    return this.agents.has(role as AgentRole);
  }

  /**
   * Returns list of all registered agents with roles and descriptions
   */
  getRegisteredAgents(): { role: AgentRole; description: string }[] {
    return Array.from(this.agents.values()).map((a) => ({
      role: a.role,
      description: a.description,
    }));
  }
}
