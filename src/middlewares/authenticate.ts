import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { verifyAccessToken } from '../utils/jwt';
import { findById } from '../repositories/user.repository';
import { getAccessTokenFromCookies } from '../utils/authCookies';

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
    const cookieToken = getAccessTokenFromCookies(req);
    const token = bearerToken ?? cookieToken;

    if (!token) {
      throw new AppError('Unauthorized', 401, 'AUTH_UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);
    const userId = payload.sub as string;

    const user = await findById(userId);
    if (!user) {
      throw new AppError('Unauthorized', 401, 'AUTH_UNAUTHORIZED');
    }

    req.user = { id: user.id, username: user.username, role: user.role, post: user.post };
    req.token = token;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Unauthorized', 401, 'AUTH_UNAUTHORIZED'));
  }
};
