import { NextFunction, Request, Response } from "express";
import * as posService from "../services/pos.service";
import AppError from "../utils/appError";
import logger from "../config/logger";

export const syncTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info("POS sync request", {
      path: req.path,
      device_id: (req.body as any)?.device_id,
      tx_count: Array.isArray((req.body as any)?.transactions)
        ? (req.body as any).transactions.length
        : Array.isArray(req.body)
        ? (req.body as any).length
        : 0,
      payload: JSON.stringify(req.body)
    });
    const payload = Array.isArray(req.body)
      ? {
          device_id: "legacy-device",
          last_sync_at: undefined,
          transactions: req.body,
        }
      : req.body;

    if (!payload.device_id) {
      throw new AppError("device_id is required", 400);
    }

    const result = await posService.processTransactions(
      payload.device_id,
      payload.last_sync_at ? new Date(payload.last_sync_at) : undefined,
      payload.transactions,
      payload.device_type
    );

    logger.info("POS sync response", result);
    res.json(result);
  } catch (error) {
    console.error("Error in syncTransactions:", error);
    next(error);
  }
};

export const listCompaniesSince = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawSince = req.query.since as string | undefined;
    const since = rawSince ? new Date(rawSince) : undefined;
    const result = await posService.listCompaniesSince(since);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
