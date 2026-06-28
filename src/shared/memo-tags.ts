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

export function normalizeMemoTags(tags: string[]): string[] {
  const normalizedTags: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/^#+/, "").trim();
    const normalized = normalizeMemoTag(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    normalizedTags.push(tag);
  }

  return normalizedTags;
}

export function memoHasTag(tags: string[], tag: string): boolean {
  const normalized = normalizeMemoTag(tag);
  return Boolean(normalized) && tags.some((candidate) => normalizeMemoTag(candidate) === normalized);
}

export function tagToneClass(tag: string): string {
  const normalized = normalizeMemoTag(tag);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return `tag-tone-${hash % 8}`;
}
