export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  actionUrl?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface AuthRepository {
  createUser(user: AuthUser): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(userId: string): Promise<AuthUser | null>;
  updateUser(user: AuthUser): Promise<AuthUser>;
  createSession(session: AuthSession): Promise<AuthSession>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  updateSession(session: AuthSession): Promise<AuthSession>;
  deleteSession(sessionId: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  createEmailVerificationToken(token: AuthTokenRecord): Promise<AuthTokenRecord>;
  findEmailVerificationTokenByHash(tokenHash: string): Promise<AuthTokenRecord | null>;
  updateEmailVerificationToken(token: AuthTokenRecord): Promise<AuthTokenRecord>;
  createPasswordResetToken(token: AuthTokenRecord): Promise<AuthTokenRecord>;
  findPasswordResetTokenByHash(tokenHash: string): Promise<AuthTokenRecord | null>;
  updatePasswordResetToken(token: AuthTokenRecord): Promise<AuthTokenRecord>;
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}
