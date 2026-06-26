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
  async fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const httpsRedirect = redirectPlaintextProductionRequest(request);
    if (httpsRedirect) {
      return httpsRedirect;
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return appPreflightResponse(request);
    }

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
    const response = await app.fetch(request, env, executionContext);
    return withAppCorsHeaders(request, response);
  }
};

const APP_CORS_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

function appPreflightResponse(request: Request): Response {
  const origin = allowedAppOrigin(request);
  if (!origin) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: appCorsHeaders(origin, request.headers.get("access-control-request-headers"))
  });
}

function withAppCorsHeaders(request: Request, response: Response): Response {
  const origin = allowedAppOrigin(request);
  if (!origin) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [name, value] of appCorsHeaders(origin)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function appCorsHeaders(origin: string, requestedHeaders?: string | null): Headers {
  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": requestedHeaders || "authorization,content-type,x-memotask-client",
    "vary": "Origin"
  });
}

function allowedAppOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }
  if (APP_CORS_ORIGINS.has(origin)) {
    return origin;
  }

  try {
    const url = new URL(origin);
    if (url.protocol === "http:" && url.hostname === "127.0.0.1") {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

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
