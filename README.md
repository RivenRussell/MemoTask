# MemoTask

MemoTask is a Chinese-first, low-pressure Memo queue. It turns rough thoughts into ordered Memo cards, keeps only the next actionable Todo items in view, and archives completed work into searchable history.

The current release is V2. It adds application-level account management with email registration, login, email verification, password reset, HttpOnly sessions, and per-user Memo data isolation.

The app is built as a single Cloudflare Worker application: React/Vite serves the UI, Hono handles `/api/*`, and Cloudflare D1 stores accounts, sessions, Memo, Todo, history, undo, sync, and AI settings data.

Production URL for this deployment:

```text
https://memotask.rrwks.cn/memos
```

## Product Design

MemoTask deliberately avoids calendar/task-manager complexity. There are no dates, reminders, tags, subscriptions, or independent search pages. The core loop is:

1. Write a raw Memo on the recording page.
2. Optionally use AI to split it into Todo drafts.
3. Publish it into the priority queue.
4. Work through Todo items in order.
5. Let completed Memos move into History, or archive them manually.

The UI uses a Soft Clay / neumorphic visual system with Chinese labels throughout. The queue is intentionally quiet: Memo order is priority, card previews show up to three Todo items, and cards now show how many Todo items remain hidden.

## Main Features

- Public email/password account registration, login, logout, email verification, and password reset.
- HttpOnly session cookies and per-user separation for Memo, draft, history, AI settings, sync status, and JSON export data.
- Capture page with auto-saved drafts and recent draft recovery.
- AI analysis using a DeepSeek/OpenAI-compatible chat completions API.
- Active Memo queue with drag sorting and up/down controls.
- Memo detail management with editable title, content, Todo text, Todo order, and manual archive.
- Optimistic UI updates for common operations so slow network requests do not block interaction.
- Automatic archive when every visible Todo is completed.
- History page with search, restore, bulk soft-delete, and short-window undo.
- Settings page for AI base URL, model, API key, prompt template, connection test, and JSON export.
- Responsive PC and Android layouts verified with Playwright visual QA.

## Architecture

```text
React + Vite
  |
  | /api/*
  v
Cloudflare Worker (Hono)
  |
  v
Repository interface
  |-- D1Repository      production Cloudflare D1
  |-- MemoryRepository  tests and local API tests

Static assets are served by the same Worker through Cloudflare Workers Assets.
```

Important paths:

```text
src/                     React app, pages, state, API client, styles
worker/                  Hono API, domain logic, repository implementations
worker/auth/             Account service, password/token crypto, auth persistence, email sender
migrations/              Cloudflare D1 schema migrations
tests/api/               Worker/API/repository tests
tests/ui/                React UI tests
tests/e2e/               Playwright PC/Android visual and performance checks
docs/cloudflare-setup.md Detailed Cloudflare setup and deployment guide
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Hono
- Cloudflare Workers
- Cloudflare Workers Assets
- Cloudflare D1
- Wrangler
- Vitest + Testing Library
- Playwright
- `@dnd-kit` for drag sorting
- `lucide-react` for icons

Verified local environment during development:

```text
Node.js v24.15.0
npm 11.14.0
Wrangler 4.103.0
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The dev server listens on:

```text
http://127.0.0.1:5173
```

Run the Worker locally with Wrangler:

```bash
npm run worker:dev
```

Apply D1 migrations locally:

```bash
npm run db:migrate:local
```

## Tests

Run all unit and integration tests:

```bash
npm test
```

Run API tests only:

```bash
npm run test:api
```

Run UI tests only:

```bash
npm run test:ui
```

Run the production build:

```bash
npm run build
```

Run Playwright checks:

```bash
npm run e2e
```

The Playwright config uses installed Chrome via the `chrome` channel for both PC and Pixel 7 style Android projects.

## Cloudflare Deployment

This project deploys as one Worker named `memotask`.

Current `wrangler.toml` uses:

