-- CreateTable
CREATE TABLE "agent_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "intent_category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clarification_needed" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_plan_steps" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigned_agent" TEXT NOT NULL,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_plan_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_executions" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "trigger_source" TEXT NOT NULL DEFAULT 'MANUAL',
    "logs" JSONB,

    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "step_id" TEXT,
    "user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposal_data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision_reason" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_plans_user_id_idx" ON "agent_plans"("user_id");

-- CreateIndex
CREATE INDEX "agent_plans_status_idx" ON "agent_plans"("status");

-- CreateIndex
CREATE INDEX "agent_plans_created_at_idx" ON "agent_plans"("created_at");

-- CreateIndex
CREATE INDEX "agent_plan_steps_plan_id_idx" ON "agent_plan_steps"("plan_id");

-- CreateIndex
CREATE INDEX "agent_plan_steps_status_idx" ON "agent_plan_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_plan_steps_plan_id_step_key_key" ON "agent_plan_steps"("plan_id", "step_key");

-- CreateIndex
CREATE INDEX "agent_executions_plan_id_idx" ON "agent_executions"("plan_id");

-- CreateIndex
CREATE INDEX "agent_executions_status_idx" ON "agent_executions"("status");

-- CreateIndex
CREATE INDEX "approval_requests_user_id_idx" ON "approval_requests"("user_id");

-- CreateIndex
CREATE INDEX "approval_requests_plan_id_idx" ON "approval_requests"("plan_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- AddForeignKey
ALTER TABLE "agent_plans" ADD CONSTRAINT "agent_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_plan_steps" ADD CONSTRAINT "agent_plan_steps_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "agent_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "agent_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "agent_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "agent_plan_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
