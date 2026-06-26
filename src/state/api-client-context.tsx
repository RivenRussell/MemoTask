import { createContext, useContext } from "react";
import { ApiClient, apiClient } from "../api/client";

const ApiClientContext = createContext<ApiClient>(apiClient);

export function ApiClientProvider({ children, client }: { children: React.ReactNode; client: ApiClient }) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  return useContext(ApiClientContext);
}
