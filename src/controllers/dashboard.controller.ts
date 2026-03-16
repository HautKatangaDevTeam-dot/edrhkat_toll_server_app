import { NextFunction, Request, Response } from 'express';
import { getDashboardSummary } from '../services/dashboard.service';
import { Role } from '../constants/roles';
import { Post } from '../constants/posts';
import AppError from '../utils/appError';

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.role) {
      throw new AppError('Unauthorized', 401);
    }
    const days = (req.query.days as any) ?? 7;
    const summary = await getDashboardSummary(
      req.user.role as Role,
      req.user.post as Post | undefined,
      Number(days)
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};
