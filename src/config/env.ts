import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error('PORT must be a valid positive number');
}

const parseOrigins = (raw: string | undefined): string[] => {
  if (!raw) return ['*'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
};

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  databaseUrl: process.env.DATABASE_URL as string,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS),
  authCookies: {
    accessName: process.env.AUTH_ACCESS_COOKIE_NAME ?? 'edrhk_at_access',
    refreshName: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'edrhk_at_refresh',
    domain: process.env.AUTH_COOKIE_DOMAIN,
    secure:
      process.env.AUTH_COOKIE_SECURE != null
        ? process.env.AUTH_COOKIE_SECURE === 'true'
        : (process.env.NODE_ENV ?? 'development') === 'production',
    sameSite:
      (process.env.AUTH_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ??
      ((process.env.NODE_ENV ?? 'development') === 'production' ? 'none' : 'lax')
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'
  },
  receiptBatchQrSecret: process.env.RECEIPT_BATCH_QR_SECRET ?? process.env.JWT_ACCESS_SECRET as string
};

export default env;
