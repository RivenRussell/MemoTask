import { createApi } from "./api";
import { D1Repository } from "./repository/d1-repository";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENCRYPTION_KEY?: string;
}

export default {
  fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const app = createApi({ repository: new D1Repository(env.DB) });
    return app.fetch(request, env, executionContext);
  }
};
