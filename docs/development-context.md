# MemoTask V1 Development Context

Created: 2026-06-22

This document records the user-approved development context before starting the long-running V1 implementation goal. It is intended to survive context compaction and should be treated as the current local handoff note.

## Source Of Truth

Use `docs/memotask-v1-employee-task-plan.md` as the primary product and engineering source of truth.

If it conflicts with earlier planning documents, follow `docs/memotask-v1-employee-task-plan.md`.

Supporting files:

- `docs/v1-implementation-task-plan.md`
- `docs/readable-design-plan.md`
- `docs/project-plan.md`
- `docs/ui-mockups/`

## User Decisions

The user confirmed:

1. Scope is the complete V1 flow, not a single phase: Phase 0 through Phase 5 from the employee task plan.
2. Creating a Git repository in `G:\Code\MemoTask` is allowed.
3. Package manager and project tooling are left to Codex judgment.
4. Cloudflare setup should be guided step by step, or automated through the user's browser/computer where safe.
5. AI model should be `dsv4-pro`.
6. UI language should be Chinese from the start.
7. Missing UI state designs should be inferred from the existing visual system.
8. Cloudflare account operations are allowed when they are needed for the project. Ask for confirmation before any paid operation, including buying a domain, changing to a paid plan, enabling a paid resource, or taking an action that may create billing.

## Credential Handling

The user supplied an AI API key in chat for later configuration.

Do not write the full API key into repo files, documentation, committed code, screenshots, or logs.

Use only masked form in documents:

```text
sk-...b456
```

For local development, store secrets outside committed files, preferably:

- `.dev.vars`, ignored by Git
- `wrangler secret put`
- Cloudflare dashboard secret UI

Required secrets:

- `AI_API_KEY` or user-configured encrypted value through app Settings
- `APP_ENCRYPTION_KEY` for Worker-side encryption of stored AI API keys

## Recommended Technical Direction

Use a React + TypeScript + Vite frontend and Cloudflare Workers backend.

The app should be deployable to Cloudflare with:

- Cloudflare Workers for API routes
- Cloudflare D1 for persistent data
- Cloudflare Access for protecting the app
- Cloudflare Pages or Workers static asset serving for the frontend, depending on the final scaffold that gives the cleanest local and deployment workflow

Prefer a modern Cloudflare/Vite-compatible structure over a split setup if it keeps local development and deployment simpler.

## Cloudflare Current State

The user is logged into Cloudflare Dashboard in Chrome.

Detailed Cloudflare setup notes are recorded in `docs/cloudflare-setup.md`.

Observed account:

```text
956039339@qq.com's Account
```

Observed account URL prefix:

```text
https://dash.cloudflare.com/30f2292f8bb323d4a658c7d1f09bd301
```

Observed Dashboard state:

- Domains overview is accessible.
- Workers and Pages navigation is visible.
- D1 SQLite database navigation is visible.
- D1 database `memotask-db` has been created.
- D1 database id is `3c84d13d-803f-41d3-ab97-292ba1500708`.
- Zero Trust is active on the Free plan.
- Zero Trust team name is `frosty-resonance-2e7a`.
- Access default one-time PIN email login is acceptable for V1 unless the user requests another identity provider.
- Access rule group `MemoTask owner only` has been created.
- Access rule group id is `322c66a6-ca17-43b0-a394-c4d1e43e5a01`.
- Access rule group condition is `Include` / `Emails` / `956039339@qq.com`.
- Access application has not been created because no deployed app URL, Worker target, or Pages project exists yet.
- No domain is currently visible in Domains overview; the page showed "未找到域或子域" at the time of inspection.
- Cloudflare displays an "Agent Lee" prompt asking to create a read-only API token. This is not needed for MemoTask development unless the user explicitly wants to grant that integration.

Zero Trust free plan selection was started by Codex but stopped at a checkout/payment URL. The user manually completed activation afterward.

## Cloudflare Resources To Create

Suggested names:

- Project/app name: `memotask`
- Worker name: `memotask-api` or unified `memotask`
- D1 database name: `memotask-db`
- Pages project name if using Pages: `memotask`
- Production domain: to be decided by user

Required Cloudflare resources:

1. D1 database. Completed: `memotask-db`.
2. Zero Trust Free. Completed by the user.
3. Access owner-only rule group. Completed: `MemoTask owner only`.
4. Worker or Pages project with API route support. Pending until code scaffold/deploy.
5. D1 binding in `wrangler.toml`. Pending until scaffold.
6. `APP_ENCRYPTION_KEY` secret. Pending until Worker exists.
7. Cloudflare Access application protecting the production app. Pending until a final app URL exists.

Potential blocker:

- If the user wants Cloudflare Access on a clean production URL, a custom domain connected to Cloudflare is strongly preferred.
- If no domain is available, development and preview can still proceed locally and with Cloudflare preview URLs, but final Access setup may need a custom domain or a supported Pages/Workers Access path.

## Cloudflare Setup Plan

Do this after the app scaffold exists and local scripts are ready.

1. Create or confirm D1 database.
   - Preferred CLI path after Wrangler login:
     `wrangler d1 create memotask-db`
   - Record generated database id in `wrangler.toml`.

2. Configure D1 migrations.
   - Keep migrations under a project `migrations/` directory.
   - Use Wrangler D1 migration commands for local and remote execution.

3. Configure Worker secrets.
   - Generate a strong `APP_ENCRYPTION_KEY`.
   - Store it with `wrangler secret put APP_ENCRYPTION_KEY`.
   - Do not commit secret values.

4. Deploy preview.
   - Use the chosen Cloudflare deploy command.
   - Verify `/api/health`.
   - Verify frontend loads.

5. Configure Cloudflare Access.
   - Protect the production app URL.
   - Attach the existing `MemoTask owner only` Access rule group unless the user requests a different policy.
   - The user permits Cloudflare operations, but ask before any paid or potentially billable action.

6. Smoke test.
   - Access-protected app prompts for Cloudflare authentication.
   - Authenticated user can load the app.
   - `/api/health` succeeds.
   - D1-backed endpoints work.

## UI And Product Constraints

The implementation must stay inside V1:

- No date system.
- No Today or Upcoming.
- No reminders or notifications.
- No tags.
- No independent search page.
- No payment, membership, subscription, or upgrade entry.
- No self-built login page in V1.
- No AI regeneration after publish.
- No AI date assignment.
- No AI memo sorting.

Chinese UI is required.

Use existing UI mockups as visual baseline:

- Android: Memos, Capture, Memo Detail, History, Settings
- PC: Memos, Capture, History

Missing states should be inferred with the same Soft Clay Neumorphism style:

- Memos empty state
- Capture AI loading
- Capture AI failed
- History empty state
- History no search results
- History undo toast
- Settings test success
- Settings test failed

## Goal Recommendation

Create a long-running goal for:

```text
Implement MemoTask V1 end to end from Phase 0 through Phase 5 according to docs/memotask-v1-employee-task-plan.md, using Chinese UI, the provided UI mockups, Cloudflare Workers/D1/Access, model dsv4-pro, and safe secret handling.
```

Expected execution style:

- Initialize Git.
- Build in phases.
- Verify each phase before moving to the next.
- Keep changes surgical and consistent with the plan.
- Use tests and browser QA before claiming completion.
- Document Cloudflare manual/automated setup steps as they are completed.
