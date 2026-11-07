import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService, AgentPlan, AgentPlanStep, ApprovalRequest } from '@bhuvi/database';
import {
  AgentPlanDto,
  AgentPlanStepDto,
  ExecutePlanResponse,
  ApprovalRequestDto,
} from '@bhuvi/shared';
import { IntentAnalyzerService } from './intent/intent-analyzer.service';
import { PlannerService } from './planner/planner.service';
import { ExecutionEngineService } from './execution/execution-engine.service';
import { ApprovalService } from './approval/approval.service';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentAnalyzer: IntentAnalyzerService,
    private readonly planner: PlannerService,
    private readonly executionEngine: ExecutionEngineService,
    private readonly approvalService: ApprovalService,
  ) {}

  /**
   * Analyzes intent, generates a structured plan, and persists it to PostgreSQL.
   */
  async createPlan(userId: string, message: string): Promise<AgentPlanDto> {
    const cleanMessage = message.trim();
    this.logger.log(`Creating plan for user [${userId}]: "${cleanMessage.slice(0, 50)}..."`);

    // 1. Analyze user intent
    const intentResult = await this.intentAnalyzer.analyze(cleanMessage);

    // 2. Generate structured execution plan
    const generatedPlan = await this.planner.generatePlan(cleanMessage, intentResult);

    // 3. Persist plan and steps in database transaction
    const plan = await this.prisma.agentPlan.create({
      data: {
        userId,
        title: generatedPlan.title,
        prompt: cleanMessage,
        intentCategory: generatedPlan.intentCategory,
        status: 'PENDING',
        clarificationNeeded: intentResult.clarificationNeeded,
        explanation: intentResult.explanation,
        steps: {
          create: generatedPlan.steps.map((s) => ({
            stepIndex: s.stepIndex,
            stepKey: s.stepKey,
            title: s.title,
            description: s.description,
            assignedAgent: s.assignedAgent,
            dependencies: s.dependencies,
            status: 'PENDING',
            requiresApproval: s.requiresApproval,
          })),
        },
      },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        approvals: true,
      },
    });

    this.logger.log(
      `Created plan [${plan.id}] with ${plan.steps.length} steps for user [${userId}]`,
    );
    return this.mapToPlanDto(plan);
  }

  /**
   * Lists plans owned by the authenticated user with pagination.
   */
  async listPlans(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ plans: AgentPlanDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const [plans, total] = await Promise.all([
      this.prisma.agentPlan.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          steps: { orderBy: { stepIndex: 'asc' } },
          approvals: { where: { status: 'PENDING' } },
        },
      }),
      this.prisma.agentPlan.count({ where: { userId } }),
    ]);

    return {
      plans: plans.map((p) => this.mapToPlanDto(p)),
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves a single plan by ID. Verifies ownership.
   */
  async getPlan(planId: string, userId: string): Promise<AgentPlanDto> {
    const plan = await this.prisma.agentPlan.findUnique({
      where: { id: planId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        approvals: true,
        executions: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID "${planId}" not found`);
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this plan');
    }

    return this.mapToPlanDto(plan);
  }

  /**
   * Triggers controlled execution of a plan.
   */
  async executePlan(planId: string, userId: string): Promise<ExecutePlanResponse> {
    const summary = await this.executionEngine.executePlan(planId, userId);

    return {
      planId: summary.planId,
      status: summary.status,
      executionId: summary.executionId,
      message: `Plan execution status: ${summary.status} (${summary.completedSteps}/${summary.totalSteps} steps completed)`,
    };
  }

  /**
   * Cancels an eligible plan.
   */
  async cancelPlan(planId: string, userId: string): Promise<{ success: boolean; message: string }> {
    await this.executionEngine.cancelPlan(planId, userId);
    return {
      success: true,
      message: `Plan "${planId}" has been cancelled successfully`,
    };
  }

  /**
   * Approves a proposal.
   */
  async approveProposal(
    approvalId: string,
    userId: string,
    reason?: string,
  ): Promise<ApprovalRequestDto> {
    return this.approvalService.approve(approvalId, userId, reason);
  }

  /**
   * Rejects a proposal.
   */
  async rejectProposal(
    approvalId: string,
    userId: string,
    reason?: string,
  ): Promise<ApprovalRequestDto> {
    return this.approvalService.reject(approvalId, userId, reason);
  }

  /**
   * Retrieves all pending approval proposals for the authenticated user.
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequestDto[]> {
    return this.approvalService.getPendingApprovals(userId);
  }

  private mapToPlanDto(
    plan: AgentPlan & { steps?: AgentPlanStep[]; approvals?: ApprovalRequest[] },
  ): AgentPlanDto {
    const steps: AgentPlanStepDto[] = (plan.steps || []).map((s: AgentPlanStep) => ({
      id: s.id,
      stepKey: s.stepKey,
      stepIndex: s.stepIndex,
      title: s.title,
      description: s.description,
      assignedAgent: s.assignedAgent as AgentPlanStepDto['assignedAgent'],
      dependencies: s.dependencies || [],
      status: s.status as AgentPlanStepDto['status'],
      requiresApproval: s.requiresApproval,
      output: (s.output as Record<string, unknown>) || null,
      error: s.error || null,
      startedAt: s.startedAt ? s.startedAt.toISOString() : null,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    }));

    const pendingApprovalsCount = Array.isArray(plan.approvals)
      ? plan.approvals.filter((a: ApprovalRequest) => a.status === 'PENDING').length
      : 0;

    return {
      id: plan.id,
      userId: plan.userId,
      title: plan.title,
      prompt: plan.prompt,
      intentCategory: plan.intentCategory as AgentPlanDto['intentCategory'],
      status: plan.status as AgentPlanDto['status'],
      clarificationNeeded: plan.clarificationNeeded,
      explanation: plan.explanation,
      steps,
      pendingApprovalsCount,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
