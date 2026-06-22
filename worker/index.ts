import { createApi } from "./api";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENCRYPTION_KEY?: string;
}

const app = createApi();

export default app;
