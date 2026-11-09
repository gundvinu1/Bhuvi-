-- CreateTable
CREATE TABLE "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_account_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "token_iv" TEXT NOT NULL,
    "token_auth_tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "name" TEXT,
    "profile_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "text_content" TEXT,
    "media_metadata" JSONB,
    "delivery_status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_media" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "filename" TEXT,
    "file_size" INTEGER,
    "storage_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processing_status" TEXT NOT NULL DEFAULT 'PENDING',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "template_name" TEXT,
    "template_params" JSONB,
    "approval_status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_connections_user_id_idx" ON "whatsapp_connections"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_connections_phone_number_id_idx" ON "whatsapp_connections"("phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_connections_status_idx" ON "whatsapp_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_user_id_phone_number_id_key" ON "whatsapp_connections"("user_id", "phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_user_id_idx" ON "whatsapp_contacts"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_connection_id_idx" ON "whatsapp_contacts"("connection_id");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_wa_id_idx" ON "whatsapp_contacts"("wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_connection_id_wa_id_key" ON "whatsapp_contacts"("connection_id", "wa_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_user_id_idx" ON "whatsapp_conversations"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_connection_id_idx" ON "whatsapp_conversations"("connection_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_contact_id_idx" ON "whatsapp_conversations"("contact_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_last_message_at_idx" ON "whatsapp_conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_connection_id_contact_id_key" ON "whatsapp_conversations"("connection_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_message_id_key" ON "whatsapp_messages"("message_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_user_id_idx" ON "whatsapp_messages"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_connection_id_idx" ON "whatsapp_messages"("connection_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversation_id_idx" ON "whatsapp_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_external_message_id_idx" ON "whatsapp_messages"("external_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_timestamp_idx" ON "whatsapp_messages"("timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_messages_direction_idx" ON "whatsapp_messages"("direction");

-- CreateIndex
CREATE INDEX "whatsapp_messages_delivery_status_idx" ON "whatsapp_messages"("delivery_status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_connection_id_external_message_id_key" ON "whatsapp_messages"("connection_id", "external_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_media_message_id_idx" ON "whatsapp_media"("message_id");

-- CreateIndex
CREATE INDEX "whatsapp_media_media_id_idx" ON "whatsapp_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_webhook_events_event_id_key" ON "whatsapp_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_connection_id_idx" ON "whatsapp_webhook_events"("connection_id");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_processing_status_idx" ON "whatsapp_webhook_events"("processing_status");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_received_at_idx" ON "whatsapp_webhook_events"("received_at");

-- CreateIndex
CREATE INDEX "whatsapp_message_drafts_user_id_idx" ON "whatsapp_message_drafts"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_drafts_connection_id_idx" ON "whatsapp_message_drafts"("connection_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_drafts_conversation_id_idx" ON "whatsapp_message_drafts"("conversation_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_drafts_approval_status_idx" ON "whatsapp_message_drafts"("approval_status");

-- AddForeignKey
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "whatsapp_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_drafts" ADD CONSTRAINT "whatsapp_message_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_drafts" ADD CONSTRAINT "whatsapp_message_drafts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_drafts" ADD CONSTRAINT "whatsapp_message_drafts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
