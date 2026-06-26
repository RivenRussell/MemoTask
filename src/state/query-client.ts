import { QueryClient, keepPreviousData } from "@tanstack/react-query";

export function createMemoTaskQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: true,
        retry: 1,
        staleTime: 5_000
      },
      mutations: {
        retry: 0
      }
    }
  });
}
