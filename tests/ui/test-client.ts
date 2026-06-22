import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";
import { ApiClient } from "../../src/api/client";

export function createUiTestClient() {
  const repository = new MemoryRepository();
  const app = createApi({ repository, now: () => "2026-06-22T12:00:00.000Z" });
  const fetcher: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    return app.request(url, init);
  };

  return new ApiClient(fetcher);
}
