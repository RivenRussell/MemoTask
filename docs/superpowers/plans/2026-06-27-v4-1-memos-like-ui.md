# v4.1 Memos-like UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `v4.1.0` Memos-like UI stage: a timeline-first workspace with restrained Memos-inspired chrome while preserving current MemoTask behavior.

**Architecture:** Keep the existing React/Vite state model and API contracts. Recompose the app shell and memo list into a narrow navigation rail, central timeline feed, and right utility sidebar, then update visual tests and component tests to lock the new structure.

**Tech Stack:** React 19, TypeScript, Vite, Testing Library, Vitest, Playwright, dnd-kit, lucide-react, CSS.

## Global Constraints

- Version target is `v4.1.0`.
- Use Memos as the visual reference, not the current MemoTask UI.
- No image generation is expected for this stage.
- Do not implement tags/search functionality beyond static/sidebar placeholders required for stage 1 layout.
- Preserve existing auth, capture, settings, history, memo detail, Todo, reorder, archive, restore, and AI behavior.
- Write failing tests before production UI changes.
- Commit the completed stage after verification.

---

## File Structure

- Modify `package.json` and `package-lock.json` for version `4.1.0`.
- Modify `src/components/AppShell.tsx` for app chrome and right utility sidebar.
- Modify `src/pages/MemosPage.tsx` for timeline feed container and empty state.
- Modify `src/components/MemoCard.tsx` for feed-item presentation.
- Modify `src/styles.css` for the Memos-like design system.
- Modify `tests/ui/shell.test.tsx` for shell/timeline assertions.
- Modify `tests/ui/flow.test.tsx` and `tests/ui/memo-reorder.test.tsx` only where selectors depend on old grid/card assumptions.
- Modify `tests/e2e/visual-qa.spec.ts` for visual integrity expectations.
- Modify `tests/e2e/memotask.spec.ts` if selectors depend on `article.memo-card h2`.

## Task 1: Lock the New Shell and Timeline Contract

**Files:**
- Modify: `tests/ui/shell.test.tsx`
- Modify: `tests/ui/flow.test.tsx`
- Modify: `tests/ui/memo-reorder.test.tsx`

**Interfaces:**
- Consumes: Existing `App`, `createUiTestClient`, and `findPrimaryNav`.
- Produces: Failing tests that require `.app-rail`, `.timeline-feed`, `.utility-sidebar`, and `.memo-feed-item`.

- [ ] **Step 1: Write the failing shell tests**

Update `tests/ui/shell.test.tsx` so the default `/memos` test expects:

```ts
expect(document.querySelector(".app-rail")).not.toBeNull();
expect(document.querySelector(".timeline-feed")).not.toBeNull();
expect(document.querySelector(".utility-sidebar")).not.toBeNull();
expect(document.querySelector(".memos-grid")).toBeNull();
expect(screen.getByText("快速记录")).toBeInTheDocument();
expect(screen.getByText("筛选")).toBeInTheDocument();
expect(screen.getByText("标签")).toBeInTheDocument();
```

Keep the existing behavior assertions for routing, empty state, forbidden old marketing labels, and navigation.

- [ ] **Step 2: Write the failing feed tests**

Update memo card assertions in `tests/ui/flow.test.tsx` and `tests/ui/memo-reorder.test.tsx` so they query `article.memo-feed-item` instead of assuming grid cards:

```ts
return screen
  .getAllByRole("article")
  .filter((article) => article.classList.contains("memo-feed-item"))
  .map((card) => within(card).getByRole("heading", { level: 2 }).textContent ?? "");
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run test:ui -- tests/ui/shell.test.tsx tests/ui/flow.test.tsx tests/ui/memo-reorder.test.tsx
```

Expected: FAIL because `.app-rail`, `.timeline-feed`, `.utility-sidebar`, and `.memo-feed-item` do not exist yet.

## Task 2: Implement the Memos-like App Shell

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Existing `page`, `activePrimary`, `title`, `userEmail`, `onLogout`, `onNavigate`, and children.
- Produces: New shell classes `.app-rail`, `.workspace-main`, `.timeline-shell`, `.utility-sidebar`.

- [ ] **Step 1: Replace shell structure**

Change `AppShell` to render:

```tsx
<div className="app-frame">
  <aside className="app-rail" aria-label="桌面导航">...</aside>
  <main className="workspace-main" ref={workspaceRef}>...</main>
  <aside className="utility-sidebar" aria-label="工具栏">...</aside>
  <PrimaryNavigation compact ... />
</div>
```

