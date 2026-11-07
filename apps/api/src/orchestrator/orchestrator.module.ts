import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@bhuvi/database';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { MessagesModule } from '../messages/messages.module';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { IntentAnalyzerService } from './intent/intent-analyzer.service';
import { PlannerService } from './planner/planner.service';
import { ExecutionEngineService } from './execution/execution-engine.service';
import { ApprovalService } from './approval/approval.service';
import { AgentRegistryService } from './agents/agent-registry.service';
import { PlanningAgent } from './agents/planning.agent';
import { ResearchAgent } from './agents/research.agent';
import { CommunicationAgent } from './agents/communication.agent';
import { TaskAgent } from './agents/task.agent';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, AiModule, MessagesModule],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorService,
    IntentAnalyzerService,
    PlannerService,
    ExecutionEngineService,
    ApprovalService,
    AgentRegistryService,
    PlanningAgent,
    ResearchAgent,
    CommunicationAgent,
    TaskAgent,
  ],
  exports: [OrchestratorService, ExecutionEngineService, ApprovalService, AgentRegistryService],
})
export class OrchestratorModule {}
