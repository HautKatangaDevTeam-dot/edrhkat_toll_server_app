import type { StringValue } from 'ms';
import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import env from '../config/env';

type Payload = {
  sub: string;
  username: string;
  role: string;
  post: string;
};

const accessOptions: SignOptions = { expiresIn: env.jwt.accessExpiresIn as StringValue | number };
const refreshOptions: SignOptions = { expiresIn: env.jwt.refreshExpiresIn as StringValue | number };

export const signAccessToken = (payload: Payload): string =>
  jwt.sign(payload, env.jwt.accessSecret as Secret, accessOptions);

export const signRefreshToken = (payload: Payload): string =>
  jwt.sign(payload, env.jwt.refreshSecret as Secret, refreshOptions);

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwt.accessSecret as Secret) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwt.refreshSecret as Secret) as JwtPayload;
