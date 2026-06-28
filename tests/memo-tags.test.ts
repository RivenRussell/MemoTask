import { describe, expect, it } from "vitest";
import { extractMemoTagsFromText, memoHasTag, normalizeMemoTag } from "../src/shared/memo-tags";

describe("memo tag parsing", () => {
  it("extracts unique tags from memo title and content while preserving display text", () => {
    expect(extractMemoTagsFromText("计划 #Work", "继续推进 #工作 #work #side-project")).toEqual(["Work", "工作", "side-project"]);
  });

  it("matches tags by normalized name", () => {
    expect(normalizeMemoTag(" Work ")).toBe("work");
    expect(memoHasTag(["Work", "生活"], "work")).toBe(true);
    expect(memoHasTag(["Work", "生活"], "缺失")).toBe(false);
  });
});
