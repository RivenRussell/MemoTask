import { describe, expect, it, vi } from "vitest";
import { createAndroidBackButtonHandler } from "../../src/native/android-back-button";

describe("Android back button handling", () => {
  it("navigates secondary pages back to the queue", () => {
    const navigate = vi.fn();
    const handler = createAndroidBackButtonHandler({
      getPage: () => "capture",
      navigateTo: navigate,
      goBack: vi.fn()
    });

    handler();

    expect(navigate).toHaveBeenCalledWith("memos");
  });

  it("uses browser history from the root queue page", () => {
    const goBack = vi.fn();
    const handler = createAndroidBackButtonHandler({
      getPage: () => "memos",
      navigateTo: vi.fn(),
      goBack
    });

    handler();

    expect(goBack).toHaveBeenCalled();
  });
});
