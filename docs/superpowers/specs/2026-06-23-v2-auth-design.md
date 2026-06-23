# MemoTask V2 Auth Design

## Goal

MemoTask V2 adds public account management so anyone can register with an email address, verify the email, sign in, recover a forgotten password, and use MemoTask with data isolated from other users. V2 also creates a clean Git history: V1 is preserved as a rollback baseline, and V2 work lives on `codex/v2-auth`.

## Scope

V2 includes:

- Email/password registration for public users.
- Email verification before entering the main app.
- Login and logout.
- Password reset by email token.
- HttpOnly session cookies.
- Per-user Memo, draft, history, AI settings, export, and sync status isolation.
- D1 schema migrations for auth tables and user-scoped settings/session data.
- Tests for auth behavior, user isolation, UI gating, and regression coverage.
- Documentation updates that mark the account system as V2.
- Git commits split by coherent implementation slices so GitHub upload and rollback are straightforward.

V2 does not include OAuth, teams, roles, admin dashboards, billing, public profile pages, tags, reminders, or date/month map features.

## Current Context

The V1 codebase already stores `user_id` on `memos` and `ai_settings`, but repository methods hard-code `"default"`. The Worker API does not currently authenticate requests. The frontend assumes the app is always available and renders the existing pages directly. V2 should keep the current MemoTask product loop and visual system, then add auth as a boundary around it.

## Architecture

The Worker owns authentication. It exposes `/api/auth/*` endpoints, stores users and sessions in D1, and sets an HttpOnly cookie named `memotask_session`. The API resolves the session on every protected request and passes the authenticated `userId` into repository methods. Repository queries must filter by `user_id`, and write operations must reject records that do not belong to the current user.

The React app asks `/api/auth/me` on startup. If there is no valid session, it renders the auth flow. If the account exists but is unverified, it renders a verification-required view. After login or verification, it loads the existing MemoTask shell.

## Data Model

Add migration `migrations/0002_auth.sql`:

- `users`: `id`, `email`, `password_hash`, `email_verified_at`, `created_at`, `updated_at`.
- `sessions`: `id`, `user_id`, `token_hash`, `expires_at`, `created_at`, `last_seen_at`.
- `email_verification_tokens`: `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`.
- `password_reset_tokens`: `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`.

Add indexes for email lookup, session token lookup, token expiry cleanup, and user foreign-key lookups.

Existing V1 records with `user_id = 'default'` remain readable only if assigned to a real user by a migration or manual SQL. V2 implementation will not expose default-user data to newly registered accounts. For a public deployment, the recommended migration is to create the owner's account first and update existing `memos`, `ai_settings`, and `sync_meta` rows to that user's ID before opening registration.

## Auth API

Add:

- `POST /api/auth/register`: creates a user, stores a password hash, creates an email verification token, sends email, returns safe user state.
- `POST /api/auth/login`: verifies email/password, creates a session cookie, returns safe user state.
- `POST /api/auth/logout`: deletes the current session and clears the cookie.
- `GET /api/auth/me`: returns current user or `401`.
- `POST /api/auth/verify-email`: accepts a token, marks the email verified, and creates or refreshes a session.
- `POST /api/auth/resend-verification`: creates a fresh verification token for the current unverified user or email.
- `POST /api/auth/forgot-password`: accepts an email and always returns a generic success response.
- `POST /api/auth/reset-password`: accepts reset token and new password, updates password, invalidates existing sessions, and sets a fresh session.

Protected non-auth APIs return `401` when no session exists and `403` when the user exists but is not email-verified.

## Passwords And Tokens

Use Web Crypto APIs available in Workers. Passwords are hashed with PBKDF2-SHA-256 using a per-password random salt and at least 210,000 iterations. Store a versioned string so the format can evolve.

Verification, reset, and session tokens are random 32-byte values. Only SHA-256 hashes of tokens are stored. Token lifetimes:

- Session: 30 days.
- Email verification: 24 hours.
- Password reset: 30 minutes.

## Email Delivery

Introduce an `EmailSender` interface used by the Worker auth service. Production sends through a configured HTTP email provider, with Resend as the first supported shape:

- `EMAIL_API_KEY`
- `EMAIL_FROM`
- `APP_BASE_URL`

Tests use a fake sender that records outgoing links. If email configuration is missing in production, register/forgot-password should fail with a clear server configuration error rather than pretending an email was sent.

## Frontend Flow

Add a compact auth surface that matches the existing Soft Clay visual system:

- Login form.
- Register form.
- Forgot password form.
- Reset password form for `/reset-password?token=...`.
- Email verification result for `/verify-email?token=...`.
- Unverified-account view with resend button.
- Logout control in the app shell.

The main app should not load Memos before auth state is known. After login, registration verification, or password reset, navigation returns to `/memos`.

## User Data Isolation

All repository methods that read or write user-owned data accept `userId`. Query filters include `user_id = ?` where applicable. Direct object operations such as finding a Memo by ID must verify ownership before returning or mutating. Todo operations must verify ownership through their parent Memo.

AI settings become per-user by using `ai_settings.id = userId` and `ai_settings.user_id = userId`. Sync status becomes per-user by using `sync_meta.id = userId`.

## Version Management

Current V1 state is committed on branch `codex/memotask-v1` as `chore: establish v1 baseline`. V2 work happens on branch `codex/v2-auth`. Commits should be small and readable:

1. `docs: add v2 auth design`
2. `feat: add auth schema and services`
3. `feat: protect api with user sessions`
4. `feat: isolate memo data by user`
5. `feat: add auth UI flows`
6. `docs: document v2 auth release`

Before a final GitHub push, run secret scans for real API keys and Cloudflare IDs, then run `npm test` and `npm run build`.

## Testing

Backend tests:

- Registration creates an unverified user and sends verification email.
- Duplicate email registration fails without leaking sensitive detail.
- Login rejects wrong password and unverified users appropriately.
- Email verification marks user verified and allows app access.
- Forgot/reset password works with valid tokens, rejects expired or reused tokens, and invalidates old sessions.
- Protected APIs reject unauthenticated requests.
- Two users cannot see, mutate, reorder, archive, delete, restore, export, or configure each other's Memo data.

Frontend tests:

- Unauthenticated users see auth UI instead of Memo pages.
- Register, verify, login, logout, forgot password, and reset password flows render correct states.
- Logged-in verified users see the existing MemoTask pages.
- Unverified users see the verification-required state.

Verification commands:

```bash
npm test
npm run build
```

## Acceptance Criteria

V2 is complete when:

- A new public user can register, verify email, log in, log out, recover password, and return to the app.
- Existing MemoTask functionality works after login.
- Memo, draft, history, AI settings, sync status, and export data are isolated by authenticated user.
- Unauthenticated or unverified requests cannot access protected data.
- V2 schema migrations are present and documented.
- Git has a V1 baseline and coherent V2 commits on `codex/v2-auth`.
- `npm test` and `npm run build` pass.
