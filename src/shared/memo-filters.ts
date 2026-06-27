import type { Memo } from "../types";

export interface MemoFilterState {
  query: string;
  selectedTag: string | null;
}

const tagPattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

export function collectMemoTags(memos: Memo[]): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const memo of memos) {
    for (const tag of extractMemoTags(memo)) {
      const normalized = normalizeTag(tag);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      tags.push(tag);
    }
  }

  return tags;
}

export function extractMemoTags(memo: Memo): string[] {
  const tags: string[] = [];
  const source = `${memo.title}\n${memo.content}`;
  for (const match of source.matchAll(tagPattern)) {
    tags.push(match[2]);
  }
  return tags;
}

export function filterMemos(memos: Memo[], filters: MemoFilterState): Memo[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const selectedTag = filters.selectedTag ? normalizeTag(filters.selectedTag) : null;

  return memos.filter((memo) => {
    if (selectedTag && !extractMemoTags(memo).some((tag) => normalizeTag(tag) === selectedTag)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [memo.title, memo.content, ...memo.todos.map((todo) => todo.title)].join("\n").toLocaleLowerCase();
    return haystack.includes(query);
  });
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase();
}
