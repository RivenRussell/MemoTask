import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";
import { ApiClient } from "../../src/api/client";
import type { Memo } from "../../src/types";

interface UiTestClientOptions {
  fetchAi?: (request: Request) => Promise<Response>;
  delayMs?: number;
  onRequest?: (url: string) => void;
  initialMemos?: Memo[];
}

export function createUiTestClient(options?: ((request: Request) => Promise<Response>) | UiTestClientOptions) {
  const fetchAi = typeof options === "function" ? options : options?.fetchAi;
  const repository = new MemoryRepository();
  for (const memo of typeof options === "function" ? [] : (options?.initialMemos ?? [])) {
    void repository.saveMemo("default", memo);
  }
  const app = createApi({
    repository,
    now: () => "2026-06-22T12:00:00.000Z",
    appEncryptionKey: "test-encryption-key-for-ui",
    fetchAi
  });
  const fetcher: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (typeof options !== "function") {
      options?.onRequest?.(url);
      if (options?.delayMs) {
        await new Promise((resolve) => window.setTimeout(resolve, options.delayMs));
      }
    }
    return app.request(url, init);
  };

  return new ApiClient(fetcher);
}
