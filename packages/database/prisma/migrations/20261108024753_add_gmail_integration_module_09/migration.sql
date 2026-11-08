-- CreateTable
CREATE TABLE "gmail_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "google_account_email" TEXT NOT NULL,
    "google_account_id" TEXT,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connection_status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "last_synced_at" TIMESTAMP(3),
    "last_history_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gmail_connection_id" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "provider_thread_id" TEXT NOT NULL,
    "sender_name" TEXT,
    "sender_email" TEXT NOT NULL,
    "recipient_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT,
    "body_text" TEXT NOT NULL,
    "body_html" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sync_status" TEXT NOT NULL DEFAULT 'SYNCHRONIZED',
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_attachments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "provider_attachment_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "download_status" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gmail_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_sync_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gmail_connection_id" TEXT NOT NULL,
    "last_history_id" TEXT,
    "last_successful_sync_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_status" TEXT NOT NULL DEFAULT 'IDLE',
    "error_message" TEXT,
    "synced_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gmail_connections_user_id_idx" ON "gmail_connections"("user_id");

-- CreateIndex
CREATE INDEX "gmail_connections_connection_status_idx" ON "gmail_connections"("connection_status");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_connections_user_id_google_account_email_key" ON "gmail_connections"("user_id", "google_account_email");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_messages_message_id_key" ON "gmail_messages"("message_id");

-- CreateIndex
CREATE INDEX "gmail_messages_user_id_idx" ON "gmail_messages"("user_id");

-- CreateIndex
CREATE INDEX "gmail_messages_provider_message_id_idx" ON "gmail_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "gmail_messages_provider_thread_id_idx" ON "gmail_messages"("provider_thread_id");

-- CreateIndex
CREATE INDEX "gmail_messages_sender_email_idx" ON "gmail_messages"("sender_email");

-- CreateIndex
CREATE INDEX "gmail_messages_received_at_idx" ON "gmail_messages"("received_at");

-- CreateIndex
CREATE INDEX "gmail_messages_is_read_idx" ON "gmail_messages"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_messages_gmail_connection_id_provider_message_id_key" ON "gmail_messages"("gmail_connection_id", "provider_message_id");

-- CreateIndex
CREATE INDEX "gmail_attachments_user_id_idx" ON "gmail_attachments"("user_id");

-- CreateIndex
CREATE INDEX "gmail_attachments_gmail_message_id_idx" ON "gmail_attachments"("gmail_message_id");

-- CreateIndex
CREATE INDEX "gmail_sync_states_user_id_idx" ON "gmail_sync_states"("user_id");

-- CreateIndex
CREATE INDEX "gmail_sync_states_gmail_connection_id_idx" ON "gmail_sync_states"("gmail_connection_id");

-- CreateIndex
CREATE INDEX "gmail_sync_states_sync_status_idx" ON "gmail_sync_states"("sync_status");

-- AddForeignKey
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_gmail_connection_id_fkey" FOREIGN KEY ("gmail_connection_id") REFERENCES "gmail_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_gmail_message_id_fkey" FOREIGN KEY ("gmail_message_id") REFERENCES "gmail_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_sync_states" ADD CONSTRAINT "gmail_sync_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_sync_states" ADD CONSTRAINT "gmail_sync_states_gmail_connection_id_fkey" FOREIGN KEY ("gmail_connection_id") REFERENCES "gmail_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
