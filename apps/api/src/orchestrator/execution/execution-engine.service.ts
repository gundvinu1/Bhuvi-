import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService, Prisma } from '@bhuvi/database';
import { AgentRole } from '@bhuvi/shared';
import { AgentRegistryService } from '../agents/agent-registry.service';
import { ApprovalService } from '../approval/approval.service';
import { StepPreviousOutput } from '../agents/base-agent.interface';
import { ExecutionSummary } from './execution.types';

@Injectable()
export class ExecutionEngineService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionEngineService.name);
  private activeExecutions = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly approvalService: ApprovalService,
  ) {}

  /**
   * Recovers from previous server crashes or restarts by resetting orphaned RUNNING plans.
   */
  async onModuleInit(): Promise<void> {
    try {
      const recovered = await this.prisma.agentPlan.updateMany({
        where: { status: 'RUNNING' },
        data: { status: 'FAILED' },
      });

      if (recovered.count > 0) {
        this.logger.warn(
          `Startup recovery: marked ${recovered.count} orphaned RUNNING plan(s) as FAILED`,
        );

        await this.prisma.agentPlanStep.updateMany({
          where: { status: 'RUNNING' },
          data: { status: 'FAILED', error: 'Execution interrupted by server restart' },
        });

        await this.prisma.agentExecution.updateMany({
          where: { status: 'RUNNING' },
          data: {
            status: 'FAILED',
            error: 'Execution interrupted by server restart',
            completedAt: new Date(),
          },
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        'Startup recovery check failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Starts or resumes controlled execution of an agent plan.
   * Enforces ownership, duplicate execution prevention, and dependency resolution.
   */
  async executePlan(planId: string, userId: string): Promise<ExecutionSummary> {
    // Atomic status transition in PostgreSQL prevents simultaneous execution across multiple API instances
    const atomicClaim = await this.prisma.agentPlan.updateMany({
      where: {
        id: planId,
        userId,
        status: { in: ['PENDING', 'WAITING_FOR_APPROVAL', 'FAILED', 'READY'] },
      },
      data: {
        status: 'RUNNING',
      },
    });

    if (atomicClaim.count === 0) {
      const existing = await this.prisma.agentPlan.findUnique({ where: { id: planId } });
      if (!existing) {
        throw new NotFoundException(`Plan with ID "${planId}" not found`);
      }
      if (existing.userId !== userId) {
        throw new ForbiddenException('You do not have permission to execute this plan');
      }
      if (existing.status === 'RUNNING' || this.activeExecutions.has(planId)) {
        throw new BadRequestException('Plan is already actively running');
      }
      if (existing.status === 'COMPLETED') {
        throw new BadRequestException('Plan is already completed');
      }
      if (existing.status === 'CANCELLED') {
        throw new BadRequestException('Cannot execute a cancelled plan');
      }
      throw new BadRequestException(`Cannot execute plan in status "${existing.status}"`);
    }

    this.activeExecutions.add(planId);

    // Create execution run record
    const execution = await this.prisma.agentExecution.create({
      data: {
        planId,
        status: 'RUNNING',
        triggerSource: 'MANUAL',
      },
    });

    this.logger.log(`Starting execution run [${execution.id}] for plan [${planId}]`);

    try {
      const summary = await this.processPlanSteps(planId, execution.id, userId);

      await this.prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: summary.status,
          completedAt: new Date(),
          error: summary.error,
        },
      });

      return summary;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Plan execution failed for [${planId}]: ${errorMsg}`);

      await this.prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: errorMsg,
        },
      });

      await this.prisma.agentPlan.update({
        where: { id: planId },
        data: { status: 'FAILED' },
      });

      throw err;
    } finally {
      this.activeExecutions.delete(planId);
    }
  }

  /**
   * Processes plan steps sequentially respecting dependencies and human approval checkpoints.
   */
  private async processPlanSteps(
    planId: string,
    executionId: string,
    userId: string,
  ): Promise<ExecutionSummary> {
    const plan = await this.prisma.agentPlan.findUnique({
      where: { id: planId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        approvals: true,
      },
    });

    if (!plan) throw new NotFoundException('Plan not found during step processing');

    const completedStepKeys = new Set(
      plan.steps.filter((s) => s.status === 'COMPLETED').map((s) => s.stepKey),
    );

    const previousOutputs: StepPreviousOutput[] = plan.steps
      .filter((s) => s.status === 'COMPLETED' && s.output)
      .map((s) => {
        const out = s.output as Record<string, unknown>;
        return {
          stepKey: s.stepKey,
          title: s.title,
          agent: s.assignedAgent as AgentRole,
          summary: typeof out['summary'] === 'string' ? out['summary'] : s.title,
          details: out,
        };
      });

    let completedCount = completedStepKeys.size;
    const totalSteps = plan.steps.length;

    for (const step of plan.steps) {
      // Check if plan was cancelled in between steps
      const currentPlanState = await this.prisma.agentPlan.findUnique({
        where: { id: planId },
        select: { status: true },
      });
      if (currentPlanState?.status === 'CANCELLED') {
        return {
          planId,
          executionId,
          status: 'CANCELLED',
          completedSteps: completedCount,
          totalSteps,
        };
      }

      if (step.status === 'COMPLETED') {
        continue;
      }

      // 1. Dependency validation: verify all required dependency steps are COMPLETED
      const missingDependencies = step.dependencies.filter((dep) => !completedStepKeys.has(dep));
      if (missingDependencies.length > 0) {
        this.logger.log(
          `Step [${step.stepKey}] waiting for dependencies: ${missingDependencies.join(', ')}`,
        );
        break;
      }

      // 2. Human approval boundary check
      if (step.requiresApproval) {
        const existingApproval = plan.approvals.find((a) => a.stepId === step.id);

        if (!existingApproval || existingApproval.status === 'PENDING') {
          // Pause execution and wait for human action
          if (!existingApproval) {
            await this.approvalService.createApprovalRequest({
              planId,
              stepId: step.id,
              userId,
              actionType: 'PROPOSAL_STEP_EXECUTION',
              description: `Action proposal for step "${step.title}". Requires explicit human approval.`,
              proposalData: {
                stepKey: step.stepKey,
                stepTitle: step.title,
                assignedAgent: step.assignedAgent,
                description: step.description,
              },
            });
          }

          await this.prisma.agentPlanStep.update({
            where: { id: step.id },
            data: { status: 'WAITING_FOR_APPROVAL' },
          });

          await this.prisma.agentPlan.update({
            where: { id: planId },
            data: { status: 'WAITING_FOR_APPROVAL' },
          });

          return {
            planId,
            executionId,
            status: 'WAITING_FOR_APPROVAL',
            completedSteps: completedCount,
            totalSteps,
          };
        }

        if (existingApproval.status === 'REJECTED') {
          await this.prisma.agentPlanStep.update({
            where: { id: step.id },
            data: { status: 'CANCELLED' },
          });
          await this.prisma.agentPlan.update({
            where: { id: planId },
            data: { status: 'CANCELLED' },
          });
          return {
            planId,
            executionId,
            status: 'CANCELLED',
            completedSteps: completedCount,
            totalSteps,
          };
        }
      }

      // 3. Execute Step with Registered Agent
      await this.prisma.agentPlanStep.update({
        where: { id: step.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const agent = this.agentRegistry.getAgent(step.assignedAgent as AgentRole);

      const result = await agent.execute({
        planId,
        stepKey: step.stepKey,
        stepTitle: step.title,
        stepDescription: step.description,
        userPrompt: plan.prompt,
        previousOutputs,
      });

      if (!result.success) {
        await this.prisma.agentPlanStep.update({
          where: { id: step.id },
          data: {
            status: 'FAILED',
            error: result.error || 'Agent execution failed',
            completedAt: new Date(),
          },
        });

        await this.prisma.agentPlan.update({
          where: { id: planId },
          data: { status: 'FAILED' },
        });

        return {
          planId,
          executionId,
          status: 'FAILED',
          completedSteps: completedCount,
          totalSteps,
          error: result.error || 'Step execution failed',
        };
      }

      // If the agent produced a proposal requiring subsequent approval
      if (result.requiresApproval && result.proposal) {
        await this.approvalService.createApprovalRequest({
          planId,
          stepId: step.id,
          userId,
          actionType: result.proposal.actionType,
          description: result.proposal.description,
          proposalData: result.proposal.data,
        });
      }

      const stepOutputData = {
        summary: result.summary,
        details: result.details,
        durationMs: result.durationMs,
      };

      await this.prisma.agentPlanStep.update({
        where: { id: step.id },
        data: {
          status: 'COMPLETED',
          output: stepOutputData as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      completedStepKeys.add(step.stepKey);
      completedCount++;
      previousOutputs.push({
        stepKey: step.stepKey,
        title: step.title,
        agent: step.assignedAgent as AgentRole,
        summary: result.summary,
        details: result.details,
      });
    }

    // Verify plan was not cancelled while steps were running
    const currentPlan = await this.prisma.agentPlan.findUnique({
      where: { id: planId },
      select: { status: true },
    });
    if (currentPlan?.status === 'CANCELLED') {
      return {
        planId,
        executionId,
        status: 'CANCELLED',
        completedSteps: completedCount,
        totalSteps,
      };
    }

    const allDone = completedCount === totalSteps;
    const finalPlanStatus = allDone ? 'COMPLETED' : 'RUNNING';

    await this.prisma.agentPlan.update({
      where: { id: planId },
      data: { status: finalPlanStatus },
    });

    return {
      planId,
      executionId,
      status: finalPlanStatus,
      completedSteps: completedCount,
      totalSteps,
    };
  }

  /**
   * Cancels an eligible plan and any pending steps.
   */
  async cancelPlan(planId: string, userId: string): Promise<void> {
    const plan = await this.prisma.agentPlan.findUnique({
      where: { id: planId },
      include: { steps: true, approvals: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID "${planId}" not found`);
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException('You do not have permission to cancel this plan');
    }

    if (plan.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel an already completed plan');
    }

    await this.prisma.agentPlan.update({
      where: { id: planId },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.agentPlanStep.updateMany({
      where: {
        planId,
        status: { in: ['PENDING', 'READY', 'RUNNING', 'WAITING_FOR_APPROVAL'] },
      },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.approvalRequest.updateMany({
      where: {
        planId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    this.activeExecutions.delete(planId);
    this.logger.log(`Plan [${planId}] cancelled by user [${userId}]`);
  }
}
