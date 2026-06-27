import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../../src/components/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders GitHub-flavored Markdown without unsafe raw HTML", () => {
    render(
      <MarkdownRenderer
        content={[
          "## 发布计划",
          "",
          "- [x] 完成 UI",
          "- [ ] 补充测试",
          "",
          "> 保留上下文",
          "",
          "| 项目 | 状态 |",
          "| --- | --- |",
          "| Markdown | ready |",
          "",
          "```ts",
          "const stage = 'v4.2.3';",
          "```",
          "",
          "<script>window.__unsafeMarkdown = true</script>"
        ].join("\n")}
      />
    );

    expect(screen.getByRole("heading", { name: "发布计划" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "完成 UI" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "补充测试" })).not.toBeChecked();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("const stage = 'v4.2.3';")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect((window as typeof window & { __unsafeMarkdown?: boolean }).__unsafeMarkdown).toBeUndefined();
  });
});