Keep `PrimaryNavigation` button labels as `记录`, `队列`, `设置`.

- [ ] **Step 2: Add utility sidebar content**

For stage 1, render static structure:

```tsx
<section className="utility-panel">
  <label htmlFor="memo-search-preview">筛选</label>
  <input id="memo-search-preview" placeholder="搜索备忘录" disabled />
</section>
<section className="utility-panel">
  <h2>标签</h2>
  <p className="muted-copy">标签会在 v4.2.0 支持。</p>
</section>
```

Show the history button in the sidebar on `memos` and the back-to-queue button on `history`.

- [ ] **Step 3: Replace shell CSS tokens**

Update CSS tokens to a restrained Memos-like palette:

```css
--app-bg: #111318;
--surface: #1a1d23;
--surface-solid: #20242b;
--text-strong: #f2f4f8;
--text: #c8cdd6;
--text-muted: #8f96a3;
--accent: #5f9fe7;
--line-soft: #303641;
```

Remove decorative background image usage from the authenticated app shell.

- [ ] **Step 4: Verify shell tests move forward**

Run:

```bash
npm run test:ui -- tests/ui/shell.test.tsx
```

Expected: shell structure assertions pass or reveal component-level issues to fix.

## Task 3: Implement Timeline Feed Memo Items

**Files:**
- Modify: `src/pages/MemosPage.tsx`
- Modify: `src/components/MemoCard.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Existing memo list, reorder handlers, open handler, and Todo toggle handler.
- Produces: `.timeline-feed`, `.memo-feed-item`, `.feed-composer-card`, and compact memo feed UI.

- [ ] **Step 1: Update `MemosPage` layout**

Render:

```tsx
<div className="timeline-shell">
  <section className="feed-composer-card" aria-label="快速记录">...</section>
  <div className="timeline-feed">...</div>
</div>
```

The composer is a stage-1 shortcut with a button to navigate to `/capture` if navigation is available through shell only; if not, make it a non-interactive visual prompt with clear text.

- [ ] **Step 2: Update `MemoCard`**

Use feed anatomy:

```tsx
<article className="memo-feed-item" ...>
  <header className="memo-feed-header">...</header>
  <div className="memo-feed-content">...</div>
  <ul className="todo-list memo-feed-todos">...</ul>
  <footer className="memo-feed-actions">...</footer>
</article>
```

Keep buttons and aria labels for reorder and detail:

- `上移 ${memo.title}`
- `下移 ${memo.title}`
- `打开 ${memo.title}`

- [ ] **Step 3: Verify GREEN for UI unit tests**

Run:

```bash
npm run test:ui -- tests/ui/shell.test.tsx tests/ui/flow.test.tsx tests/ui/memo-reorder.test.tsx
```

Expected: PASS.

## Task 4: Update Visual QA and E2E Selectors

**Files:**
- Modify: `tests/e2e/visual-qa.spec.ts`
- Modify: `tests/e2e/memotask.spec.ts`

**Interfaces:**
- Consumes: New shell and feed classes.
- Produces: E2E tests that validate the new Memos-like layout and no longer rely on old grid/card assumptions.

- [ ] **Step 1: Update e2e selectors**

In `tests/e2e/memotask.spec.ts`, update memo order selector:

```ts
return page.locator("article.memo-feed-item h2").evaluateAll(...)
```

- [ ] **Step 2: Update visual QA integrity expectations**

In `tests/e2e/visual-qa.spec.ts`, replace `.app-frame` and `.soft-card` assumptions where needed with `.app-frame`, `.memo-feed-item`, `.utility-sidebar`, `.workspace-main`, and current cards used on non-feed pages.

- [ ] **Step 3: Verify e2e tests**

Run:

```bash
npm run e2e
```

Expected: PASS or actionable visual integrity failures that are fixed before commit.

## Task 5: Version, Verify, and Commit v4.1.0

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/version-history.md` if current version text needs advancing to `v4.1.0`.

**Interfaces:**
- Consumes: Completed stage 1 UI.
- Produces: `v4.1.0` commit and tag.

- [ ] **Step 1: Update version**

Set `package.json` version to `4.1.0` and run:

```bash
npm install --package-lock-only
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run build
npm run e2e
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Commit and tag**

Run:

```bash
git add README.md docs version-history package.json package-lock.json src tests
git commit -m "feat: add memos-like timeline UI"
git tag v4.1.0
```

Use exact file paths in the real command; do not add generated build output.
