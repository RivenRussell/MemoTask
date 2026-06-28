import type { Memo } from "./types";
import { extractMemoTagsFromText, normalizeMemoTag } from "./shared/memo-tags";

interface MemoText {
  title: string;
  content: string;
}

const tagTokenPattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

export type QuickRecordShortcut = "focus" | "publish" | "analyze" | null;

interface QuickRecordKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
}

export function addMemoTextTag(text: MemoText, tag: string): MemoText {
  const normalized = normalizeMemoTag(tag);
  if (!normalized || memoTextHasTag(text, normalized)) {
    return text;
  }

  return {
    ...text,
    content: `${text.content.trimEnd()} #${tag.trim()}`.trimStart()
  };
}

export function removeMemoTextTag(text: MemoText, tag: string): MemoText {
  const normalized = normalizeMemoTag(tag);
  if (!normalized) {
    return text;
  }

  return {
    title: removeTagTokens(text.title, normalized),
    content: removeTagTokens(text.content, normalized)
  };
}

export function filterMemosByQuery(memos: Memo[], query: string): Memo[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return memos;
  }

  return memos.filter((memo) => memoSearchText(memo).includes(normalized));
}

export function collectMemoTags(apiTags: string[], memos: Memo[]): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const tag of [
    ...apiTags,
    ...memos.flatMap((memo) => [...memo.tags, ...extractMemoTagsFromText(memo.title, memo.content)])
  ]) {
    const normalized = normalizeMemoTag(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push(tag);
  }

  return tags.sort((a, b) => normalizeMemoTag(a).localeCompare(normalizeMemoTag(b)));
}

export function toggleTodoInMemoList(memos: Memo[], todoId: string, now: string): Memo[] {
  return memos.map((memo) => {
    if (!memo.todos.some((todo) => todo.id === todoId)) {
      return memo;
    }

    return {
      ...memo,
      updatedAt: now,
      todos: memo.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              status: todo.status === "done" ? "todo" : "done",
              completedAt: todo.status === "done" ? null : now,
              updatedAt: now
            }
          : todo
      )
    };
  });
}

export function moveIdByDelta(ids: string[], id: string, delta: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) {
    return ids;
  }

  const next = [...ids];
  const [selected] = next.splice(index, 1);
  next.splice(nextIndex, 0, selected);
  return next;
}

export function getQuickRecordShortcut(event: QuickRecordKeyEvent): QuickRecordShortcut {
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  if (!hasPrimaryModifier || event.altKey) {
    return null;
  }

  const key = event.key.toLocaleLowerCase();
  if (key === "k" && !event.shiftKey) {
    return "focus";
  }
  if (key === "enter") {
    return event.shiftKey ? "analyze" : "publish";
  }
  return null;
}

function memoTextHasTag(text: MemoText, normalizedTag: string): boolean {
  const source = `${text.title}\n${text.content}`;
  for (const match of source.matchAll(tagTokenPattern)) {
    if (normalizeMemoTag(match[2]) === normalizedTag) {
      return true;
    }
  }
  return false;
}

function removeTagTokens(value: string, normalizedTag: string): string {
  return value
    .replace(tagTokenPattern, (fullMatch: string, prefix: string, tag: string) =>
      normalizeMemoTag(tag) === normalizedTag ? prefix : fullMatch
    )
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join(value.includes("\r\n") ? "\r\n" : "\n")
    .trim();
}

function memoSearchText(memo: Memo): string {
  return [
    memo.title,
    memo.content,
    ...memo.tags,
    ...memo.todos.flatMap((todo) => [todo.title, todo.notes ?? ""])
  ]
    .join("\n")
    .toLocaleLowerCase();
}
