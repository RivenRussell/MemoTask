const tagPattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

export function extractMemoTagsFromText(title: string, content: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  const source = `${title}\n${content}`;

  for (const match of source.matchAll(tagPattern)) {
    const tag = match[2].trim();
    const normalized = normalizeMemoTag(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push(tag);
  }

  return tags;
}

export function normalizeMemoTag(tag: string): string {
  return tag.trim().toLocaleLowerCase();
}

export function memoHasTag(tags: string[], tag: string): boolean {
  const normalized = normalizeMemoTag(tag);
  return Boolean(normalized) && tags.some((candidate) => normalizeMemoTag(candidate) === normalized);
}
