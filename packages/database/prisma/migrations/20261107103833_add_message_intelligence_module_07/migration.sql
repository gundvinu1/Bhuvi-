-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sender_name" TEXT NOT NULL,
    "sender_identifier" TEXT,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "processing_status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_analyses" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "priority_explanation" TEXT,
    "urgency" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "requires_reply" BOOLEAN NOT NULL DEFAULT false,
    "requires_action" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "extracted_entities" JSONB NOT NULL DEFAULT '[]',
    "analysis_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_action_items" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_labels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_label_assignments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "message_label_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");

-- CreateIndex
CREATE INDEX "messages_processing_status_idx" ON "messages"("processing_status");

-- CreateIndex
CREATE INDEX "messages_received_at_idx" ON "messages"("received_at");

-- CreateIndex
CREATE INDEX "messages_user_id_content_hash_idx" ON "messages"("user_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "message_analyses_message_id_key" ON "message_analyses"("message_id");

-- CreateIndex
CREATE INDEX "message_analyses_category_idx" ON "message_analyses"("category");

-- CreateIndex
CREATE INDEX "message_analyses_priority_idx" ON "message_analyses"("priority");

-- CreateIndex
CREATE INDEX "message_analyses_urgency_idx" ON "message_analyses"("urgency");

-- CreateIndex
CREATE INDEX "message_analyses_requires_action_idx" ON "message_analyses"("requires_action");

-- CreateIndex
CREATE INDEX "message_analyses_requires_reply_idx" ON "message_analyses"("requires_reply");

-- CreateIndex
CREATE INDEX "message_action_items_user_id_idx" ON "message_action_items"("user_id");

-- CreateIndex
CREATE INDEX "message_action_items_message_id_idx" ON "message_action_items"("message_id");

-- CreateIndex
CREATE INDEX "message_action_items_status_idx" ON "message_action_items"("status");

-- CreateIndex
CREATE INDEX "message_action_items_due_date_idx" ON "message_action_items"("due_date");

-- CreateIndex
CREATE INDEX "message_labels_user_id_idx" ON "message_labels"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_labels_user_id_name_key" ON "message_labels"("user_id", "name");

-- CreateIndex
CREATE INDEX "message_label_assignments_message_id_idx" ON "message_label_assignments"("message_id");

-- CreateIndex
CREATE INDEX "message_label_assignments_label_id_idx" ON "message_label_assignments"("label_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_label_assignments_message_id_label_id_key" ON "message_label_assignments"("message_id", "label_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_analyses" ADD CONSTRAINT "message_analyses_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_action_items" ADD CONSTRAINT "message_action_items_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_action_items" ADD CONSTRAINT "message_action_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_labels" ADD CONSTRAINT "message_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_label_assignments" ADD CONSTRAINT "message_label_assignments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_label_assignments" ADD CONSTRAINT "message_label_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "message_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
