# Quick Record Design

Date: 2026-06-28

## Goal

Make MemoTask faster to capture a raw Memo without adding a new backend concept or a separate capture page.

## Scope

Add a lightweight frontend quick-record experience on top of the existing workspace input:

- `Ctrl/Cmd + K` focuses the record textarea and switches to the workspace when the user is signed in.
- `Ctrl/Cmd + Enter` publishes the current textarea content.
- `Ctrl/Cmd + Shift + Enter` runs AI organize for the current textarea content.
- The existing buttons remain the visible primary controls.
- Mobile users keep using the existing buttons; keyboard shortcuts are desktop-oriented enhancements.

Add a desktop-only tray hide control:

- Electron exposes a safe `window.memotaskDesktop.hideToTray()` API through preload and IPC.
- The React UI shows a rail icon button only when that API exists.
- Browser, Android, and other shells without that API do not show the button.
- The button hides the current native window and keeps MemoTask available from the Windows notification-area tray icon.
- The tray menu can show the window again or quit the app.

## Non-Goals

- No backend schema or API changes.
- No floating capture window.
- No dates, reminders, priorities, standalone categories, or project-management concepts.
- No automatic parsing of plain lines into structured Todo in this iteration.
- No background sync or tray notifications in this iteration.

## Architecture

The current `App.tsx` owns view state, draft state, publish behavior, and AI organize behavior. The quick-record feature should stay there and pass a textarea ref plus keyboard handler into `WorkspaceView`.

A small UI helper should identify supported shortcut combinations so the behavior can be unit tested without rendering React. The app-level handler should:

1. Ignore shortcuts when the user is not signed in.
2. Use `Ctrl` on Windows/Linux and `Meta` on macOS.
3. Let normal `Enter` keep inserting line breaks.
4. Prevent default only for handled shortcuts.

Electron should keep `contextIsolation`, `nodeIntegration: false`, and `sandbox: true`. A preload script should expose only the tray hide method and should send a single IPC message to the main process. The main process should hide the `BrowserWindow` associated with the sender and create a single tray icon with show and quit actions.

## UI

The capture panel remains compact and Memos-like. Do not add visible shortcut instructions to the panel; the feature should make existing controls faster without turning the UI into a help surface.

## Error Handling

Publishing or organizing an empty draft should keep the current `请输入 Memo 内容` behavior. Shortcut-triggered actions call the same handlers as the buttons, so no separate error path is needed.

## Testing

Add unit coverage for shortcut classification:

- `Ctrl+K` and `Meta+K` map to focus.
- `Ctrl+Enter` and `Meta+Enter` map to publish.
- `Ctrl+Shift+Enter` and `Meta+Shift+Enter` map to analyze.
- Plain `Enter`, unrelated keys, and modifier-free `K` do nothing.

Run the existing test suite and production build after implementation.

Add Electron packaging coverage that verifies:

- `electron/main.cjs` wires a preload script.
- `electron/main.cjs` registers a tray hide IPC handler.
- `electron/main.cjs` creates a `Tray` and menu.
- `electron/preload.cjs` exposes `memotaskDesktop.hideToTray`.
