import { describe, expect, it } from "vitest";
import { D1AuthRepository } from "../../worker/auth/d1-auth-repository";
import type { AuthSession, AuthTokenRecord, AuthUser } from "../../worker/auth/types";

class CannedAuthD1Database {
  public readonly statements: Array<{ query: string; values: unknown[] }> = [];
  private readonly users = new Map<string, Record<string, unknown>>();
  private readonly sessions = new Map<string, Record<string, unknown>>();
  private readonly emailTokens = new Map<string, Record<string, unknown>>();
  private readonly resetTokens = new Map<string, Record<string, unknown>>();

  prepare(query: string): D1PreparedStatement {
    return new CannedAuthD1Statement(this, query) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(): Promise<D1Result<T>[]> {
    return [];
  }

  async exec(): Promise<D1ExecResult> {
    return { count: 0, duration: 0 };
  }

  record(query: string, values: unknown[]) {
    this.statements.push({ query, values });
  }

  first(query: string, values: unknown[]): Record<string, unknown> | null {
    if (query.includes("FROM users") && query.includes("email = ?")) {
      return [...this.users.values()].find((user) => user.email === values[0]) ?? null;
    }
    if (query.includes("FROM users") && query.includes("id = ?")) {
      return this.users.get(String(values[0])) ?? null;
    }
    if (query.includes("FROM sessions") && query.includes("token_hash = ?")) {
      return [...this.sessions.values()].find((session) => session.token_hash === values[0]) ?? null;
    }
    if (query.includes("FROM email_verification_tokens") && query.includes("token_hash = ?")) {
      return [...this.emailTokens.values()].find((token) => token.token_hash === values[0]) ?? null;
    }
    if (query.includes("FROM password_reset_tokens") && query.includes("token_hash = ?")) {
      return [...this.resetTokens.values()].find((token) => token.token_hash === values[0]) ?? null;
    }
    return null;
  }

  run(query: string, values: unknown[]) {
    this.record(query, values);
    if (query.includes("INTO users")) {
      this.users.set(String(values[0]), userRow(values));
    }
    if (query.startsWith("UPDATE users")) {
      this.users.set(String(values[5]), {
        id: values[5],
        email: values[0],
        password_hash: values[1],
        email_verified_at: values[2],
        created_at: values[3],
        updated_at: values[4]
      });
    }
    if (query.includes("INTO sessions")) {
      this.sessions.set(String(values[0]), sessionRow(values));
    }
    if (query.startsWith("UPDATE sessions")) {
      this.sessions.set(String(values[0]), sessionRow(values));
    }
    if (query.includes("DELETE FROM sessions WHERE id = ?")) {
      this.sessions.delete(String(values[0]));
    }
    if (query.includes("DELETE FROM sessions WHERE user_id = ?")) {
      for (const [id, session] of this.sessions) {
        if (session.user_id === values[0]) {
          this.sessions.delete(id);
        }
      }
    }
    if (query.includes("INTO email_verification_tokens")) {
      this.emailTokens.set(String(values[0]), tokenRow(values));
    }
    if (query.startsWith("UPDATE email_verification_tokens")) {
      this.emailTokens.set(String(values[0]), tokenRow(values));
    }
    if (query.includes("INTO password_reset_tokens")) {
      this.resetTokens.set(String(values[0]), tokenRow(values));
    }
    if (query.startsWith("UPDATE password_reset_tokens")) {
      this.resetTokens.set(String(values[0]), tokenRow(values));
    }
  }
}

class CannedAuthD1Statement {
  private values: unknown[] = [];

  constructor(
    private readonly db: CannedAuthD1Database,
    private readonly query: string
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.first(this.query, this.values) as T | null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return { success: true, meta: d1Meta(), results: [] };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.db.run(this.query, this.values);
    return { success: true, meta: d1Meta(), results: [] as T[] } as D1Result<T>;
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    return options?.columnNames ? ([[], ...([] as T[])] as [string[], ...T[]]) : [];
  }
}

function d1Meta(): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: true,
    changes: 0
  };
}

