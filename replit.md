# CRM Hub

## Overview
A CRM application for managing client data with plans for Slack, Google Sheets, GPT, and Gemini integrations. Currently in MVP phase with authentication.

## Recent Changes
- 2026-03-08: Added multi-select checkboxes to Retention Final Submit page — select all/individual rows, bulk "Send to Sheet" and bulk "Undo" buttons appear when items are selected. Undo button (Undo2 icon) added to each "Added Retention Tracker Successfully!" badge on both Retention Final Submit and CV Report pages. Backend: `POST /api/gsheets/undo-push` resets `sentToSheet` to empty. CV Report also has bulk undo in settings menu when sent items are selected.
- 2026-03-08: Google Sheets column mapping color feature — each mapped column now has fill color and text color pickers in the mapping UI. Colors are saved with `gsheet_color_mapping` setting and applied via `repeatCell` batchUpdate when pushing data to Google Sheets. Backup/restore includes color mapping.
- 2026-03-08: Retention Final Submit page — Slack Update column added between Notes TrimRX and Product Type. Each row has a "Slack" button that, when clicked, opens a right-side Sheet panel showing the matching Slack message from #trimrx--cv--support. Panel includes: full message rendering with user avatars, Mark Done/Remove checkmark, Reply with templates, Payment Intents lookup, thread replies toggle, reactions display, and Open in Slack link. Messages are pre-loaded in background on page load for instant popup. Uses case ID and UUID from link to search Slack.
- 2026-03-08: CV Report date filter and auto-refresh — added date picker filter (matches report date in both YYYY-MM-DD and MM/DD/YYYY formats), orange highlight when active. Auto-refresh every 15 seconds so multiple users see real-time updates without manual refresh.
- 2026-03-08: Slack API performance optimizations — increased concurrent API limit (4→10), added server-side reply caching (5min TTL with proper invalidation on mutations), optimistic UI for reactions (no full refetch on success), reply pre-fetching (up to 15 threads in background), faster batch delays for parent/scan operations. Reply cache cleared on reply/delete mutations.
- 2026-03-07: Added "Disputes Finder" page (`/trimrx/disputes-finder`) under TrimRX Disputes — search customer email via Stripe API, view receipt history with "View receipt" buttons that open Stripe receipt URLs. Shows customer info cards and payment table with date, description, amount, status (refunded/succeeded/pending/failed), payment method, and receipt links. Uses existing `/api/stripe-payments/search` backend endpoint.
- 2026-03-07: Added "Payment Intents" button on Manage Slack Case message cards — extracts case link/ID from message, looks up email from CV Reports (then PT Finder as fallback), searches Stripe for payment intents and subscriptions. Shows results in a dialog with email source badge, subscription cards, and payment intents table. Backend: `POST /api/stripe-payments/lookup-by-case`. Slack URL parsing improved to handle `<url|label>` format.
- 2026-03-06: Added Stripe Payment Details page (`/database/stripe-payments`) under Database section — search customer payment history and subscriptions by email. Connect via Stripe Secret Key stored in `app_settings`. Backend: `server/stripe-payments.ts` with endpoints: `GET /api/stripe-payments/status`, `POST /api/stripe-payments/connect`, `POST /api/stripe-payments/disconnect`, `POST /api/stripe-payments/search`. Shows customer info, summary cards (total paid, refunded, transactions), subscriptions with status badges, and payment history table with receipt links.
- 2026-03-06: Performance & UI improvements — lazy loading all routes (React.lazy + Suspense), gzip compression (excluding SSE streams), smooth page transitions (fade-in), button micro-interactions (btn-press scale), custom thin scrollbar styling, staggered dashboard card animations, skeleton shimmer utility class.
- 2026-03-06: Added "Communication" sidebar section with "Trimrx Internal (BD)" page (`/communication/internal-bd`) — Slack channel viewer for #trimrx-internal-bd. Features: message viewing, search, date filter, status filter (all/pending/done), reply in threads, mark done with checkmark reactions, edit/delete messages, send new messages, file/image rendering. Auto-resolves channel ID by name on load. Permission page: `internal-bd` with features: send-message, reply, mark-done, edit-message, delete-message.
- 2026-03-06: Added progress bars for "Fetch Case Data" and "Check Duplicate" buttons in CV Report — backend tracks progress via in-memory store (progressStore), frontend polls `/api/cv-reports/progress/:taskId` every 500ms. Progress bar shows stage name, percentage, and current/total counts. Both buttons are mutually disabled while either task is running.
- 2026-03-06: Improved "Check Duplicate" — now connects to PT Finder Google Sheet to check if report emails/case IDs already exist in the tracker. A report is marked "Yes" duplicate if its email appears in the Google Sheet or matches another CV report. Also fills missing emails by searching PT Finder by case ID.
- 2026-03-05: Added per-message "Send to CV" button on Manage Slack Case page — appears on top-right of each message card, extracts case data (Case ID, link, concern), runs full GPT analysis (reason, sub-reason, desired action, client threat, confidence), and submits single report to CV Report. Shows "Sent to CV" badge after success. Uses same `send-to-cv` permission.
- 2026-03-05: Added "Match Data" button on Manage Slack Case page — extracts case links/IDs from all displayed messages, batch-searches against PT Finder Google Sheet. Shows "Already in Tracker" (green badge + info bar with Email, Agent, Status, Outcome, Completion Date) or "Not Found on Tracker" (red badge + red info bar). Filter dropdown: All/In Tracker/Not Found. State auto-clears when date or search changes.
- 2026-03-05: Rebuilt PT Finder feature — Database section in sidebar (`/database/pt-finder`), connects to Google Sheet (read-only), search by email/case link/name/any field, card view results with highlighted key columns. Settings dialog for credentials/spreadsheet config. Backend: `server/pt-finder.ts`, endpoints: `GET/POST /api/pt-finder/config`, `POST /api/pt-finder/test`, `POST /api/pt-finder/search`, `POST /api/pt-finder/batch-search`, `POST /api/pt-finder/disconnect`. Settings in `app_settings` with `pt_finder_` prefix.
- 2026-03-05: Added User OAuth Token support in Slack Settings — new Settings button opens token management page with Bot Token and User Token cards. Each card shows which tasks it handles. User Token (xoxp-) enables workspace-wide `search.messages` (much faster than bot cache filtering). Server stores user token in `app_settings` (key: `slack_user_token`). Endpoints: `POST /api/slack/connect-user-token`, `POST /api/slack/disconnect-user-token`. Search falls back to bot cache if user token fails or is unavailable.
- 2026-03-02: Added AI Integrations page (`/integrations`) — select AI provider (Replit Built-in, OpenAI, Google Gemini, xAI Grok), configure model name, enter custom API key, test connection. All providers use same Custom GPT instructions + Reference Examples for case classification. Backend: `GET/POST /api/ai-provider/settings`, `POST /api/ai-provider/test`. Settings stored in `app_settings` table (keys: `ai_provider_type`, `ai_provider_enabled`, `ai_provider_model`, `ai_provider_api_key`). Analysis endpoint now uses dynamic provider via `getAIClient()`.
- 2026-03-01: Added "Check CV Status" feature on Manage Slack Case page — cross-references Slack messages with CV Reports by Case ID. Shows status badges (Closed/Rejected in red, Approved in blue) and CV info bar (report ID, case ID, status, comment count) on each matched message. Includes CV Status filter dropdown (All/Closed-Rejected/Open-Active/No CV Match). Backend: `POST /api/cv-reports/match` endpoint.
- 2026-03-01: Added Reply Templates feature — create reusable reply templates (Subject + Text) managed from Slack settings page. Template picker dropdown appears when replying to messages on both Manage Slack Case and RT Help pages. Templates stored in `app_settings` table as JSON (key: `slack_reply_templates`). CRUD API: `GET/POST /api/slack/reply-templates`, `PUT/DELETE /api/slack/reply-templates/:id`.
- 2026-03-01: Added RT Help page (`/trimrx/rt-help`) under TrimRX CV — view and manage Slack group DM (mpim) messages. Features: dropdown to select group DM (or manual conversation ID input if `mpim:read` scope is missing), view messages with user avatars/names, reply in threads, mark done with checkmark reactions, remove checkmarks, delete bot messages, date filter, search, status filter (all/pending/done), file/image rendering. Selection persisted in localStorage. Uses same server-side Slack endpoints as Manage Slack Case. Headphones icon in sidebar.
- 2026-02-28: Performance optimization for Slack messages — added server-side caching for date-filtered queries (5-min TTL), parallelized parent message fetches (5 at a time), persistent parentMsgCache keyed by channelId:ts, in-memory cache patching for mutations (react/unreact/reply/delete patch both channelCache and dateCache), force=1 query param for Refresh button to bypass cache. Bot user ID cached to avoid repeated auth.test calls.
- 2026-02-27: Added Slack column to CV Report table — each row has a "Slack" button that searches #trimrx--cv--support channel for messages matching the case ID. Opens a popup dialog to view matching messages, reply in threads, and add checkmark reactions. Backend search endpoint: `GET /api/slack/channels/:channelId/search?q=query`.
- 2026-02-27: Added "Manage Slack Case" page (`/trimrx/slack-messages`) under TrimRX CV — view messages from #trimrx--cv--support, reply in threads, add checkmark reactions. User IDs resolved to real names.
- 2026-02-27: Added "CV Slack" placeholder page (`/trimrx/cv-slack`) under TrimRX CV.
- 2026-02-25: Added CareValidate integration — auto-fetch Name, Email, Case ID from CareValidate case pages via GraphQL API. Token stored in DB settings, UI has key icon + "Fetch Case Data" button in CV Report header. Server module: `server/carevalidate.ts`.
- 2026-02-25: Added Link Opener in CV Report header — count selector (5-50) + "Open Links" button opens report links in new tabs.
- 2026-02-23: Added Dispute Report Yedid page — upload CSV with dispute data, review before import, table shows 14 key columns with search and pagination.
- 2026-02-23: Added Case Folder under TrimRX Disputes — create folders by email, upload/download/delete files (PDFs, images, documents up to 10MB). Files stored in PostgreSQL.
- 2026-02-23: Added TrimRX Disputes section with Dispute Support, Dispute Report (coming soon), Case Folder, and Dispute Report Yedid pages.
- 2026-02-23: Added sort order toggle (First to Last / Last to First) on CV Report; order applies to Google Sheets push too.
- 2026-02-23: Added broken link detection with inline editing on CV Report — broken links show red warning and are click-to-fix editable.
- 2026-02-23: Added backup/restore for Google Sheets settings on API Keys page.
- 2026-02-23: Added Bulk Text feature to CV Support — paste large text blocks, auto-extracts only cases mentioning @Olia/@Karla - TrimRx, shows review table before bulk submission to CV Reports. Google Sheets push now auto-formats with left-alignment; added "Clear Sheet Data" button on API Keys page.
- 2026-02-23: Added Google Sheets integration — configure service account credentials, spreadsheet ID, sheet name, start row, and customizable column mapping on API Keys page. Push selected or all CV Reports to Google Sheets from CV Report page.
- 2026-02-23: Added search box, pagination (configurable rows per page), hover tooltips, and inline editing (Name, Customer Email, Date) to CV Report table.
- 2026-02-22: Added GPT Chat page with OpenAI integration via Replit AI Integrations (gpt-4o model, streaming responses, conversation history stored in PostgreSQL).
- 2026-02-22: Added TrimRX section with CV Support and CV Report pages. CV Report has a full CRUD table with columns: Link, Duplicated, Customer Email, Date, Name, Notes TrimRX, Product Type, Client Threat, Reason, Sub-reason, Cancellation Reason, Desired Action.
- 2026-02-22: Added Slack integration — connect workspace via bot token, browse channels, view messages with threads/replies/reactions, send replies, add reactions.
- 2026-02-22: Initial setup with login authentication (no signup). Default admin user seeded: username `admin`, password `2816`.

