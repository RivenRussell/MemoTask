# Cloudflare Setup And Deployment

Updated: 2026-06-23

This guide explains how MemoTask is deployed on Cloudflare and how to reproduce the setup in another Cloudflare account.

MemoTask uses one Cloudflare Worker for both the frontend and backend:

- Workers Assets serves the Vite build from `dist/`.
- The Worker runs first for `/api/*`.
- Cloudflare D1 stores application data.
- MemoTask V2 provides application-level accounts with email verification and password reset.
- A custom domain points directly to the Worker.
- Cloudflare Access is optional as an extra outer protection layer.

## Billing Safety

Cloudflare changes can create billable resources. Stop and confirm before:

- Buying a domain.
- Switching to a paid plan.
- Enabling a paid product.
- Entering or submitting payment details.
- Confirming checkout, purchase, or subscription actions.

The current MemoTask deployment uses Workers, D1, Zero Trust Free, and a custom domain already managed in Cloudflare. No paid Cloudflare action is required for normal redeploys.

## Current Production Summary

Current production app URL:

```text
https://memotask.rrwks.cn/memos
```

Current Worker:

```text
Worker name: memotask
workers.dev URL: https://memotask.<account-subdomain>.workers.dev
Custom domain: https://memotask.rrwks.cn
```

Current D1 binding:

```text
Binding: DB
Database name: memotask-db
```

Current AI defaults:

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-pro
API key storage: encrypted in D1 after being entered in app Settings
```

Latest verified deployment after the UI polish pass:

```text
Worker version ID: <masked-worker-version-id>
Production bundle: /assets/index-C0wqRxWN.js
Production CSS: /assets/index-C_BKT7Az.css
Health check: https://memotask.rrwks.cn/api/health -> {"ok":true}
```

## Required Cloudflare Resources

Create or verify these resources:

1. Cloudflare Workers application named `memotask`.
2. Cloudflare D1 database named `memotask-db`.
3. D1 binding named `DB`.
4. Worker secret named `APP_ENCRYPTION_KEY`.
5. Worker secret named `EMAIL_API_KEY`.
6. Worker variable or secret named `EMAIL_FROM`.
7. Worker variable or secret named `APP_BASE_URL`.
8. Optional custom domain, such as `memotask.example.com`.
9. Optional Cloudflare Access application if an extra Cloudflare-level gate is needed.

## Local Prerequisites

Install dependencies:

```bash
npm install
```

Log in to Cloudflare:

```bash
npx wrangler login
```

Verify Wrangler:

```bash
npx wrangler --version
```

The version used during this deployment was:

```text
4.103.0
```

## Worker And Assets Configuration

`wrangler.toml` should use this shape:

```toml
name = "memotask"
main = "worker/index.ts"
compatibility_date = "2026-06-22"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
preview_urls = true

[[routes]]
pattern = "memotask.example.com"
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

For this project, the custom domain is:

```toml
[[routes]]
pattern = "memotask.rrwks.cn"
custom_domain = true
```

Important details:

- `not_found_handling = "single-page-application"` allows direct routes such as `/memos`, `/history`, and `/settings` to load the React app.
- `run_worker_first = ["/api/*"]` ensures API requests go to Hono instead of static assets.
- `workers_dev = true` keeps the fallback `workers.dev` URL enabled.
- `preview_urls = true` allows preview deployments. Restrict this later if preview data should not be public.

## D1 Database Setup

Create the D1 database:

```bash
npx wrangler d1 create memotask-db
```

Wrangler returns a `database_id`. Copy it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "<your-d1-database-id>"
```

Apply the migration locally:

```bash
npm run db:migrate:local
```

Apply the migration remotely:

```bash
npm run db:migrate:remote
```

The schema is split across [migrations/0001_initial.sql](../migrations/0001_initial.sql) and [migrations/0002_auth.sql](../migrations/0002_auth.sql). It creates:

```text
memos
memo_todos
ai_settings
undo_operations
sync_meta
users
sessions
email_verification_tokens
password_reset_tokens
```

Useful verification command:

```bash
npx wrangler d1 execute memotask-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected application tables include:

```text
ai_settings
email_verification_tokens
memo_todos
memos
password_reset_tokens
sessions
sync_meta
undo_operations
users
```

## Worker Secrets

Set `APP_ENCRYPTION_KEY` before using AI settings in production:

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
```

Use a long random value. Do not commit it.

This secret is used to encrypt API keys entered through the app Settings page before they are stored in D1.

Set email delivery configuration before opening registration or password reset in production:

```bash
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put APP_BASE_URL
```

V2 sends verification and password-reset emails through a Resend-compatible HTTP API. Use values like:

```text
EMAIL_FROM=MemoTask <noreply@example.com>
APP_BASE_URL=https://memotask.example.com
```

If email configuration is missing, registration and password recovery fail clearly instead of pretending an email was sent.

For local Worker development, use `.dev.vars` and keep it ignored by Git:

```text
APP_ENCRYPTION_KEY=<local-random-secret>
EMAIL_API_KEY=<local-email-provider-key>
EMAIL_FROM=MemoTask <noreply@example.com>
APP_BASE_URL=http://127.0.0.1:8787
```

The repository includes [.env.example](../.env.example) with the required key name.

## AI Configuration

MemoTask stores AI settings through the application UI, not through committed config files.

Open:

```text
https://memotask.rrwks.cn/settings
```

Use:

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-pro
API key: your DeepSeek-compatible API key
```

Click the connection test button. A successful production test returns:

```text
POST /api/ai/test -> {"ok":true}
```

Security behavior:

- The full API key is never returned by the API.
- The key is encrypted before D1 persistence.
- The Settings API returns only a masked key, for example `sk-...last4`.

## Build And Deploy

Build the frontend:

```bash
npm run build
```

Deploy the Worker and assets:

```bash
npm run worker:deploy
```

The deployment uploads:

- `dist/index.html`
- `dist/assets/*.js`
- `dist/assets/*.css`
- Worker code from `worker/index.ts`

Recent successful deployment output included:

```text
Uploaded memotask
Deployed memotask triggers
  https://memotask.<account-subdomain>.workers.dev
  memotask.rrwks.cn (custom domain)
Current Version ID: <masked-worker-version-id>
```

## Custom Domain Setup

The current domain is:

```text
rrwks.cn
```

The configured app hostname is:

```text
memotask.rrwks.cn
```

DNS hostnames are case-insensitive, so `MemoTask.rrwks.cn` and `memotask.rrwks.cn` resolve to the same host. The canonical lowercase form is used in config.

To configure a custom domain:

1. Add the domain to Cloudflare DNS or transfer/manage the domain in Cloudflare.
2. Ensure the zone is active.
3. Add the Worker custom domain route in `wrangler.toml`.
4. Deploy with `npm run worker:deploy`.
5. Verify HTTPS and API responses.

Verification commands:

```bash
curl -I https://memotask.rrwks.cn/memos
curl https://memotask.rrwks.cn/api/health
```

Expected:

```text
HTTP/1.1 200 OK
{"ok":true}
```

You can also confirm that production HTML references the latest bundle:

```bash
curl -s https://memotask.rrwks.cn/memos
```

Look for the current `/assets/index-*.js` and `/assets/index-*.css` files.

## Application Auth And Cloudflare Access

MemoTask V2 includes its own application-level account system. Users register with email/password, verify email, log in, log out, and reset passwords by email token. The Worker stores sessions in D1 and sets an HttpOnly `memotask_session` cookie.

Cloudflare Access is still optional as an outer gate.

Two workable modes:

1. Public Worker URL and public custom domain, protected by MemoTask V2 auth.
2. Cloudflare Access protected app plus MemoTask V2 auth for an additional Cloudflare login step.

