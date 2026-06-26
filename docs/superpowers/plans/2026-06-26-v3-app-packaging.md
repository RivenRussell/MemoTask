# MemoTask v3 App Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MemoTask v3 as installable Windows and Android apps that preserve all v2 web capabilities in phase 1, then add PC and Android recording conveniences in phase 2 without regressions.

**Architecture:** Keep the existing React/Vite frontend and Cloudflare Worker/D1 backend. Desktop and Android apps bundle the built React assets locally and call the production Worker API at `https://memotask.rrwks.cn/api/*`; the deployed web app continues to call same-origin `/api/*`.

**Tech Stack:** React 19, TypeScript, Vite, Hono, Cloudflare Worker/D1, Electron, electron-builder, Capacitor Android, Vitest, Testing Library, Playwright.

## Global Constraints

- Version target is v3.
- Phase 1 must inherit all existing v2 web capabilities without adding new product behavior.
- Phase 1 PC app must be a Windows `.exe` installer that bundles the React build output locally.
- Phase 1 Android app must produce a sideloadable APK only; no app-store/AAB flow is required.
- All app builds must keep using the existing Cloudflare Worker and D1 backend.
- The deployed web build must continue to work as before.
- Do not rewrite the app as native desktop or native Android.
- Prefer Electron for PC packaging unless a blocking issue is discovered.
- Use Capacitor for Android packaging.
- Add phase 2 PC and Android convenience features after phase 1 is verified.
- Do not add speculative features beyond the requested app packaging and recording convenience scope.
- Use frontend construction/design skills if new frontend UI screens or significant UI changes are needed.
- Run verification before claiming any phase or feature is complete.

---

## File Structure

- Modify `package.json`: add v3 version, desktop/android scripts, dependencies, and release metadata.
- Modify `package-lock.json`: lock added dependencies.
- Modify `vite.config.ts`: support app builds with relative assets and explicit API base environment.
- Modify `.env.example`: document `VITE_API_BASE_URL`.
- Modify `src/api/client.ts`: resolve API paths through a tested base URL helper.
- Create or modify `tests/api/client.test.ts`: cover same-origin and app API URL resolution.
- Create `electron/main.cjs`: Electron main process, app window, tray, shortcuts, and IPC for phase 2.
- Create `electron/preload.cjs`: safe bridge for phase 2 native app capabilities.
- Create `electron/assets/`: desktop icon sources if needed.
- Create `capacitor.config.ts`: Android app shell config.
- Create `android/`: generated Capacitor Android project.
- Modify `README.md`: document v3 desktop/APK build and verification workflow.
- Modify `docs/version-history.md`: document v3 changes and rollback notes.
- Create `tests/electron/`: Playwright or smoke tests for local desktop bundle where feasible.
- Create `src/native/`: shared frontend adapter for desktop/android native conveniences.
- Create `src/components/QuickCapture*` or focused page/component files only if phase 2 UI needs them.

## Task 1: API Base URL Support

**Files:**
- Modify: `src/api/client.ts`
- Modify: `tests/api/client.test.ts`
- Modify: `.env.example`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `resolveApiUrl(path: string, baseUrl?: string): string`
- Produces: `ApiClient` constructor option `{ apiBaseUrl?: string }`
- Consumes later: Electron and Capacitor builds set `VITE_API_BASE_URL=https://memotask.rrwks.cn`

- [ ] Write failing tests proving `/api/auth/me` stays relative when no API base is configured.
- [ ] Write failing tests proving `/api/auth/me` resolves to `https://memotask.rrwks.cn/api/auth/me` when the app base is `https://memotask.rrwks.cn`.
- [ ] Write failing tests proving trailing slashes do not produce double slashes.
- [ ] Implement `resolveApiUrl` and wire `ApiClient.request` through it.
- [ ] Keep `credentials: "include"` unchanged.
- [ ] Run `npm run test:api -- tests/api/client.test.ts`.
- [ ] Run `npm test`.

## Task 2: Worker CORS and App Session Compatibility

**Files:**
- Modify: `worker/index.ts` or `worker/api.ts`
- Modify: relevant `tests/api/*.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: Worker support for configured desktop/android app origins only if cross-origin browser security requires it.
- Consumes: App shells making credentialed requests to production Worker.

- [ ] Inspect current Worker response behavior for OPTIONS and credentials.
- [ ] Add failing tests for required CORS preflight behavior only if Electron/Capacitor local origins require cross-origin calls.
- [ ] Implement the smallest Worker CORS/session adjustment that preserves web security.
- [ ] Run targeted API tests.
- [ ] Run `npm test`.

## Task 3: Electron Desktop App Shell

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`
- Create: `electron/assets/`