## Architecture
- **Frontend**: React + Vite, wouter routing, TanStack Query, shadcn/ui components
- **Backend**: Express with Passport.js local strategy, express-session with PostgreSQL session store
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Session-based with passport-local. No signup — admin user is seeded on startup.

## Project Structure
- `shared/schema.ts` - Drizzle schema + Zod validation schemas (users, app_settings)
- `server/db.ts` - Database connection pool
- `server/auth.ts` - Passport setup, session config, auth routes
- `server/seed.ts` - Seeds default admin user
- `server/storage.ts` - Database CRUD via Drizzle (users + app settings key-value store)
- `server/routes.ts` - Route registration
- `server/slack.ts` - Slack API integration (channels, messages, replies, reactions)
- `client/src/hooks/use-auth.tsx` - Auth context and hook
- `client/src/pages/login.tsx` - Login page
- `client/src/pages/dashboard.tsx` - Dashboard shell
- `client/src/pages/slack.tsx` - Slack integration page (connect, channels, messages, threads)
- `client/src/pages/trimrx/cv-support.tsx` - CV Support page with Quick Paste, Bulk Text parser, and Custom GPT
- `client/src/pages/trimrx/cv-report.tsx` - CV Report page with CRUD table
- `server/cv-reports.ts` - CV Report API routes
- `client/src/pages/trimrx/rt-help.tsx` - RT Help page for Slack group DM communication
- `client/src/pages/gpt-chat.tsx` - GPT Chat page with streaming AI conversations
- `server/replit_integrations/chat/` - Chat routes, storage, and OpenAI client (Replit AI Integrations)
- `shared/models/chat.ts` - Drizzle schema for conversations and messages tables
- `server/gsheets.ts` - Google Sheets API integration (config, test, push, disconnect)
- `server/carevalidate.ts` - CareValidate GraphQL integration (fetch case data: name, email, case ID, detailed status via isArchived/archiveReason/archiveNote). 3-tier product type extraction: 1) `caseById.productBundle.name`, 2) `caseTreatments.organizationProduct.name` fallback, 3) title parsing fallback
- `client/src/pages/admin/api-keys.tsx` - API Keys page with Google Sheets setup and column mapping
- `client/src/components/app-sidebar.tsx` - Sidebar with TrimRX and Integrations sections

