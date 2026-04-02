import { NextFunction, Request, Response } from 'express';
import { Role } from '../constants/roles';
import { Post } from '../constants/posts';
import * as tollService from '../services/toll.service';
import * as receiptService from '../services/receipt.service';
import AppError from '../utils/appError';
import { parseDateFromQuery } from '../utils/dateRange';

export const transactionsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.role) {
      throw new AppError('Unauthorized', 401);
    }
    const { search, company_id, post_id, payment_mode, date_from, date_to, limit } = req.query as Record<
      string,
      string | undefined
    >;

    const alwaysScopedRoles: Role[] = [];
    const role = req.user.role as Role;
    const scopedPost =
      (post_id as Post | undefined) ??
      (alwaysScopedRoles.includes(role) ? ((req.user.post as Post | undefined) ?? undefined) : undefined);
    const pageSize = Number(limit) || 500;

    const result = await tollService.listTransactions({
      search,
      companyId: company_id,
      postId: scopedPost,
      paymentMode: payment_mode,
      startDate: parseDateFromQuery(date_from, 'start'),
      endDate: parseDateFromQuery(date_to, 'end'),
      page: 1,
      pageSize
    });

    res.json({
      success: true,
      ...result,
      page: 1,
      pageSize,
      scopedPost: scopedPost ?? null,
      meta: {
        report_type: 'transactions',
        version: '1.0',
        generation_timestamp: new Date().toISOString(),
        requested_by: req.user
          ? { id: req.user.id, username: req.user.username, role: req.user.role, post: req.user.post }
          : null,
        filters: {
          date_from: date_from ?? null,
          date_to: date_to ?? null,
          post_id: scopedPost ?? null,
          company_id: company_id ?? null,
          payment_mode: payment_mode ?? null,
          search: search ?? null,
          limit: pageSize
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const receiptsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.role) {
      throw new AppError('Unauthorized', 401);
    }

    const role = req.user.role as Role;
    const { search, company_id, post_id, financial_mode, channel, family, date_from, date_to, limit } = req.query as Record<
      string,
      string | undefined
    >;
    const enforcedFinancialView = role === 'SUPERVISEUR';

    const pageSize = Number(limit) || 500;
    const result = await receiptService.listReceiptsReport({
      search,
      companyId: enforcedFinancialView ? undefined : company_id,
      postId: post_id,
      financialMode: financial_mode as any,
      channel: enforcedFinancialView ? undefined : (channel as any),
      family: enforcedFinancialView
        ? 'financial'
        : ((family as 'financial' | 'passage' | undefined) ?? 'financial'),
      startDate: parseDateFromQuery(date_from, 'start'),
      endDate: parseDateFromQuery(date_to, 'end'),
      page: 1,
      pageSize
    });

    res.json({
      success: true,
      ...result,
      page: 1,
      pageSize,
      meta: {
        report_type: 'receipts',
        version: '1.0',
        generation_timestamp: new Date().toISOString(),
        requested_by: req.user
          ? { id: req.user.id, username: req.user.username, role: req.user.role, post: req.user.post }
          : null,
        filters: {
          date_from: date_from ?? null,
          date_to: date_to ?? null,
          post_id: post_id ?? null,
          company_id: enforcedFinancialView ? null : (company_id ?? null),
          financial_mode: financial_mode ?? null,
          channel: enforcedFinancialView ? null : (channel ?? null),
          family: enforcedFinancialView ? 'financial' : (family ?? 'financial'),
          search: search ?? null,
          limit: pageSize
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
