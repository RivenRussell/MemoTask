import type { AuthRepository, AuthSession, AuthTokenRecord, AuthUser } from "./types";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
};

type TokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export class D1AuthRepository implements AuthRepository {
  constructor(private readonly db: D1Database) {}

  async createUser(user: AuthUser): Promise<AuthUser> {
    await this.db
      .prepare(
        `INSERT INTO users (
          id, email, password_hash, email_verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(user.id, user.email, user.passwordHash, user.emailVerifiedAt, user.createdAt, user.updatedAt)
      .run();
    return user;
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const row = await this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async findUserById(userId: string): Promise<AuthUser | null> {
    const row = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async updateUser(user: AuthUser): Promise<AuthUser> {
    await this.db
      .prepare(
        `UPDATE users
         SET email = ?, password_hash = ?, email_verified_at = ?, created_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(user.email, user.passwordHash, user.emailVerifiedAt, user.createdAt, user.updatedAt, user.id)
      .run();
    return user;
  }

  async createSession(session: AuthSession): Promise<AuthSession> {
    await this.upsertSession(session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    const row = await this.db.prepare("SELECT * FROM sessions WHERE token_hash = ?").bind(tokenHash).first<SessionRow>();
    return row ? mapSession(row) : null;
  }

  async updateSession(session: AuthSession): Promise<AuthSession> {
    await this.upsertSession(session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }

  async createEmailVerificationToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    await this.upsertToken("email_verification_tokens", token);
    return token;
  }

  async findEmailVerificationTokenByHash(tokenHash: string): Promise<AuthTokenRecord | null> {
    const row = await this.db.prepare("SELECT * FROM email_verification_tokens WHERE token_hash = ?").bind(tokenHash).first<TokenRow>();
    return row ? mapToken(row) : null;
  }

  async updateEmailVerificationToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    await this.upsertToken("email_verification_tokens", token);
    return token;
  }

  async createPasswordResetToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    await this.upsertToken("password_reset_tokens", token);
    return token;
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<AuthTokenRecord | null> {
    const row = await this.db.prepare("SELECT * FROM password_reset_tokens WHERE token_hash = ?").bind(tokenHash).first<TokenRow>();
    return row ? mapToken(row) : null;
  }

  async updatePasswordResetToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    await this.upsertToken("password_reset_tokens", token);
    return token;
  }

  private async upsertSession(session: AuthSession): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sessions (
          id, user_id, token_hash, expires_at, created_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          token_hash = excluded.token_hash,
          expires_at = excluded.expires_at,
          created_at = excluded.created_at,
          last_seen_at = excluded.last_seen_at`
      )
      .bind(session.id, session.userId, session.tokenHash, session.expiresAt, session.createdAt, session.lastSeenAt)
      .run();
  }

  private async upsertToken(tableName: "email_verification_tokens" | "password_reset_tokens", token: AuthTokenRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${tableName} (
          id, user_id, token_hash, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          token_hash = excluded.token_hash,
          expires_at = excluded.expires_at,
          used_at = excluded.used_at,
          created_at = excluded.created_at`
      )
      .bind(token.id, token.userId, token.tokenHash, token.expiresAt, token.usedAt, token.createdAt)
      .run();
  }
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSession(row: SessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
}

function mapToken(row: TokenRow): AuthTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at
  };
}
