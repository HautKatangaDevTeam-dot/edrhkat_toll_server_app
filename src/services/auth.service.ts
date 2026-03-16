import crypto from 'crypto';
import { Role } from '../constants/roles';
import { Post } from '../constants/posts';
import AppError from '../utils/appError';
import { hashPassword, verifyPassword } from '../utils/password';
import { hashToken } from '../utils/token';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import {
  createUser,
  ensureUsersTable,
  findByUsername,
  findById,
  listUsers as listUsersRepo,
  saveRefreshToken,
  updateUserCredentialsAndScope,
  User
} from '../repositories/user.repository';
import { initializeCompanies } from './company.service';

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

const issueTokens = async (user: User): Promise<AuthTokens> => {
  const payload = { sub: user.id, username: user.username, role: user.role, post: user.post };
  const refreshToken = signRefreshToken(payload);
  await saveRefreshToken(user.id, hashToken(refreshToken));

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

export const login = async (username: string, password: string) => {
  const normalizedUsername = username.toLowerCase();
  const user = await findByUsername(normalizedUsername);
  if (!user) {
    throw new AppError('Identifiant ou mot de passe invalide', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Identifiant ou mot de passe invalide', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const tokens = await issueTokens(user);
  return { user: { id: user.id, username: user.username, role: user.role, post: user.post }, ...tokens };
};

export const refreshSession = async (token: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }

  const userId = payload.sub as string;
  const user = await findById(userId);
  if (!user || !user.refreshTokenHash) {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }

  if (hashToken(token) !== user.refreshTokenHash) {
    throw new AppError('Session expiree, veuillez vous reconnecter', 401, 'AUTH_SESSION_EXPIRED');
  }

  const tokens = await issueTokens(user);
  return { user: { id: user.id, username: user.username, role: user.role, post: user.post }, ...tokens };
};

export const logout = async (userId: string): Promise<void> => {
  await saveRefreshToken(userId, null);
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
