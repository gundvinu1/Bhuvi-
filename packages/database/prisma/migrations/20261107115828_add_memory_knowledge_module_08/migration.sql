-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "importance" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_chunks" (
    "id" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "embedding" DOUBLE PRECISION[],
    "dimensions" INTEGER NOT NULL DEFAULT 0,
    "model_name" TEXT NOT NULL DEFAULT 'nomic-embed-text',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_tag_assignments" (
    "id" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "memory_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "memory_id" TEXT,
    "action" TEXT NOT NULL,
    "query" TEXT,
    "similarity" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");

-- CreateIndex
CREATE INDEX "memories_category_idx" ON "memories"("category");

-- CreateIndex
CREATE INDEX "memories_importance_idx" ON "memories"("importance");

-- CreateIndex
CREATE INDEX "memories_status_idx" ON "memories"("status");

-- CreateIndex
CREATE INDEX "memories_created_at_idx" ON "memories"("created_at");

-- CreateIndex
CREATE INDEX "memory_chunks_user_id_idx" ON "memory_chunks"("user_id");

-- CreateIndex
CREATE INDEX "memory_chunks_memory_id_idx" ON "memory_chunks"("memory_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_chunks_memory_id_chunk_index_key" ON "memory_chunks"("memory_id", "chunk_index");

-- CreateIndex
CREATE INDEX "memory_tags_user_id_idx" ON "memory_tags"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_tags_user_id_name_key" ON "memory_tags"("user_id", "name");

-- CreateIndex
CREATE INDEX "memory_tag_assignments_memory_id_idx" ON "memory_tag_assignments"("memory_id");

-- CreateIndex
CREATE INDEX "memory_tag_assignments_tag_id_idx" ON "memory_tag_assignments"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_tag_assignments_memory_id_tag_id_key" ON "memory_tag_assignments"("memory_id", "tag_id");

-- CreateIndex
CREATE INDEX "memory_access_logs_user_id_idx" ON "memory_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "memory_access_logs_memory_id_idx" ON "memory_access_logs"("memory_id");

-- CreateIndex
CREATE INDEX "memory_access_logs_action_idx" ON "memory_access_logs"("action");

-- CreateIndex
CREATE INDEX "memory_access_logs_timestamp_idx" ON "memory_access_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tags" ADD CONSTRAINT "memory_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tag_assignments" ADD CONSTRAINT "memory_tag_assignments_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tag_assignments" ADD CONSTRAINT "memory_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "memory_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_access_logs" ADD CONSTRAINT "memory_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_access_logs" ADD CONSTRAINT "memory_access_logs_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
