import { describe, expect, it } from "vitest";
import { extractMemoTagsFromText, memoHasTag, normalizeMemoTag, normalizeMemoTags, tagToneClass } from "../src/shared/memo-tags";

describe("memo tag parsing", () => {
  it("extracts unique tags from memo title and content while preserving display text", () => {
    expect(extractMemoTagsFromText("计划 #Work", "继续推进 #工作 #work #side-project")).toEqual(["Work", "工作", "side-project"]);
  });

  it("matches tags by normalized name", () => {
    expect(normalizeMemoTag(" Work ")).toBe("work");
    expect(memoHasTag(["Work", "生活"], "work")).toBe(true);
    expect(memoHasTag(["Work", "生活"], "缺失")).toBe(false);
  });

  it("normalizes structured tag input while preserving display text", () => {
    expect(normalizeMemoTags([" 工作 ", "#Cloudflare", "工作", ""])).toEqual(["工作", "Cloudflare"]);
  });

  it("maps equal tags to stable visual tone classes", () => {
    expect(tagToneClass(" Cloudflare ")).toBe(tagToneClass("cloudflare"));
    expect(tagToneClass("Cloudflare")).toMatch(/^tag-tone-\d$/);
  });
});
