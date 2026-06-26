import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Android share intent integration", () => {
  it("registers MemoTask as a text share target", () => {
    const manifest = readFileSync(path.join(process.cwd(), "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");

    expect(manifest).toContain("android.intent.action.SEND");
    expect(manifest).toContain("android.intent.category.DEFAULT");
    expect(manifest).toContain("android:mimeType=\"text/plain\"");
  });

  it("dispatches shared text into the web app through the native capture event", () => {
    const mainActivity = readFileSync(
      path.join(process.cwd(), "android", "app", "src", "main", "java", "cn", "rrwks", "memotask", "MainActivity.java"),
      "utf8"
    );

    expect(mainActivity).toContain("Intent.ACTION_SEND");
    expect(mainActivity).toContain("Intent.EXTRA_TEXT");
    expect(mainActivity).toContain("memotask:native-capture");
    expect(mainActivity).toContain("android-share");
  });

  it("buffers cold-start share intents until the WebView is ready to receive them", () => {
    const mainActivity = readFileSync(
      path.join(process.cwd(), "android", "app", "src", "main", "java", "cn", "rrwks", "memotask", "MainActivity.java"),
      "utf8"
    );

    expect(mainActivity).toContain("private JSONObject pendingShareDetail");
    expect(mainActivity).toContain("getBridge().getWebView().postDelayed");
    expect(mainActivity).toContain("document.readyState");
    expect(mainActivity).toContain("window.memoTaskPendingCaptures");
    expect(mainActivity).toContain("pendingShareDetail = null");
  });
});
