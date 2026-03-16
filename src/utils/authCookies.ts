import { Request, Response } from 'express';
import env from '../config/env';

const MOBILE_CLIENT_VALUE = 'mobile';

const parseCookieHeader = (header: string | undefined): Record<string, string> => {
  if (!header) return {};

  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey || rawValue.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
};

const parseDurationToMs = (value: string): number | undefined => {
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor =
    unit === 'ms'
      ? 1
      : unit === 's'
        ? 1000
        : unit === 'm'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : 86_400_000;

  return amount * factor;
};

const buildCookieOptions = (maxAge: number | undefined) => ({
  httpOnly: true,
  secure: env.authCookies.secure,
  sameSite: env.authCookies.sameSite,
  domain: env.authCookies.domain || undefined,
  path: '/',
  ...(maxAge ? { maxAge } : {})
});

export const isMobileClient = (req: Request): boolean =>
  req.get('x-client-type')?.toLowerCase() === MOBILE_CLIENT_VALUE;

export const getCookie = (req: Request, name: string): string | undefined =>
  parseCookieHeader(req.headers.cookie)[name];

export const getAccessTokenFromCookies = (req: Request): string | undefined =>
  getCookie(req, env.authCookies.accessName);

export const getRefreshTokenFromCookies = (req: Request): string | undefined =>
  getCookie(req, env.authCookies.refreshName);

export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
): void => {
  const accessMaxAge = parseDurationToMs(env.jwt.accessExpiresIn);
  const refreshMaxAge = parseDurationToMs(env.jwt.refreshExpiresIn);

  res.cookie(
    env.authCookies.accessName,
    tokens.accessToken,
    buildCookieOptions(accessMaxAge)
  );
  res.cookie(
    env.authCookies.refreshName,
    tokens.refreshToken,
    buildCookieOptions(refreshMaxAge)
  );
};

export const clearAuthCookies = (res: Response): void => {
  const options = buildCookieOptions(undefined);
  res.clearCookie(env.authCookies.accessName, options);
  res.clearCookie(env.authCookies.refreshName, options);
};
