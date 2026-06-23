import type { AuthRepository, AuthSession, AuthTokenRecord, AuthUser } from "./types";

function cloneUser(user: AuthUser): AuthUser {
  return { ...user };
}

function cloneSession(session: AuthSession): AuthSession {
  return { ...session };
}

function cloneToken(token: AuthTokenRecord): AuthTokenRecord {
  return { ...token };
}

export class MemoryAuthRepository implements AuthRepository {
  private users: AuthUser[] = [];
  private sessions: AuthSession[] = [];
  private emailVerificationTokens: AuthTokenRecord[] = [];
  private passwordResetTokens: AuthTokenRecord[] = [];

  async createUser(user: AuthUser): Promise<AuthUser> {
    this.users.push(cloneUser(user));
    return cloneUser(user);
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = this.users.find((candidate) => candidate.email === email);
    return user ? cloneUser(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUser | null> {
    const user = this.users.find((candidate) => candidate.id === userId);
    return user ? cloneUser(user) : null;
  }

  async updateUser(user: AuthUser): Promise<AuthUser> {
    const index = this.users.findIndex((candidate) => candidate.id === user.id);
    if (index < 0) {
      this.users.push(cloneUser(user));
    } else {
      this.users[index] = cloneUser(user);
    }
    return cloneUser(user);
  }

  async createSession(session: AuthSession): Promise<AuthSession> {
    this.sessions.push(cloneSession(session));
    return cloneSession(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    return session ? cloneSession(session) : null;
  }

  async updateSession(session: AuthSession): Promise<AuthSession> {
    const index = this.sessions.findIndex((candidate) => candidate.id === session.id);
    if (index >= 0) {
      this.sessions[index] = cloneSession(session);
    }
    return cloneSession(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    this.sessions = this.sessions.filter((session) => session.userId !== userId);
  }

  async createEmailVerificationToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    this.emailVerificationTokens.push(cloneToken(token));
    return cloneToken(token);
  }

  async findEmailVerificationTokenByHash(tokenHash: string): Promise<AuthTokenRecord | null> {
    const token = this.emailVerificationTokens.find((candidate) => candidate.tokenHash === tokenHash);
    return token ? cloneToken(token) : null;
  }

  async updateEmailVerificationToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    const index = this.emailVerificationTokens.findIndex((candidate) => candidate.id === token.id);
    if (index >= 0) {
      this.emailVerificationTokens[index] = cloneToken(token);
    }
    return cloneToken(token);
  }

  async createPasswordResetToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    this.passwordResetTokens.push(cloneToken(token));
    return cloneToken(token);
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<AuthTokenRecord | null> {
    const token = this.passwordResetTokens.find((candidate) => candidate.tokenHash === tokenHash);
    return token ? cloneToken(token) : null;
  }

  async updatePasswordResetToken(token: AuthTokenRecord): Promise<AuthTokenRecord> {
    const index = this.passwordResetTokens.findIndex((candidate) => candidate.id === token.id);
    if (index >= 0) {
      this.passwordResetTokens[index] = cloneToken(token);
    }
    return cloneToken(token);
  }
}