function userRow(values: unknown[]): Record<string, unknown> {
  return {
    id: values[0],
    email: values[1],
    password_hash: values[2],
    email_verified_at: values[3],
    created_at: values[4],
    updated_at: values[5]
  };
}

function sessionRow(values: unknown[]): Record<string, unknown> {
  return {
    id: values[0],
    user_id: values[1],
    token_hash: values[2],
    expires_at: values[3],
    created_at: values[4],
    last_seen_at: values[5]
  };
}

function tokenRow(values: unknown[]): Record<string, unknown> {
  return {
    id: values[0],
    user_id: values[1],
    token_hash: values[2],
    expires_at: values[3],
    used_at: values[4],
    created_at: values[5]
  };
}

function createUser(): AuthUser {
  return {
    id: "user-1",
    email: "owner@example.com",
    passwordHash: "pbkdf2-sha256:test",
    emailVerifiedAt: null,
    createdAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z"
  };
}

function createSession(): AuthSession {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "token-hash",
    expiresAt: "2026-07-22T12:00:00.000Z",
    createdAt: "2026-06-22T12:00:00.000Z",
    lastSeenAt: "2026-06-22T12:00:00.000Z"
  };
}

function createToken(id: string): AuthTokenRecord {
  return {
    id,
    userId: "user-1",
    tokenHash: `${id}-hash`,
    expiresAt: "2026-06-23T12:00:00.000Z",
    usedAt: null,
    createdAt: "2026-06-22T12:00:00.000Z"
  };
}

describe("D1AuthRepository", () => {
  it("persists and reads users, sessions, verification tokens, and reset tokens", async () => {
    const db = new CannedAuthD1Database();
    const repository = new D1AuthRepository(db as unknown as D1Database);

    await repository.createUser(createUser());
    const verifiedUser = { ...createUser(), emailVerifiedAt: "2026-06-22T12:05:00.000Z", updatedAt: "2026-06-22T12:05:00.000Z" };
    await repository.updateUser(verifiedUser);
    await repository.createSession(createSession());
    await repository.createEmailVerificationToken(createToken("verify-token"));
    await repository.createPasswordResetToken(createToken("reset-token"));

    expect(await repository.findUserByEmail("owner@example.com")).toMatchObject({ id: "user-1", emailVerifiedAt: verifiedUser.emailVerifiedAt });
    expect(await repository.findUserById("user-1")).toMatchObject({ email: "owner@example.com" });
    expect(await repository.findSessionByTokenHash("token-hash")).toMatchObject({ id: "session-1", userId: "user-1" });
    expect(await repository.findEmailVerificationTokenByHash("verify-token-hash")).toMatchObject({ id: "verify-token", userId: "user-1" });
    expect(await repository.findPasswordResetTokenByHash("reset-token-hash")).toMatchObject({ id: "reset-token", userId: "user-1" });
    expect(db.statements.some((statement) => statement.query.includes("INTO users"))).toBe(true);
    expect(db.statements.some((statement) => statement.query.includes("INTO sessions"))).toBe(true);
    expect(db.statements.some((statement) => statement.query.includes("INTO email_verification_tokens"))).toBe(true);
    expect(db.statements.some((statement) => statement.query.includes("INTO password_reset_tokens"))).toBe(true);
  });

  it("deletes one session or all sessions for a user", async () => {
    const db = new CannedAuthD1Database();
    const repository = new D1AuthRepository(db as unknown as D1Database);

    await repository.createSession(createSession());
    await repository.deleteSession("session-1");
    await repository.createSession(createSession());
    await repository.deleteSessionsForUser("user-1");

    expect(await repository.findSessionByTokenHash("token-hash")).toBeNull();
    expect(db.statements.some((statement) => statement.query.includes("DELETE FROM sessions WHERE id = ?"))).toBe(true);
    expect(db.statements.some((statement) => statement.query.includes("DELETE FROM sessions WHERE user_id = ?"))).toBe(true);
  });
});
