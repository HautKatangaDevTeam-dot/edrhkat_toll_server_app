import { NextFunction, Request, Response } from 'express';
import * as monitoringService from '../services/monitoring.service';

export const listIncidents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = 'active', limit = '20' } = req.query as Record<string, string | undefined>;
    const result = await monitoringService.getIncidentFeed({
      status: status === 'resolved' || status === 'all' ? status : 'active',
      limit: Number(limit) || 20
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const resolveIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await monitoringService.resolveIncident({
      id: req.params.id,
      resolvedByUserId: req.user?.id ?? null,
      resolvedByUsername: req.user?.username ?? null
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
