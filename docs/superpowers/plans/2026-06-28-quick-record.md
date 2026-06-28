# Quick Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard-friendly quick recording to the existing MemoTask workspace and a desktop-only hide-to-tray control.

**Architecture:** Keep quick record in the current React app state flow. Add a pure shortcut classifier in `src/ui-helpers.ts`, unit test it, then wire `App.tsx` to focus the existing capture textarea and trigger existing publish/AI handlers. For tray hiding, expose a tiny Electron preload API and show a rail icon button only when the API exists.

**Tech Stack:** React 19, TypeScript, Vite, Vitest.

## Global Constraints

- Do not change backend APIs or database schema.
- Do not add a separate capture page or floating window.
- Do not add dates, reminders, priorities, standalone categories, or project-management concepts.
- Do not add background sync or tray notifications.
- Preserve normal Enter line breaks in the textarea.
- Use existing button handlers for publish and AI organize.
- Preserve Electron `contextIsolation`, `nodeIntegration: false`, and `sandbox: true`.

---

### Task 1: Shortcut Classifier

**Files:**
- Modify: `src/ui-helpers.ts`
- Modify: `tests/ui-helpers.test.ts`

**Interfaces:**
- Produces: `type QuickRecordShortcut = "focus" | "publish" | "analyze" | null`
- Produces: `getQuickRecordShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey?: boolean }): QuickRecordShortcut`

- [ ] **Step 1: Write the failing test**

Add expectations in `tests/ui-helpers.test.ts`:

```ts
expect(getQuickRecordShortcut({ key: "k", ctrlKey: true, metaKey: false, shiftKey: false })).toBe("focus");
expect(getQuickRecordShortcut({ key: "K", ctrlKey: false, metaKey: true, shiftKey: false })).toBe("focus");
expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: true, metaKey: false, shiftKey: false })).toBe("publish");
expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: false, metaKey: true, shiftKey: false })).toBe("publish");
expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: true, metaKey: false, shiftKey: true })).toBe("analyze");
expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: false, metaKey: true, shiftKey: true })).toBe("analyze");
expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
expect(getQuickRecordShortcut({ key: "k", ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
expect(getQuickRecordShortcut({ key: "x", ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui-helpers.test.ts`

Expected: FAIL because `getQuickRecordShortcut` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add the type and function to `src/ui-helpers.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui-helpers.test.ts`

Expected: PASS.

### Task 2: React Wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getQuickRecordShortcut`
- Uses existing `handlePublishDraft` and `handleAnalyzeDraft`.

- [ ] **Step 1: Add a textarea ref and global keydown handler**

Use `useRef` and `useEffect` in `App.tsx`. On `"focus"`, switch to workspace and focus the textarea on the next frame. On `"publish"` and `"analyze"`, call the existing handlers.

- [ ] **Step 2: Pass the ref and textarea keydown handler to `WorkspaceView`**

The textarea should also handle `Ctrl/Cmd + Enter` and `Ctrl/Cmd + Shift + Enter` while focused. Plain Enter remains untouched.

- [ ] **Step 3: Keep visible UI unchanged**

Do not add visible shortcut instructions. The existing `AI 整理` and `发布` buttons remain the visible controls.

### Task 3: Verification

**Files:**
- No production edits expected.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/ui-helpers.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Run rendered smoke check**

Start the dev server with `npm run dev` and verify the app loads without a framework error overlay. If the login screen blocks authenticated workspace testing, record that limitation and rely on unit/build evidence for shortcut classification and compile-time wiring.

### Task 4: Electron Hide To Tray

**Files:**
- Create: `electron/preload.cjs`
- Modify: `electron/main.cjs`
- Modify: `tests/electron-packaging.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/ui-icons.tsx`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces: `window.memotaskDesktop.hideToTray(): Promise<void>`
- Consumes: `window.memotaskDesktop?.hideToTray` in React.

- [ ] **Step 1: Write the failing Electron contract test**

Add expectations that `electron/main.cjs` contains `preload`, `ipcMain.handle`, `memotask:hide-to-tray`, `Tray`, and `Menu.buildFromTemplate`, and that `electron/preload.cjs` contains `contextBridge.exposeInMainWorld`, `memotaskDesktop`, and `hideToTray`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/electron-packaging.test.ts`

Expected: FAIL because `electron/preload.cjs` does not exist and the IPC handler is missing.

- [ ] **Step 3: Add Electron preload, IPC, and tray behavior**

Create `electron/preload.cjs` with a context bridge method that invokes `memotask:hide-to-tray`. Update `electron/main.cjs` to register the handler, set `webPreferences.preload`, create one `Tray`, hide the sender window, and provide tray menu actions to show or quit.

- [ ] **Step 4: Add desktop-only React control**

Type `window.memotaskDesktop` in `src/vite-env.d.ts`. In `App.tsx`, pass `canHideToTray` and `onHideToTray` to `DesktopRail`; render an icon-only button only when available.

- [ ] **Step 5: Run Electron contract test**

Run: `npm test -- tests/electron-packaging.test.ts`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- No production edits expected.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/ui-helpers.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Run rendered smoke check**

Start the dev server with `npm run dev` and verify the app loads without a framework error overlay. If the login screen blocks authenticated workspace testing, record that limitation and rely on unit/build evidence for shortcut classification and compile-time wiring.

## Self-Review

- Spec coverage: The plan covers shortcut focus, publish, analyze, Electron tray hide/show, no visible shortcut instructions, no backend changes, and verification.
- Placeholder scan: No placeholders remain.
- Type consistency: The shortcut type and function names match across tasks.
