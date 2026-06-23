# MemoTask V1 Development Context

Created: 2026-06-22
Updated: 2026-06-23

This document records the implementation context for MemoTask V1. It is safe to keep in the repository and avoids private Cloudflare account identifiers, dashboard URLs, and full secrets.

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

## Technical Direction

MemoTask uses:

- React + TypeScript + Vite for the frontend.
- Hono inside Cloudflare Workers for API routes.
- Cloudflare Workers Assets for static files.
- Cloudflare D1 for persistence.
- Cloudflare Access as an optional deployment-level protection layer.
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
https://memotask.rrwks.cn/memos
```

Current Cloudflare resources:

```text
Worker name: memotask
D1 database name: memotask-db
D1 binding: DB
Custom domain: memotask.rrwks.cn
Worker secret: APP_ENCRYPTION_KEY
```

Cloudflare Access:

- Zero Trust Free has been used during setup.
- An owner-only Access policy was tested earlier.
- Current production custom domain is public for cross-device testing.
- Before broad sharing, either re-enable Cloudflare Access or add application-level auth in V2.

## Latest Verified Deployment

UI polish deployment:

```text
Date: 2026-06-23
Worker version ID: 2dd6e63e-27c9-4a09-94a3-64e7b9b31555
Production JS bundle: /assets/index-C0wqRxWN.js
Production CSS bundle: /assets/index-C_BKT7Az.css
```

Verification:

```text
npm test -> 13 files, 57 tests passed
npm run build -> passed
Android visual QA -> 6 passed
PC visual QA -> 5 passed, 1 Android-only check skipped
GET https://memotask.rrwks.cn/api/health -> {"ok":true}
GET https://memotask.rrwks.cn/memos -> 200 OK
```

UI changes in the latest deployment:

- Mobile Memo detail page now opens at the top and prioritizes Todo management.
- Memo cards show a hidden Todo count when more than three Todo items exist.
- Empty queue state is simplified.
- History Todo visual checkboxes no longer stretch wider than normal.

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
worker/domain/state-machines.ts
worker/repository/d1-repository.ts
worker/repository/memory-repository.ts
worker/repository/types.ts
```

Database migration:

```text
migrations/0001_initial.sql
```

The repository uses a `MemoryRepository` for tests and a `D1Repository` for production.

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
curl -I https://memotask.rrwks.cn/memos
curl -s https://memotask.rrwks.cn/memos
```

The final command should show the latest `/assets/index-*.js` and `/assets/index-*.css` references.

## Remaining Product Decisions

Before public use:

1. Decide whether `memotask.rrwks.cn` remains public.
2. Choose Cloudflare Access or application-level auth for V2.
3. Decide whether preview URLs should remain public.
4. Consider whether AI settings should become per-user after auth exists.

## GitHub Upload Checklist

Before pushing:

1. Confirm `.dev.vars`, `.env`, `dist/`, `.wrangler/`, `output/`, and `test-results/` are not staged.
2. Search for full API keys and private Cloudflare IDs.
3. Keep only masked or placeholder secrets in docs.
4. Review `README.md` and `docs/cloudflare-setup.md` as the public entry points.