## Roles & Permissions
- Three roles: `admin` (full access), `manager` (configurable per-feature), `viewer` (read-only on assigned pages)
- Page-level permissions stored as JSON array of route paths in `users.permissions` column: `["/trimrx/rt-help", "/trimrx/cv-report"]`
- Feature permissions stored as JSON object in `users.feature_permissions` column: `{"page-key": ["feature1", "feature2"]}`
- Backward compatibility: old section-key permissions (e.g. `["trimrx-cv"]`) auto-expand to all routes in that section via `parsePermissions()` migration in App.tsx, app-sidebar.tsx, and users.tsx
- Admin role bypasses all permission checks
- Viewer can see their assigned pages but all action buttons are hidden
- Manager sees only assigned pages + specific feature toggles per page
- Page/section/feature registry in `shared/sections.ts` — `APP_PAGES` for route-to-label mapping, `APP_SECTIONS` for section grouping, `APP_FEATURES` for per-page features with `route` field
- Helper functions: `hasRouteAccess()`, `hasPageAccess()`, `hasSectionAccess()`, `hasFeatureAccess()`, `parseFeaturePermissions()` in shared, `usePermissions()` hook in client
- Sidebar filters individual menu items with `hasPageAccess()` — user sees only specific pages they have access to, not entire sections
- User Management page uses collapsible per-section groups with individual page checkboxes, "Enable All / Disable All" toggles per section
- Feature-gated pages: Manage Slack Case (reply, mark-done, send-to-cv, delete-message, check-cv-status, bulk-done), CV Report (add, edit, delete, export, push-sheets, slack-lookup), RT Help (send-message, reply, mark-done, edit-message, delete-message), CV Support (submit-case, bulk-submit, manage-gpt, import-export), Dispute Report Yedid (add, edit, delete, import), Case Folders (add, edit, delete, upload), Disputes Doc (add, edit, delete), Stripe Submit (submit, edit), Patients Analysis (analyze, export)