**Interfaces:**
- Produces scripts: `desktop:dev`, `desktop:build`, `desktop:pack`
- Produces package artifact: Windows NSIS `.exe` installer.

- [ ] Add Electron and electron-builder dependencies.
- [ ] Add a minimal main process that loads `dist/index.html`.
- [ ] Ensure `contextIsolation: true`, `nodeIntegration: false`, and a narrow preload bridge.
- [ ] Open external links in the system browser.
- [ ] Configure app name, product name, app id, icon path, and NSIS installer target.
- [ ] Run `npm run build`.
- [ ] Run desktop smoke startup.
- [ ] Run `npm run desktop:build` and verify `.exe` output exists.

## Task 4: Android Capacitor APK

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `capacitor.config.ts`
- Create: `android/`

**Interfaces:**
- Produces scripts: `android:sync`, `android:apk`
- Produces package artifact: sideloadable APK.

- [ ] Add Capacitor dependencies.
- [ ] Configure app id, app name, web directory, and Android settings.
- [ ] Run `npm run build` before sync.
- [ ] Run `npx cap add android` if the Android project does not exist.
- [ ] Run `npm run android:sync`.
- [ ] Build release APK for sideloading.
- [ ] Verify APK path exists.

## Task 5: Phase 1 Regression Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/version-history.md`
- Create: optional `docs/v3-release-checklist.md`

**Interfaces:**
- Produces: Phase 1 verification checklist and build instructions.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run desktop packaging command.
- [ ] Run Android APK packaging command.
- [ ] Smoke test desktop app login flow if credentials/test environment are available.
- [ ] Smoke test Android APK on emulator or document the exact blocker if no Android runtime is available.
- [ ] Confirm the original web deployment build path still compiles.
- [ ] Document known verification evidence and any environment-dependent checks.

## Task 6: Phase 2 Native Capability Bridge

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Create: `src/native/native-bridge.ts`
- Create: relevant tests under `tests/ui/` or `tests/api/`

**Interfaces:**
- Produces: `nativeBridge` methods for quick capture, notifications, platform detection, startup preference, and app shell commands.

- [ ] Write tests for web fallback behavior when no native bridge exists.
- [ ] Implement a safe frontend adapter that never breaks web mode.
- [ ] Add Electron IPC channels for supported native actions.
- [ ] Run targeted tests.
- [ ] Run `npm test`.

## Task 7: PC Recording Convenience Features

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify or create focused React components for quick capture UI.
- Modify: `src/state/app-state.ts` only if shared capture behavior needs extraction.

**Interfaces:**
- Produces: tray menu, quick capture window, global shortcut, desktop notification, optional startup setting.

- [ ] Add tray with menu items: open MemoTask, quick capture, sync/status, quit.
- [ ] Add quick capture window that uses existing authenticated API behavior.
- [ ] Add configurable global shortcut, defaulting to `Ctrl+Alt+M`.
- [ ] Add desktop notifications for successful capture and failed capture.
- [ ] Add startup setting only if the OS integration can be safely toggled by the user.
- [ ] Verify closing the main window does not lose data.
- [ ] Run desktop smoke tests and `npm test`.

## Task 8: Android Recording Convenience Features

**Files:**
- Modify: `capacitor.config.ts`
- Modify: Android project files required by Capacitor plugins.
- Modify or create shared frontend quick capture components.

**Interfaces:**
- Produces: Android share target, launcher shortcut if feasible, notifications, back-button handling, offline draft fallback.

- [ ] Add Android share intent handling for text and URLs.
- [ ] Route shared content into the same quick capture flow used by PC.
- [ ] Add Android back-button behavior: detail to list, capture to prior page, root exits/minimizes according to Android convention.
- [ ] Add local notification hooks for capture success/failure if plugin support is stable.
- [ ] Add offline draft fallback that stores unsent capture text locally and prompts sync when online.
- [ ] Build and verify APK.

## Task 9: v3 Release Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/version-history.md`
- Modify: optional release checklist/doc files.

**Interfaces:**
- Produces: user-facing instructions for Windows installer, Android APK, and v3 feature set.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run desktop installer build.
- [ ] Run Android APK build.
- [ ] Run Playwright e2e where local server requirements can be satisfied.
- [ ] Verify artifacts exist and record their paths.
- [ ] Audit phase 1 and phase 2 requirements line by line.
- [ ] Update version references to v3.
- [ ] Prepare final release notes.

## Self-Review

- Spec coverage: The plan covers phase 1 Windows installer, phase 1 APK, original web capability preservation, phase 2 PC enhancements, phase 2 Android enhancements, version v3, and verification gates.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The API helper and constructor option names are consistent across tasks.
