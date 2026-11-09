# Meta WhatsApp Webhook Configuration Guide for BHUVI

This document explains how to configure and verify incoming WhatsApp webhooks in the Meta Developer Console for both local development and production.

---

## 1. Webhook Handshake Endpoint

- **Callback URL:** `https://your-domain.com/api/v1/whatsapp/webhook`
- **Verify Token:** The exact value configured in `META_WEBHOOK_VERIFY_TOKEN` in your `.env` file.

### Local Development Handshake (with ngrok or cloudflared)

Because Meta requires an HTTPS URL to deliver webhooks, expose your local API port (default: 3001) using a tunnel:

```bash
# Using ngrok:
ngrok http 3001

# Or using cloudflared:
cloudflared tunnel --url http://localhost:3001
```

Your callback URL becomes:
`https://<your-tunnel-subdomain>.ngrok-free.app/api/v1/whatsapp/webhook`

---

## 2. Meta App Configuration Steps

1. Go to your App Dashboard on the [Meta Developer Portal](https://developers.facebook.com/).
2. Under **WhatsApp** in the left sidebar, click **Configuration**.
3. In the **Webhook** section, click **Edit**.
4. Enter:
   - **Callback URL:** `https://<your-public-url>/api/v1/whatsapp/webhook`
   - **Verify Token:** The string configured in `META_WEBHOOK_VERIFY_TOKEN`
5. Click **Verify and Save**. Meta will send a `GET` request with challenge parameters; BHUVI validates the token and echoes the challenge with HTTP 200.
6. Under **Webhook fields**, click **Manage**.
7. Subscribe to the **`messages`** field (this encompasses incoming text, media, interactive messages, and delivery/read statuses).
8. Click **Done**.

---

## 3. Webhook Security & Execution Pipeline

1. **Incoming Request:** Meta POSTs events with the header `X-Hub-Signature-256: sha256=<hash>`.
2. **Signature Verification:** BHUVI computes the HMAC-SHA256 hash using `META_APP_SECRET` and performs a constant-time comparison. Requests with missing or invalid signatures are rejected with HTTP 401.
3. **Deduplication:** Event IDs (`wamid...`) are checked against `WhatsAppWebhookEvent`. Replayed or duplicate webhooks are acknowledged immediately without redundant processing.
4. **Asynchronous BullMQ Queue:** Valid events are stored with status `PENDING` and enqueued onto the BullMQ queue (`bhuvi-default`).
5. **Worker Execution:** The BHUVI worker extracts contacts, creates/updates conversations, parses media metadata, and triggers Module 07 message intelligence.
