import {
  createExpiredSessionCookie,
  createRandomToken,
  createSessionCookie,
  hashPassword,
  hashToken,
  readSessionToken,
  verifyPassword
} from "./crypto";
import type { AuthRepository, AuthSession, AuthTokenRecord, AuthUser, EmailSender, PublicAuthUser } from "./types";
import { AuthError } from "./types";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

interface AuthServiceOptions {
  repository: AuthRepository;
  emailSender: EmailSender;
  appBaseUrl: string;
}

interface RegisterInput {
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ResetPasswordInput {
  token: string;
  password: string;
}

interface AuthResult {
  user: PublicAuthUser;
  sessionCookie: string;
}

export class AuthService {
  constructor(private readonly options: AuthServiceOptions) {}

  async register(input: RegisterInput, now: string): Promise<{ user: PublicAuthUser }> {
    const email = normalizeEmail(input.email);
    assertValidPassword(input.password);
    const existing = await this.options.repository.findUserByEmail(email);
    if (existing) {
      throw new AuthError("EMAIL_ALREADY_REGISTERED", "邮箱已经注册");
    }

    const user = await this.options.repository.createUser({
      id: createId("user"),
      email,
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now
    });
    await this.sendVerificationEmail(user, now);
    return { user: publicUser(user) };
  }

  async login(input: LoginInput, now: string): Promise<AuthResult> {
    const user = await this.options.repository.findUserByEmail(normalizeEmail(input.email));
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AuthError("INVALID_CREDENTIALS", "邮箱或密码不正确");
    }
    if (!user.emailVerifiedAt) {
      throw new AuthError("EMAIL_NOT_VERIFIED", "请先验证邮箱");
    }

    return this.createSessionResult(user, now);
  }

  async verifyEmail(token: string, now: string): Promise<AuthResult> {
    const record = await this.validEmailVerificationToken(token, now);
    const user = await this.options.repository.findUserById(record.userId);
    if (!user) {
      throw new AuthError("TOKEN_INVALID", "验证链接无效");
    }

    const verified = await this.options.repository.updateUser({
      ...user,
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      updatedAt: now
    });
    await this.options.repository.updateEmailVerificationToken({ ...record, usedAt: now });
    return this.createSessionResult(verified, now);
  }

  async resendVerification(email: string, now: string): Promise<{ ok: true }> {
    const user = await this.options.repository.findUserByEmail(normalizeEmail(email));
    if (user && !user.emailVerifiedAt) {
      await this.sendVerificationEmail(user, now);
    }
    return { ok: true };
  }

  async forgotPassword(email: string, now: string): Promise<{ ok: true }> {
    const user = await this.options.repository.findUserByEmail(normalizeEmail(email));
    if (user) {
      await this.sendPasswordResetEmail(user, now);
    }
    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput, now: string): Promise<AuthResult> {
    assertValidPassword(input.password);
    const tokenHash = await hashToken(input.token);
    const record = await this.options.repository.findPasswordResetTokenByHash(tokenHash);
    if (!record || record.usedAt || isExpired(record.expiresAt, now)) {
      throw new AuthError("TOKEN_INVALID", "重置链接无效或已过期");
    }

    const user = await this.options.repository.findUserById(record.userId);
    if (!user) {
      throw new AuthError("TOKEN_INVALID", "重置链接无效或已过期");
    }

    await this.options.repository.updatePasswordResetToken({ ...record, usedAt: now });
    await this.options.repository.deleteSessionsForUser(user.id);
    const updated = await this.options.repository.updateUser({
      ...user,
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      updatedAt: now
    });
    return this.createSessionResult(updated, now);
  }

  async resolveSession(cookieHeader: string | null | undefined, now: string): Promise<PublicAuthUser | null> {
    const token = readSessionToken(cookieHeader);
    if (!token) {
      return null;
    }

    const session = await this.options.repository.findSessionByTokenHash(await hashToken(token));
    if (!session || isExpired(session.expiresAt, now)) {
      return null;
    }

    const user = await this.options.repository.findUserById(session.userId);
    if (!user) {
      return null;
    }

    await this.options.repository.updateSession({ ...session, lastSeenAt: now });
    return publicUser(user);
  }

  async logout(cookieHeader: string | null | undefined): Promise<{ sessionCookie: string }> {
    const token = readSessionToken(cookieHeader);
    if (token) {
      const session = await this.options.repository.findSessionByTokenHash(await hashToken(token));
      if (session) {
        await this.options.repository.deleteSession(session.id);
      }
    }

    return { sessionCookie: createExpiredSessionCookie() };
  }

  private async sendVerificationEmail(user: AuthUser, now: string): Promise<void> {
    const token = await this.createTokenRecord(user.id, EMAIL_VERIFICATION_TTL_MS, now, (record) =>
      this.options.repository.createEmailVerificationToken(record)
    );
    const actionUrl = authUrl(this.options.appBaseUrl, "/verify-email", token);
    await this.options.emailSender.send({
      to: user.email,
      subject: "验证你的 MemoTask 邮箱",
      text: `打开链接完成邮箱验证：${actionUrl}`,
      actionUrl
    });
  }

  private async sendPasswordResetEmail(user: AuthUser, now: string): Promise<void> {
    const token = await this.createTokenRecord(user.id, PASSWORD_RESET_TTL_MS, now, (record) =>
      this.options.repository.createPasswordResetToken(record)
    );
    const actionUrl = authUrl(this.options.appBaseUrl, "/reset-password", token);
    await this.options.emailSender.send({
      to: user.email,
      subject: "重置你的 MemoTask 密码",
      text: `打开链接重置密码：${actionUrl}`,
      actionUrl
    });
  }

  private async createTokenRecord(
    userId: string,
    ttlMs: number,
    now: string,
    save: (record: AuthTokenRecord) => Promise<AuthTokenRecord>
  ): Promise<string> {
    const token = createRandomToken();
    await save({
      id: createId("token"),
      userId,
      tokenHash: await hashToken(token),
      expiresAt: addMilliseconds(now, ttlMs),
      usedAt: null,
      createdAt: now
    });
    return token;
  }

  private async validEmailVerificationToken(token: string, now: string): Promise<AuthTokenRecord> {
    const record = await this.options.repository.findEmailVerificationTokenByHash(await hashToken(token));
    if (!record || record.usedAt || isExpired(record.expiresAt, now)) {
      throw new AuthError("TOKEN_INVALID", "验证链接无效或已过期");
    }
    return record;
  }

  private async createSessionResult(user: AuthUser, now: string): Promise<AuthResult> {
    const token = createRandomToken();
    const session: AuthSession = {
      id: createId("session"),
      userId: user.id,
      tokenHash: await hashToken(token),
      expiresAt: addMilliseconds(now, SESSION_TTL_MS),
      createdAt: now,
      lastSeenAt: now
    };
    await this.options.repository.createSession(session);
    return {
      user: publicUser(user),
      sessionCookie: createSessionCookie(token, session.expiresAt)
    };
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthError("EMAIL_INVALID", "邮箱格式不正确");
  }
  return normalized;
}

function assertValidPassword(password: string): void {
  if (password.length < 12) {
    throw new AuthError("PASSWORD_TOO_SHORT", "密码至少需要 12 个字符");
  }
}

function publicUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt
  };
}

function authUrl(baseUrl: string, path: string, token: string): string {
  const url = new URL(path, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function isExpired(expiresAt: string, now: string): boolean {
  return Date.parse(expiresAt) <= Date.parse(now);
}
