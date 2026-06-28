# Structured Tags v5.0.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MemoTask tags structured data instead of `#tag` text appended into memo content, and polish tag chips with stable colors.

**Architecture:** Keep the existing `memo_tags` table and `Memo.tags` API shape. Add optional `tags: string[]` to draft, publish, and update payloads; repositories prefer explicit tags and only fall back to text parsing for old clients/data. The React draft/editor state owns tag arrays, while `TagChip` presentation maps each tag to a deterministic color class.

**Tech Stack:** React 19, TypeScript, Hono Worker API, D1/memory repositories, Vitest.

## Global Constraints

- Version target is `v5.0.4`.
- Tags must not be written into the primary memo content textbox.
- Existing memos with inline `#tag` text remain compatible.
- No new D1 migration is needed because `memo_tags` already exists.
- Keep the change scoped to tags, styling, tests, and version docs.

---

### Task 1: API Contract Tests

**Files:**
- Modify: `tests/api/client.test.ts`
- Modify: `tests/api/memo-flow.test.ts`

**Interfaces:**
- Produces: tests asserting `PublishMemoInput.tags`, memo update tags, and non-mutated content.

- [x] **Step 1: Write failing tests**
- [x] **Step 2: Run targeted tests and confirm failures**
- [x] **Step 3: Implement API/repository changes**
- [x] **Step 4: Rerun targeted tests and confirm pass**

### Task 2: Structured Tag Helpers

**Files:**
- Modify: `src/shared/memo-tags.ts`
- Modify: `tests/memo-tags.test.ts`
- Modify: `src/ui-helpers.ts`
- Modify: `tests/ui-helpers.test.ts`

**Interfaces:**
- Produces: `normalizeMemoTags(tags: string[]): string[]` and `tagToneClass(tag: string): string`.

- [x] **Step 1: Write failing helper tests**
- [x] **Step 2: Implement normalization and tone helpers**
- [x] **Step 3: Rerun helper tests**

### Task 3: React Tag State and UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `normalizeMemoTags` and `tagToneClass`.
- Produces: draft/editor `tags` arrays, colored removable chips, and structured API payloads.

- [x] **Step 1: Replace draft tag text mutation with draft tag state updates**
- [x] **Step 2: Replace expanded memo tag text mutation with editor tag state updates**
- [x] **Step 3: Render colored chips in capture, sidebar, memo cards, and editor**
- [x] **Step 4: Verify no code path calls tag helpers to append `#tag` into content**

### Task 4: Version, Docs, and Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `android/app/build.gradle`
- Modify: `README.md`
- Modify: `docs/version-history.md`

**Interfaces:**
- Produces: v5.0.4 local version record and verification evidence.

- [x] **Step 1: Bump version files to v5.0.4**
- [x] **Step 2: Document structured tags and local deployment status**
- [x] **Step 3: Run `npm test`, `npm run build`, and `git diff --check`**