## Auth Routes
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user with role/permissions (401 if not authenticated)

## Slack Routes
- `GET /api/slack/status` - Check connection status
- `POST /api/slack/connect` - Connect with bot token
- `POST /api/slack/disconnect` - Disconnect workspace
- `GET /api/slack/channels` - List channels
- `GET /api/slack/channels/:id/messages` - Get channel messages
- `GET /api/slack/channels/:id/replies/:threadTs` - Get thread replies
- `GET /api/slack/users` - Get user profiles
- `POST /api/slack/channels/:id/reply` - Send reply in thread
- `POST /api/slack/channels/:id/react` - Add reaction to message

## CV Report Routes
- `GET /api/cv-reports` - List all reports
- `GET /api/cv-reports/:id` - Get single report
- `POST /api/cv-reports` - Create report
- `PATCH /api/cv-reports/:id` - Update report
- `DELETE /api/cv-reports/:id` - Delete report

## GPT Chat Routes
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation with messages
- `POST /api/conversations` - Create new conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `POST /api/conversations/:id/messages` - Send message and stream AI response (SSE)

## Google Sheets Routes
- `GET /api/gsheets/config` - Get Google Sheets configuration (credentials hidden)
- `POST /api/gsheets/config` - Save configuration (credentials, spreadsheet ID, sheet name, start row, column mapping)
- `POST /api/gsheets/test` - Test connection to spreadsheet
- `POST /api/gsheets/push` - Push selected CV Reports to Google Sheets
- `POST /api/gsheets/disconnect` - Remove all Google Sheets configuration

## User Preferences
- No signup functionality — only login
- Default credentials: admin / 2816
