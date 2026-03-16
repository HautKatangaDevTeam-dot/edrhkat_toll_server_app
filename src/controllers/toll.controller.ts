import { NextFunction, Request, Response } from 'express';
import * as tollService from '../services/toll.service';
import { parseDateFromQuery } from '../utils/dateRange';

export const listTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, company_id, post_id, payment_mode, date_from, date_to, page = '1', pageSize = '10' } =
      req.query as Record<string, string | undefined>;

    const result = await tollService.listTransactions({
      search,
      companyId: company_id,
      postId: post_id,
      paymentMode: payment_mode,
      startDate: parseDateFromQuery(date_from, 'start'),
      endDate: parseDateFromQuery(date_to, 'end'),
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 10
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
