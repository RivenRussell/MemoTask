import { createApi } from "./api";
import { D1AuthRepository } from "./auth/d1-auth-repository";
import { createEmailSender } from "./auth/email";
import { AuthService } from "./auth/service";
import { D1Repository } from "./repository/d1-repository";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENCRYPTION_KEY?: string;
  APP_BASE_URL?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
}

export default {
  fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const app = createApi({
      repository: new D1Repository(env.DB),
      authService: new AuthService({
        repository: new D1AuthRepository(env.DB),
        emailSender: createEmailSender(env),
        appBaseUrl: env.APP_BASE_URL ?? new URL(request.url).origin
      }),
      appEncryptionKey: env.APP_ENCRYPTION_KEY
    });
    return app.fetch(request, env, executionContext);
  }
};
