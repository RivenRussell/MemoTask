# MemoTask Development Context

Created: 2026-06-22
Updated: 2026-06-23

This document records the implementation context for MemoTask V1 and V2. It is safe to keep in the repository and avoids private Cloudflare account identifiers, dashboard URLs, and full secrets.

## Source Of Truth

Primary product and engineering plan:

```text
docs/memotask-v1-employee-task-plan.md
```

Supporting files:

```text
docs/v1-implementation-task-plan.md
docs/readable-design-plan.md
docs/project-plan.md
docs/ui-mockups/
```

If planning documents conflict, prefer the employee task plan and then the current code.

## Product Decisions

V1 scope:

1. Complete the MemoTask V1 flow rather than a single phase.
2. Use Chinese UI from the start.
3. Keep the product focused on Memo capture, Todo extraction, queue ordering, detail management, and History.
4. Infer missing UI states from the existing Soft Clay visual system.
5. Avoid dates, reminders, tags, payments, subscriptions, independent search pages, and a self-built login page in V1.
6. Use DeepSeek/OpenAI-compatible AI settings with default base URL `https://api.deepseek.com` and model `deepseek-v4-pro`.

V2 scope:

1. Add public email/password registration and login.
2. Require email verification before entering the Memo app.
3. Add logout, forgot password, and reset password flows.
4. Store sessions in HttpOnly cookies named `memotask_session`.
5. Isolate Memo, draft, history, AI settings, sync status, and export data by authenticated user.
6. Keep OAuth, teams, roles, admin dashboards, billing, public profiles, tags, reminders, and date/month map features out of V2.

## Technical Direction

MemoTask uses:

- React + TypeScript + Vite for the frontend.
- Hono inside Cloudflare Workers for API routes.
- Cloudflare Workers Assets for static files.
- Cloudflare D1 for persistence.
- Application-level V2 auth as the primary account boundary.
- Cloudflare Access as an optional extra deployment-level protection layer.
- Vitest and Playwright for verification.

The app is intentionally deployed as a single Worker so frontend, API, and static assets move together.

## Credential Handling

Never commit full secrets.

Do not write full AI API keys into:

- repo files
- documentation
- committed screenshots
- logs
- test artifacts intended for GitHub

Use only placeholder or masked values in docs:

```text
sk-...last4
```

Production secret:

```text
APP_ENCRYPTION_KEY
EMAIL_API_KEY
EMAIL_FROM
APP_BASE_URL
```

Local-only secret files should remain ignored:

```text
.dev.vars
.env
.env.*
```

AI API keys are entered through the app Settings page and encrypted before D1 persistence.

## Cloudflare State

Detailed setup and reproduction steps are in:

```text
docs/cloudflare-setup.md
```

Current public production URL:

```text
https://memotask.rrwks.cn/login
```

Current Cloudflare resources:

```text
Worker name: memotask
D1 database name: memotask-db
D1 binding: DB
Custom domain: memotask.rrwks.cn
Worker secrets or variables: APP_ENCRYPTION_KEY, EMAIL_API_KEY, EMAIL_FROM, APP_BASE_URL
```

Authentication:

- Zero Trust Free has been used during setup.
- An owner-only Access policy was tested earlier.
- Current production custom domain is public for cross-device testing.
- V2 now provides application-level auth; Cloudflare Access can be re-enabled as an extra outer gate.

## Latest Verified Deployment

V2 auth code-verification deployment:

```text
Date: 2026-06-24
Worker version ID: 547421ff-e016-42fc-9e3b-83d28ae111c5
Production JS bundle: /assets/index-4D30vy--.js
Production CSS bundle: /assets/index-D24fTpf2.css
```

Verification:

```text
npm test -> 19 files, 80 tests passed
npm run build -> passed
Local Playwright Chrome smoke -> /login, /signup, /verify-email passed
GET https://memotask.rrwks.cn/api/health -> {"ok":true}
GET https://memotask.rrwks.cn/login -> 200 OK
GET https://memotask.rrwks.cn/signup -> 200 OK
GET https://memotask.rrwks.cn/api/memos without session -> 401 AUTH_REQUIRED
Production registration smoke -> 201, Resend email path triggered; temporary test user cleaned from D1
```

Auth changes in the latest deployment:

- `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `/verify-email` are now first-class routes.
- Email verification uses a 6-digit code and returns verified users to `/login`.
- Signup includes confirm password, password visibility toggle, and a 6+ character letter/number password hint.
- Login support actions are lighter text buttons with improved desktop and mobile spacing.

## Implementation Notes

Core frontend files:

```text
src/App.tsx
src/components/AppShell.tsx
src/components/MemoCard.tsx
src/pages/CapturePage.tsx
src/pages/MemosPage.tsx
src/pages/MemoDetailPage.tsx
src/pages/HistoryPage.tsx
src/pages/SettingsPage.tsx
src/state/app-state.ts
src/styles.css
```

Core Worker files:

```text
worker/index.ts
worker/api.ts
worker/auth/
worker/domain/state-machines.ts
worker/repository/d1-repository.ts
worker/repository/memory-repository.ts
worker/repository/types.ts
```

Database migration:

```text
migrations/0001_initial.sql
migrations/0002_auth.sql
```

The repository uses a `MemoryRepository` and `MemoryAuthRepository` for tests, and `D1Repository` plus `D1AuthRepository` for production.

## Git Version Points

V1 baseline:

```text
Branch: codex/memotask-v1
Commit: a6eceb7 chore: establish v1 baseline
```

V2 auth branch:

```text
Branch: codex/v2-auth
Key commits:
7ac146b docs: add v2 auth design
d7b8329 docs: add v2 auth implementation plan
0802617 feat: add auth schema and services
cd1e409 feat: protect api with user sessions
a0717e8 feat: isolate memo data by user
b4cb93b feat: add auth UI flows
f54f757 feat: wire auth persistence and email delivery
```

Useful rollback commands:

```bash
git switch codex/memotask-v1
git switch codex/v2-auth
git log --oneline --decorate
```

## Verification Commands

Use these before deployment:

```bash
npm test
npm run build
npx playwright test tests/e2e/visual-qa.spec.ts --project=android
npx playwright test tests/e2e/visual-qa.spec.ts --project=pc
```

Use these after deployment:

```bash
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
curl -s https://memotask.rrwks.cn/login
```

The final command should show the latest `/assets/index-*.js` and `/assets/index-*.css` references.

## Remaining Product Decisions

Before public use:

1. Decide whether `memotask.rrwks.cn` remains public or gets an additional Cloudflare Access gate.
2. Decide whether preview URLs should remain public.
3. Decide whether existing V1 `user_id = 'default'` rows should be manually assigned to a first real owner account before opening public registration.

## GitHub Upload Checklist

Before pushing:

1. Confirm `.dev.vars`, `.env`, `dist/`, `.wrangler/`, `output/`, and `test-results/` are not staged.
2. Search for full API keys and private Cloudflare IDs.
3. Keep only masked or placeholder secrets in docs.
4. Review `README.md` and `docs/cloudflare-setup.md` as the public entry points.
