import { NextFunction, Request, Response } from 'express';
import { getRevenueTimeSeries } from '../services/dashboardTimeseries.service';
import AppError from '../utils/appError';
import { Role } from '../constants/roles';
import { Post } from '../constants/posts';

export const revenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.role) {
      throw new AppError('Unauthorized', 401);
    }
    const days = (req.query.days as any) ?? 30;
    const granularity = (req.query.granularity as 'day' | 'week') ?? 'day';
    const data = await getRevenueTimeSeries(
      req.user.role as Role,
      req.user.post as Post | undefined,
      Number(days),
      granularity
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
