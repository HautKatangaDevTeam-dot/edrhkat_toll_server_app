import type { StringValue } from 'ms';
import crypto from 'crypto';
import { Role } from '../constants/roles';
import { Post } from '../constants/posts';
import AppError from '../utils/appError';
import { hashPassword, verifyPassword } from '../utils/password';
import { hashToken } from '../utils/token';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import {
  createUser,
  deleteAllRefreshSessionsForUser,
  findRefreshSessionById,
  ensureUsersTable,
  findByUsername,
  findById,
  listUsers as listUsersRepo,
  saveRefreshSession,
  updateUserById,
  updateUserCredentialsAndScope,
  updateUserPasswordById,
  User
} from '../repositories/user.repository';
import { initializeCompanies } from './company.service';
import env from '../config/env';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const DEFAULT_ADMIN = {
  username: 'gloire.mpanga',
  password: 'Tabc@123',
  role: 'ADMIN_SYSTEME' as Role,
  post: 'DIRECTION_GENERALE' as Post
};

export const DEFAULT_RESET_PASSWORD = 'Tabc@123';

const issueTokens = async (
  user: User,
  options?: { mobileClient?: boolean; sessionId?: string }
): Promise<AuthTokens> => {
  const payload = { sub: user.id, username: user.username, role: user.role, post: user.post };
  const sessionId = options?.sessionId ?? crypto.randomUUID();
  const clientType = options?.mobileClient ? 'mobile' : 'web';
  const refreshToken = signRefreshToken(
    payload,
    (options?.mobileClient ? env.jwt.mobileRefreshExpiresIn : env.jwt.refreshExpiresIn) as
      | StringValue
      | number,
    sessionId
  );
  await saveRefreshSession(sessionId, user.id, hashToken(refreshToken), clientType);

  return {
    accessToken: signAccessToken(payload),
    refreshToken
  };
};

export const initializeAuth = async (): Promise<void> => {
  await ensureUsersTable();
  await ensureDefaultAdmin();
  await initializeCompanies();
};

export const ensureDefaultAdmin = async (options?: { resetIfExists?: boolean }) => {
  const existing = await findByUsername(DEFAULT_ADMIN.username);
  const passwordHash = await hashPassword(DEFAULT_ADMIN.password);

  if (existing) {
    if (options?.resetIfExists) {
      await updateUserCredentialsAndScope(
        DEFAULT_ADMIN.username,
        passwordHash,
        DEFAULT_ADMIN.role,
        DEFAULT_ADMIN.post
      );
    }
    return;
  }

  await createUser(
    crypto.randomUUID(),
    DEFAULT_ADMIN.username,
    passwordHash,
    DEFAULT_ADMIN.role,
    DEFAULT_ADMIN.post
  );
};

export const register = async (username: string, password: string, role: Role, post: Post) => {
  const normalizedUsername = username.toLowerCase();
  const existing = await findByUsername(normalizedUsername);
  if (existing) {
    throw new AppError('Cet identifiant est deja utilise', 409, 'AUTH_USERNAME_EXISTS');
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser(
    crypto.randomUUID(),
    normalizedUsername,
    passwordHash,
    role,
    post
  );

  return { user: { id: user.id, username: user.username, role: user.role, post: user.post } };
};

export const login = async (
  username: string,
  password: string,
  options?: { mobileClient?: boolean }
) => {
  const normalizedUsername = username.toLowerCase();
  const user = await findByUsername(normalizedUsername);
  if (!user) {
    throw new AppError('Identifiant ou mot de passe invalide', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Identifiant ou mot de passe invalide', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const tokens = await issueTokens(user, options);
  return { user: { id: user.id, username: user.username, role: user.role, post: user.post }, ...tokens };
};

export const refreshSession = async (
  token: string,
  options?: { mobileClient?: boolean }
) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }

  const userId = payload.sub as string;
  const sessionId = typeof payload.jti === 'string' ? payload.jti : null;
  if (!sessionId) {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }
  const user = await findById(userId);
  const session = await findRefreshSessionById(sessionId);
  if (!user || !session) {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }

  if (hashToken(token) !== session.refreshTokenHash) {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }

  const tokens = await issueTokens(user, { ...options, sessionId });
  return { user: { id: user.id, username: user.username, role: user.role, post: user.post }, ...tokens };
};

export const logout = async (userId: string): Promise<void> => {
  await deleteAllRefreshSessionsForUser(userId);
};

export const listUsers = async (
  search: string | undefined,
  role: string | undefined,
  post: string | undefined,
  page: number,
  pageSize: number
) => {
  const { rows, total } = await listUsersRepo(
    search ?? null,
    role ?? null,
    post ?? null,
    pageSize,
    (page - 1) * pageSize
  );
  return {
    data: rows.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      post: u.post,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    })),
    total,
    page,
    pageSize
  };
};

export const resetUserPassword = async (userId: string) => {
  const user = await findById(userId);
  if (!user) {
    throw new AppError('Utilisateur introuvable', 404, 'AUTH_USER_NOT_FOUND');
  }

  const passwordHash = await hashPassword(DEFAULT_RESET_PASSWORD);
  const updatedUser = await updateUserPasswordById(userId, passwordHash);
  if (!updatedUser) {
    throw new AppError(
      'Impossible de reinitialiser le mot de passe',
      500,
      'AUTH_PASSWORD_RESET_FAILED'
    );
  }

  await deleteAllRefreshSessionsForUser(userId);

  return {
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      post: updatedUser.post
    },
    defaultPassword: DEFAULT_RESET_PASSWORD
  };
};

export const updateUser = async (
  userId: string,
  username: string,
  role: Role,
  post: Post,
  password?: string
) => {
  const normalizedUsername = username.toLowerCase();
  const user = await findById(userId);
  if (!user) {
    throw new AppError('Utilisateur introuvable', 404, 'AUTH_USER_NOT_FOUND');
  }

  const existing = await findByUsername(normalizedUsername);
  if (existing && existing.id !== userId) {
    throw new AppError('Cet identifiant est deja utilise', 409, 'AUTH_USERNAME_EXISTS');
  }

  const passwordHash = password ? await hashPassword(password) : undefined;
  const updatedUser = await updateUserById(
    userId,
    normalizedUsername,
    role,
    post,
    passwordHash
  );
  if (!updatedUser) {
    throw new AppError('Impossible de mettre a jour l\'utilisateur', 500, 'INTERNAL_ERROR');
  }

  if (passwordHash) {
    await deleteAllRefreshSessionsForUser(userId);
  }

  return {
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      post: updatedUser.post
    }
  };
};