The current production custom domain is public for easier cross-device testing. An Access application and owner-only policy were configured earlier for the `workers.dev` URL, but enforcement was later disabled while testing mobile access.

Recommended V2 decision:

- Keep public only while testing if preview data is not sensitive.
- Before sharing widely, confirm email delivery works and decide whether Cloudflare Access is also needed.
- If using Access, configure a policy such as `Include -> Emails -> your-email@example.com`.

Basic Access setup:

1. Open Cloudflare Dashboard.
2. Go to Zero Trust.
3. Confirm the Free plan is active.
4. Go to Access -> Applications.
5. Add an application for the Worker/custom domain hostname.
6. Add an Allow policy.
7. Include the owner email or a reusable rule group.
8. Test in a private browser window.

Expected restricted behavior:

```text
Unauthenticated request -> 302 redirect to <team-name>.cloudflareaccess.com
Authenticated owner email -> MemoTask loads normally
```

If phone browsers fail to open the app after Access is enabled, first check whether the phone browser can complete Cloudflare Access one-time PIN login.

## Verification Checklist

Run these before saying a deployment is ready:

```bash
npm test
npm run build
npx playwright test tests/e2e/visual-qa.spec.ts --project=android
npx playwright test tests/e2e/visual-qa.spec.ts --project=pc
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/memos
```

Latest verified local checks after UI polish:

```text
npm test -> 13 files, 57 tests passed
npm run build -> passed
Android visual QA -> 6 passed
PC visual QA -> 5 passed, 1 Android-only check skipped
```

Latest production checks:

```text
GET https://memotask.rrwks.cn/api/health -> {"ok":true}
GET https://memotask.rrwks.cn/memos -> 200 OK
Production HTML references /assets/index-C0wqRxWN.js and /assets/index-C_BKT7Az.css
Android Chrome screenshot loaded the Chinese MemoTask queue UI
```

## Troubleshooting

### `/api/*` returns HTML

Check `wrangler.toml`:

```toml
run_worker_first = ["/api/*"]
```

Without this, asset routing can intercept API requests.

### Direct route refresh returns 404

Check:

```toml
not_found_handling = "single-page-application"
```

This lets `/memos`, `/history`, and `/settings` resolve to the React app.

### AI settings fail to save

Confirm `APP_ENCRYPTION_KEY` is set:

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
```

Then redeploy:

```bash
npm run worker:deploy
```

### AI test fails

Check:

- Base URL has no typo.
- Model ID is supported by the provider.
- API key is active.
- Provider supports an OpenAI-compatible `/chat/completions` endpoint.

Current known-good DeepSeek values:

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-pro
```

### Registration or password reset email fails

Confirm email settings are present:

```bash
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put APP_BASE_URL
```

Then redeploy:

```bash
npm run worker:deploy
```

### D1 binding missing at runtime

Check:

```toml
[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "<your-d1-database-id>"
```

The Worker expects `env.DB`.

### Custom domain does not load

Check:

1. The domain is active in Cloudflare.
2. The Worker route uses the exact hostname.
3. The latest deployment completed successfully.
4. `curl -I https://<hostname>/memos` returns `200 OK`.
5. DNS resolves to Cloudflare.

### Cloudflare Access blocks mobile access

For V2 testing, set the Worker/custom domain access mode to Public and rely on MemoTask login. For long-term use, decide between:

- Cloudflare Access with email one-time PIN or identity provider login.
- MemoTask app-level authentication only.

## Public Sharing Before GitHub Upload

Before pushing to GitHub:

1. Do not commit `.dev.vars`, `.env`, `dist/`, `.wrangler/`, `output/`, `test-results/`, or Playwright reports.
2. Search docs and code for real API keys.
3. Keep only masked key examples in docs.
4. Decide whether `memotask.rrwks.cn` should stay public.
5. If the repo is public, avoid committing personal Cloudflare dashboard URLs, account IDs, policy IDs, or private screenshots.
