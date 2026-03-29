import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { Role } from '../constants/roles';

// Simple role guard: only allow if user's role is in the allowed list.
export const authorize =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.role || !allowed.includes(req.user.role as Role)) {
      next(
        new AppError('Forbidden', 403, 'AUTH_FORBIDDEN', {
          requiredRoles: allowed,
          currentRole: req.user?.role ?? null
        })
      );
      return;
    }
    next();
  };
