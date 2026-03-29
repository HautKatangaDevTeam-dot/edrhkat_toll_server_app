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

export const heartbeatDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { device_id, device_type } = req.body as {
      device_id: string;
      device_type?: string;
    };
    const result = await posService.heartbeatPosDevice(device_id, device_type);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const listDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staleMinutes = Number((req.query as Record<string, string | undefined>).stale_minutes ?? '60');
    const result = await posService.listPosDevices(staleMinutes);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { label, contact_phone, assigned_post, is_active } = req.body as Record<string, unknown>;
    const result = await posService.updatePosDevice(req.params.id, {
      label: typeof label === 'string' ? label : null,
      contactPhone: typeof contact_phone === 'string' ? contact_phone : null,
      assignedPost: typeof assigned_post === 'string' ? assigned_post : null,
      isActive: typeof is_active === 'boolean' ? is_active : undefined
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getKeyBundle = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await posService.getCentralKeyBundle();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const listKeyRegistry = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await posService.listCentralKeyRegistry();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const publishKeyBundle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bundle_json } = req.body as { bundle_json: string };
    const result = await posService.publishCentralKeyBundle({
      bundleJson: bundle_json,
      updatedByUserId: req.user?.id ?? null,
      updatedByUsername: req.user?.username ?? null
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};
