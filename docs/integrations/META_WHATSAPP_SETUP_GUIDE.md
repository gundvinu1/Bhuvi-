# Meta WhatsApp Business Platform Setup Guide for BHUVI

This guide walks you through setting up an official **Meta WhatsApp Business Platform** application, acquiring credentials, configuring a System User with permanent access, and connecting your phone number(s) to BHUVI.

---

## 1. Prerequisites

1. A [Meta for Developers](https://developers.facebook.com/) account.
2. A Meta Business Account (created through Meta Business Suite).
3. A clean phone number dedicated to WhatsApp Business (or a Meta test phone number provided in the developer dashboard).

---

## 2. Step-by-Step Meta Developer Setup

### Step A: Create a Meta App

1. Go to the [Meta Developer Portal](https://developers.facebook.com/apps/).
2. Click **Create App**.
3. Select **Other** as the use case &rarr; Click **Next**.
4. Select **Business** as the app type &rarr; Click **Next**.
5. Provide an App Name (e.g. `BHUVI Personal OS`), enter your contact email, and select your Meta Business Account.
6. Click **Create app**.

### Step B: Add WhatsApp to Your App

1. On the App Dashboard, find **WhatsApp** under "Add products to your app" and click **Set up**.
2. Review the Quickstart and observe the provided:
   - **Test Phone Number ID**
   - **WhatsApp Business Account ID (WABA ID)**
   - **Temporary Access Token**

### Step C: Create a Permanent System User Token

Temporary access tokens expire after 24 hours. For persistent local BHUVI usage:

1. Open [Meta Business Suite / Business Settings](https://business.facebook.com/settings).
2. Under **Users**, click **System Users** &rarr; Click **Add**.
3. Name the system user (e.g. `bhuvi-worker`) and assign the **Admin** role.
4. Click **Generate New Token**.
5. Select your App: `BHUVI Personal OS`.
6. Select token expiration: **Never** (or the maximum allowed duration).
7. Check the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
8. Click **Generate Token** and immediately copy and store the generated token.

---

## 3. Configuring BHUVI Environment Variables

Add the following keys to your `.env` file:

```env
# Meta App Credentials
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_WEBHOOK_VERIFY_TOKEN=your_custom_secret_verify_token

# WhatsApp Encryption (AES-256-GCM)
WHATSAPP_TOKEN_ENCRYPTION_KEY=your_cryptographically_secure_32_byte_hex_key
WHATSAPP_API_VERSION=v20.0
WHATSAPP_WEBHOOK_URL=http://localhost:3001/api/v1/whatsapp/webhook
```

---

## 4. Connecting Your WhatsApp Number in the BHUVI Dashboard

1. Start BHUVI and log into your dashboard.
2. Navigate to **WhatsApp Business** (`/dashboard/whatsapp`).
3. Click **+ Connect Phone Number**.
4. Enter:
   - **Meta Business Account ID (WABA ID)**
   - **Phone Number ID**
   - **Display Phone Number** (e.g. `+1 555-0100`)
   - **Display Channel Name** (e.g. `Customer Support`)
   - **Permanent Access Token**
5. Click **Save Connection**.
6. The account is now connected and ready to receive messages and manage drafts.
