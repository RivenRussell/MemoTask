import type { Page } from "../state/app-state";

export function createAndroidBackButtonHandler({
  getPage,
  navigateTo,
  goBack
}: {
  getPage: () => Page;
  navigateTo: (page: Page) => void;
  goBack: () => void;
}) {
  return () => {
    if (getPage() === "memos") {
      goBack();
      return;
    }

    navigateTo("memos");
  };
}
