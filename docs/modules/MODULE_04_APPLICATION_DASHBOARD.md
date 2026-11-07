# BHUVI – Module 04: Application Dashboard

**Status:** ✅ **COMPLETE**  
**Module:** 04 – Application Dashboard  
**Date:** 2026-11-07  
**Architecture:** Next.js 14 App Router, TypeScript Strict Mode, Tailwind CSS, HttpOnly Cookie Authentication

---

## 1. Overview & Objective

Module 04 delivers the central visual operating system interface of BHUVI. Following successful authentication, users enter a responsive, distraction-free command dashboard designed with a modern AI SaaS aesthetic: clean typography, subtle borders, high contrast, and accessible visual hierarchy.

Crucially, **no fake data is presented as real**. All pending modules and integrations (Message Intelligence, Ollama AI Engine, Calendar, Tasks, Socials) display honest placeholders and upcoming module indicators.

---

## 2. Architecture & Layout

### 2.1 Navigation & Shell

- **Desktop Sidebar Navigation (`apps/web/components/dashboard/sidebar.tsx`):**
  - BHUVI logo and brand wordmark.
  - Collapsible toggle: easily switches between full width (`w-64`) and compact icon-only mode (`w-20`).
  - Active route indicators with indigo accent glow.
  - Functional links: **Overview** (`/dashboard`) and **Settings** (`/dashboard/settings`).
  - Upcoming features with distinct badges (`Soon`) and target module references:
    - AI Assistant (`Module 05`)
    - Messages (`Module 07`)
    - Emails (`Module 09`)
    - Tasks (`Module 12`)
    - Calendar (`Module 12`)
    - Social Accounts (`Module 11`)
    - Activity History (`Module 06`)
  - User profile summary with initials avatar, full name, email, and one-click logout.

- **Mobile Navigation Drawer (`apps/web/components/dashboard/mobile-sidebar.tsx`):**
  - Slide-over drawer with backdrop blur overlay and smooth transitions.
  - Complete navigation menu, profile details, and sign out button for smaller screens.

- **Top Navigation Bar (`apps/web/components/dashboard/topbar.tsx`):**
  - Responsive hamburger menu button for mobile.
  - Dynamic page title and breadcrumb navigation (`BHUVI / Overview`, `BHUVI / Overview / Settings`).
  - Visual Command/Search Bar with `⌘K` shortcut badge (clearly marked as visual/upcoming).
  - Real-time **System Status Pill** with live backend telemetry popover.
  - Notification icon with upcoming tooltip.
  - User avatar with dropdown profile menu.

---

## 3. Dashboard Views & Features

### 3.1 Overview Dashboard (`/dashboard`)

1. **Personalized Welcome Section (`components/dashboard/welcome-section.tsx`):**
   - Time-of-day greeting (e.g. "Good morning, Vinayak") dynamically calculated from local browser time.
   - User's local formatted date (e.g. "Saturday, November 7, 2026").
   - System state indicator: "Local-First Mode Active".

2. **Statistics Cards Grid (`components/dashboard/stat-card.tsx`):**
   - 4 Cards displaying honest placeholders without fabricated counters:
     1. **Total Messages:** Value: `Coming soon` · Status: `Module 07`
     2. **Unread Messages:** Value: `Coming soon` · Status: `Module 07`
     3. **Pending Tasks:** Value: `Coming soon` · Status: `Module 12`
     4. **Connected Accounts:** Value: `Coming soon` · Status: `Modules 09-11`

3. **BHUVI AI Assistant Panel (`components/dashboard/assistant-panel.tsx`):**
   - Prominent branded companion panel with glowing gradient emblem.
   - Informative welcome message explaining upcoming local Ollama integration.
   - Interactive prompt input with arrow button.
   - One-click suggestion pills ("Summarize my messages", "Show today's priorities", "What should I focus on today?").
   - Honest user feedback: clearly notes that natural language execution will activate in Module 05.