```toml
name = "memotask"
main = "worker/index.ts"
compatibility_date = "2026-06-22"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
preview_urls = true

[[routes]]
pattern = "memotask.rrwks.cn"
custom_domain = true

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "<your-d1-database-id>"
```

High-level deployment flow:

```bash
npm run build
npm run db:migrate:remote
npm run worker:deploy
```

Required Cloudflare resources:

- Cloudflare account with Workers enabled.
- D1 database named `memotask-db`.
- Worker secret `APP_ENCRYPTION_KEY`.
- Worker secret `EMAIL_API_KEY`.
- Worker variable or secret `EMAIL_FROM`.
- Worker variable or secret `APP_BASE_URL`.
- Optional custom domain, for example `memotask.example.com`.
- Optional Cloudflare Access application if you want an extra Cloudflare-level login gate.

Detailed setup steps are in [docs/cloudflare-setup.md](docs/cloudflare-setup.md).

## Secrets And AI Settings

Do not commit real secrets.

The Worker requires these production secrets or variables:

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put APP_BASE_URL
```

MemoTask does not require an AI key in repo files. Configure AI from the app Settings page:

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-pro
API key: entered in UI, stored encrypted in D1
```

The Worker encrypts the API key with `APP_ENCRYPTION_KEY` before persistence. Public API responses expose only a masked key value.

For local-only secrets, use ignored files such as `.dev.vars` or `.env`.
See [.env.example](.env.example) for the required key name.

## API Surface

The Worker handles these API groups:

```text
GET    /api/health
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/verify-email
POST   /api/auth/resend-verification
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/drafts
GET    /api/drafts/recent
PATCH  /api/drafts/:id
POST   /api/memos/publish
GET    /api/memos
GET    /api/memos/:id
PATCH  /api/memos/:id
POST   /api/memos/:id/archive
POST   /api/memos/:id/restore
POST   /api/memos/reorder
POST   /api/memos/:memoId/todos
POST   /api/todos/:id/toggle
PATCH  /api/todos/:id
DELETE /api/todos/:id
POST   /api/todos/reorder
GET    /api/history
GET    /api/history/search
POST   /api/history/bulk-delete
POST   /api/history/undo-delete
GET    /api/export/json
GET    /api/ai/settings
PUT    /api/ai/settings
POST   /api/ai/reset-prompt
POST   /api/ai/test
POST   /api/ai/analyze-draft
GET    /api/sync/status
```

## Database

The D1 schema is defined in [migrations/0001_initial.sql](migrations/0001_initial.sql) and [migrations/0002_auth.sql](migrations/0002_auth.sql). It creates:

- `memos`
- `memo_todos`
- `ai_settings`
- `undo_operations`
- `sync_meta`
- `users`
- `sessions`
- `email_verification_tokens`
- `password_reset_tokens`

Indexes support active queue sorting, history listing, Todo ordering, user lookup, session lookup, and token lookup.

## Security Notes

- V2 uses application-level auth by default. Non-auth APIs require a verified session.
- Cloudflare Access can still be enabled as an additional outer gate, but it is no longer the primary account system.
- Preview URLs are useful for debugging but should be restricted before external sharing if the data matters.
- AI API keys should only be entered through Settings or stored as Cloudflare/local secrets.
- Never commit `.dev.vars`, `.env`, build artifacts, screenshots, or Playwright output.

## Version Management

- V1 rollback baseline: branch `codex/memotask-v1`, commit `a6eceb7 chore: establish v1 baseline`.
- V2 feature branch: `codex/v2-auth`.
- V2 auth commits are split into design, schema/service, API protection, user isolation, UI flows, production wiring, and release docs.
- To inspect or recover V1 locally: `git switch codex/memotask-v1`.
- To continue V2 work: `git switch codex/v2-auth`.

## Documentation

- [Cloudflare setup and deployment](docs/cloudflare-setup.md)
- [Development context](docs/development-context.md)
- [V1 implementation task plan](docs/v1-implementation-task-plan.md)
- [Readable design plan](docs/readable-design-plan.md)
- [UI mockups](docs/ui-mockups/)
