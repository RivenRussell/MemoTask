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
    const httpsRedirect = redirectPlaintextProductionRequest(request);
    if (httpsRedirect) {
      return httpsRedirect;
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

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

function redirectPlaintextProductionRequest(request: Request): Response | null {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isPlaintext = url.protocol === "http:" || forwardedProto === "http";
  if (!isPlaintext || isLocalHost(url.hostname)) {
    return null;
  }

  url.protocol = "https:";
  return Response.redirect(url.toString(), 308);
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]";
}