4. **Recent Activity Section (`components/dashboard/recent-activity.tsx`):**
   - Empty state: _"No activity yet. Your activity will appear here when BHUVI starts working."_
   - Explains that autonomous background agents (Module 06) will stream live tasks here.

5. **Daily Intelligence Section (`components/dashboard/daily-intelligence.tsx`):**
   - Placeholder briefing card: _"Your daily intelligence report will appear here."_
   - Explains that Module 13 will synthesize morning summaries of messages, priorities, and tasks.

### 3.2 Settings Page (`/dashboard/settings`)

- **Profile Information:** Pulls authenticated profile from `/api/v1/auth/me` (Name, Email, Local UUID, Member Since date).
- **Security & Infrastructure:** Explains active HttpOnly cookie authentication, PostgreSQL 16 persistence via Prisma, and BullMQ Redis worker.
- **Appearance Preferences:** Interactive theme switcher (`Dark Mode` [Default], `Light Mode` [Preview], `System Default`).
- **Session Management:** Prominent red "Sign Out of BHUVI" action that triggers `/api/v1/auth/logout` and redirects to `/login`.

---

## 4. Authentication Integration Details

- **Dual-Transport HttpOnly Cookie Enforcement:**
  - `apps/web/lib/api.ts` automatically attaches `credentials: 'include'` on all client requests.
  - Browser automatically transmits `bhuvi_token` cookie without exposing it to client-side JavaScript.
  - Zero storage of JWT tokens in `localStorage` or `sessionStorage`.
- **Client Auth Context & Guard (`apps/web/lib/auth-context.tsx`):**
  - `AuthProvider` mounts, fetches `/api/v1/auth/me`, and manages `user`, `isLoading`, and `isAuthenticated`.
  - `AuthGuard` displays an animated branded loader during verification.
  - Unauthenticated access redirects immediately to `/login`.
  - Logging out calls `POST /api/v1/auth/logout` to clear server cookies, resets client state, and navigates to `/login`.
  - Page refresh preserves the session via cookie re-validation.

---

## 5. Backend Health Integration

- **Hook (`apps/web/lib/use-health.ts`):** Probes `GET /api/v1/health` on mount and every 30 seconds.
- **System Status Pill (`components/dashboard/system-status.tsx`):**
  - `Healthy`: Emerald green dot (`bg-emerald-400`).
  - `Degraded`: Amber dot (`bg-amber-400`).
  - `Unavailable`: Rose dot (`bg-rose-400`).
  - `Checking`: Blue pulsing dot (`bg-blue-400 animate-pulse`).
- **Telemetry Popover:** Shows API version, PostgreSQL connection state, Redis connection state, and uptime without exposing connection strings, hosts, or secrets.

---

## 6. Screenshots

| View                   | Device             | Screenshot File                          |
| ---------------------- | ------------------ | ---------------------------------------- |
| **Overview Dashboard** | Desktop (1440x900) | `docs/screenshots/dashboard-desktop.png` |
| **Settings View**      | Desktop (1440x900) | `docs/screenshots/settings-desktop.png`  |
| **Overview Dashboard** | Mobile (390x844)   | `docs/screenshots/dashboard-mobile.png`  |
| **Settings View**      | Mobile (390x844)   | `docs/screenshots/settings-mobile.png`   |

---

## 7. Verification Summary

```text
1. Formatting Check:
   pnpm format:check  → PASS (100% Prettier compliant)

2. Typecheck:
   pnpm typecheck     → PASS (6/6 projects, 0 errors)

3. Lint:
   pnpm lint          → PASS (0 errors, 0 warnings across all workspaces)

4. Automated Tests:
   pnpm test          → PASS (19 suites, 89 tests passed across monorepo)
     - apps/web: 6 suites, 16 passed
     - apps/api: 12 suites, 68 passed
     - apps/worker: 1 suite, 5 passed

5. Real Infrastructure E2E:
   pnpm test:infra    → PASS (PostgreSQL 16, Redis 7, BullMQ, Degradation & Recovery)

6. Production Build:
   pnpm build         → PASS (All 8 Next.js App Router routes prerendered cleanly)
```
