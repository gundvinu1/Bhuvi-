import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiResponse,
  AgentPlanDto,
  ExecutePlanResponse,
  ApprovalRequestDto,
  SafeUser,
  APP_VERSION,
} from '@bhuvi/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrchestratorService } from './orchestrator.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ApprovalDecisionDto } from './dto/approval-decision.dto';
import { PlansQueryDto } from './dto/plans-query.dto';

@Controller('orchestrator')
@UseGuards(JwtAuthGuard)
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  private formatResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
        ...meta,
      },
    };
  }

  /**
   * POST /api/v1/orchestrator/plans
   * Analyzes user request, categorizes intent, generates structured execution plan,
   * and persists it to the database.
   */
  @Post('plans')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<AgentPlanDto>> {
    const plan = await this.orchestratorService.createPlan(user.id, dto.message);
    return this.formatResponse(plan);
  }

  /**
   * GET /api/v1/orchestrator/plans
   * Retrieves all plans owned by the authenticated user with pagination.
   */
  @Get('plans')
  @HttpCode(HttpStatus.OK)
  async listPlans(
    @Query() query: PlansQueryDto,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<AgentPlanDto[]>> {
    const { plans, total, page, limit } = await this.orchestratorService.listPlans(
      user.id,
      query.page,
      query.limit,
    );

    return this.formatResponse(plans, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * GET /api/v1/orchestrator/plans/:id
   * Retrieves a specific plan with its steps and execution details. Enforces ownership.
   */
  @Get('plans/:id')
  @HttpCode(HttpStatus.OK)
  async getPlan(
    @Param('id') planId: string,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<AgentPlanDto>> {
    const plan = await this.orchestratorService.getPlan(planId, user.id);
    return this.formatResponse(plan);
  }

  /**
   * POST /api/v1/orchestrator/plans/:id/execute
   * Initiates controlled step-by-step execution of an agent plan.
   */
  @Post('plans/:id/execute')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async executePlan(
    @Param('id') planId: string,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<ExecutePlanResponse>> {
    const result = await this.orchestratorService.executePlan(planId, user.id);
    return this.formatResponse(result);
  }

  /**
   * POST /api/v1/orchestrator/plans/:id/cancel
   * Cancels a currently running or pending plan.
   */
  @Post('plans/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPlan(
    @Param('id') planId: string,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.orchestratorService.cancelPlan(planId, user.id);
    return this.formatResponse(result);
  }

  /**
   * GET /api/v1/orchestrator/approvals
   * Lists all pending proposal approvals for the authenticated user.
   */
  @Get('approvals')
  @HttpCode(HttpStatus.OK)
  async getPendingApprovals(
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<ApprovalRequestDto[]>> {
    const approvals = await this.orchestratorService.getPendingApprovals(user.id);
    return this.formatResponse(approvals);
  }

  /**
   * POST /api/v1/orchestrator/approvals/:id/approve
   * Approves a pending proposal.
   */
  @Post('approvals/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveProposal(
    @Param('id') approvalId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<ApprovalRequestDto>> {
    const result = await this.orchestratorService.approveProposal(approvalId, user.id, dto.reason);
    return this.formatResponse(result);
  }

  /**
   * POST /api/v1/orchestrator/approvals/:id/reject
   * Rejects a pending proposal.
   */
  @Post('approvals/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectProposal(
    @Param('id') approvalId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<ApprovalRequestDto>> {
    const result = await this.orchestratorService.rejectProposal(approvalId, user.id, dto.reason);
    return this.formatResponse(result);
  }
}
