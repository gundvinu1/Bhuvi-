# Google Cloud OAuth 2.0 Setup Guide for BHUVI Gmail Integration

This guide walks you through setting up Google Cloud OAuth 2.0 credentials to connect your personal Gmail account with BHUVI safely, locally, and with zero subscription costs.

---

## 1. Prerequisites

- A standard Google Account (e.g. `@gmail.com`) or Google Workspace account.
- Google Cloud Console access ([https://console.cloud.google.com](https://console.cloud.google.com)).
- BHUVI running locally (`apps/api` on port `4000`, `apps/web` on port `3000`).

---

## 2. Step-by-Step Google Cloud Configuration

### Step 2.1: Create a Google Cloud Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the project dropdown at the top-left and select **New Project**.
3. Name the project `BHUVI-Personal-AI` (or any preferred identifier).
4. Select your organization/location (defaults to "No organization" for personal accounts) and click **Create**.
5. Once created, ensure this project is selected in the top bar.

### Step 2.2: Enable the Gmail API

1. In the left navigation menu, go to **APIs & Services** > **Library**.
2. In the search box, search for `Gmail API`.
3. Click on **Gmail API** by Google.
4. Click the blue **Enable** button. Wait for the API to be enabled.

### Step 2.3: Configure the OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select User Type:
   - **External** (standard for personal `@gmail.com` accounts).
   - Click **Create**.
3. **App information**:
   - App name: `BHUVI AI Assistant`
   - User support email: Select your Gmail address.
   - App logo: (Optional - can be left blank).
4. **App domain**: (Optional - can be left blank for local development).
5. **Developer contact information**:
   - Email addresses: Enter your Gmail address.
6. Click **Save and Continue**.

### Step 2.4: Configure Scopes

1. On the **Scopes** page, click **Add or Remove Scopes**.
2. Filter or scroll to locate and select the following scopes:
   - `openid`
   - `.../auth/userinfo.email`
   - `https://www.googleapis.com/auth/gmail.readonly` (Read resources from Gmail)
   - `https://www.googleapis.com/auth/gmail.compose` (Create drafts and send on your behalf — _Note: BHUVI strictly uses this scope to create user-approved drafts only; BHUVI never auto-sends messages_)
3. Click **Update**.
4. Verify all 4 scopes appear under "Your sensitive scopes" / "Your non-sensitive scopes".
5. Click **Save and Continue**.

### Step 2.5: Add Test Users (Critical for Development)

> [!IMPORTANT]
> Because your Google Cloud project is in **Testing** mode (unverified), Google will block login attempts from any account that is not explicitly registered in the Test Users list.

1. On the **Test users** step, click **+ Add Users**.
2. Enter the exact Gmail address you intend to connect to BHUVI (e.g. `yourname@gmail.com`).
3. Click **Add** and then **Save and Continue**.
4. Review the summary and return to dashboard.

### Step 2.6: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Application type: Select **Web application**.
4. Name: `BHUVI Web Client`.
5. **Authorized JavaScript origins**:
   - Click **+ Add URI** and enter:
     ```
     http://localhost:3000
     ```
   - (Optional) Click **+ Add URI** and enter:
     ```
     http://localhost:4000
     ```
6. **Authorized redirect URIs**:
   - Click **+ Add URI** and enter the exact callback URL configured in BHUVI API:
     ```
     http://localhost:4000/api/v1/gmail/oauth2/callback
     ```
7. Click **Create**.
8. A modal will pop up with:
   - **Client ID** (e.g., `123456789-abcdef.apps.googleusercontent.com`)
   - **Client Secret** (e.g., `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`)
9. Copy both values securely.

---

## 3. Generate Encryption Key for Stored Tokens

BHUVI encrypts all stored OAuth access and refresh tokens using **AES-256-GCM**.
Generate a fresh 32-byte (64 hex characters) cryptographic key by running:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the generated 64-character hex string.

---

## 4. Configure Environment Variables

Open your root `.env` file (or `apps/api/.env`) and add the following entries:

```env
# ==============================================================================
# MODULE 09: GMAIL INTEGRATION CONFIGURATION
# ==============================================================================
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/v1/gmail/oauth2/callback"
GOOGLE_OAUTH_SCOPES="openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose"

# AES-256-GCM Key (64-character hex string from step 3)
GMAIL_TOKEN_ENCRYPTION_KEY="your-64-character-hex-encryption-key"

# Sync settings
GMAIL_SYNC_INTERVAL_MINUTES=15
GMAIL_SYNC_BATCH_SIZE=50
```

---

## 5. Connecting BHUVI to Gmail

1. **Start Infrastructure & Services**:
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - Ollama (`ollama serve`, model `qwen2.5:3b`)
   - Backend API: `pnpm --filter @bhuvi/api dev`
   - Background Worker: `pnpm --filter @bhuvi/worker dev`
   - Frontend Web: `pnpm --filter @bhuvi/web dev`
2. **Open Dashboard**:
   - Visit [http://localhost:3000/dashboard/gmail](http://localhost:3000/dashboard/gmail).
3. **Connect Account**:
   - Click **Connect Gmail Account**.
   - You will be redirected to the Google Accounts consent screen.
   - Select your test Google account.
   - You may see a "Google hasn't verified this app" warning. Click **Advanced** > **Go to BHUVI AI Assistant (unsafe)**.
   - Grant the requested permissions (`Read`, `Compose drafts`).
   - You will be redirected back to the BHUVI Gmail Dashboard with `?auth=success`.
4. **Trigger Initial Synchronization**:
   - Click **Sync Inbox**.
   - BHUVI will synchronize recent emails via BullMQ background jobs.
   - Messages will be parsed, analyzed by Module 07 intelligence, and displayed in your inbox list.
5. **AI Email Actions**:
   - Select any email to view parsed contents, priority, urgency, and action items.
   - Click **Summarize** for quick AI insights.
   - Click **Suggest Reply** to generate contextual draft responses (Formal, Friendly, Concise).
   - Click **Save as Draft to Gmail** to push the draft safely into your official Gmail Drafts folder without auto-sending.
