import { describe, expect, it, vi } from "vitest";
import { createNativeBridge, normalizeExternalCapture } from "../../src/native/native-bridge";

describe("native bridge", () => {
  it("normalizes external capture payloads", () => {
    expect(
      normalizeExternalCapture({
        title: " 分享标题 ",
        content: "  分享正文  ",
        source: "android-share",
        receivedAt: "2026-06-26T12:00:00.000Z"
      })
    ).toEqual({
      title: "分享标题",
      content: "分享正文",
      source: "android-share",
      receivedAt: "2026-06-26T12:00:00.000Z"
    });
  });

  it("subscribes to custom native capture events and notifies the native shell", () => {
    const onCapture = vi.fn();
    const bridge = createNativeBridge(window);
    const unsubscribe = bridge.onExternalCapture(onCapture);

    window.dispatchEvent(
      new CustomEvent("memotask:native-capture", {
        detail: {
          content: "桌面快捷记录",
          source: "desktop",
          receivedAt: "2026-06-26T12:00:00.000Z"
        }
      })
    );

    expect(onCapture).toHaveBeenCalledWith({
      title: "",
      content: "桌面快捷记录",
      source: "desktop",
      receivedAt: "2026-06-26T12:00:00.000Z"
    });

    unsubscribe();
  });

  it("drains pending native captures that arrived before React subscribed", () => {
    const onCapture = vi.fn();
    const targetWindow = Object.assign(new EventTarget(), {
      memoTaskPendingCaptures: [
        {
          title: "冷启动分享",
          content: "https://example.com/cold-start",
          source: "android-share",
          receivedAt: "2026-06-26T12:00:00.000Z"
        }
      ]
    }) as Window;
    const bridge = createNativeBridge(targetWindow);

    bridge.onExternalCapture(onCapture);

    expect(onCapture).toHaveBeenCalledWith({
      title: "冷启动分享",
      content: "https://example.com/cold-start",
      source: "android-share",
      receivedAt: "2026-06-26T12:00:00.000Z"
    });
    expect(targetWindow.memoTaskPendingCaptures).toEqual([]);
  });
});
