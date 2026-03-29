import crypto from 'crypto';
import type { Request } from 'express';
import AppError from '../utils/appError';
import {
  ensureMonitoringTables,
  listServerIncidents,
  resolveServerIncident,
  summarizeServerIncidents,
  upsertServerIncident
} from '../repositories/monitoring.repository';

const normalizePath = (rawPath?: string | null): string | null => {
  if (!rawPath || !rawPath.trim()) {
    return null;
  }

  return rawPath
    .trim()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':uuid')
    .replace(/\b\d+\b/g, ':id');
};

const fingerprintForIncident = (input: {
  code: string;
  message: string;
  method?: string | null;
  normalizedPath?: string | null;
  source: string;
}): string => {
  return crypto
    .createHash('sha256')
    .update(
      [
        input.source,
        input.code.trim().toUpperCase(),
        input.message.trim(),
        (input.method ?? '').trim().toUpperCase(),
        (input.normalizedPath ?? '').trim().toLowerCase()
      ].join('|')
    )
    .digest('hex');
};

export const initializeMonitoring = async (): Promise<void> => {
  await ensureMonitoringTables();
};

export const captureServerIncident = async (
  req: Request | null,
  err: Error
): Promise<void> => {
  const appError = err instanceof AppError ? err : null;
  const code = appError?.code ?? 'INTERNAL_ERROR';
  const message = appError?.message ?? err.message ?? 'Internal server error';
  const statusCode = appError?.statusCode ?? 500;
  if (statusCode < 500) {
    return;
  }
  const normalizedPath = normalizePath(req?.originalUrl ?? req?.path ?? null);
  const method = req?.method ?? null;
  const fingerprint = fingerprintForIncident({
    source: 'api',
    code,
    message,
    method,
    normalizedPath
  });

  await upsertServerIncident({
    id: crypto.randomUUID(),
    fingerprint,
    severity: statusCode >= 500 ? 'error' : 'warning',
    source: 'api',
    code,
    message,
    normalizedPath,
    method,
    httpStatus: statusCode,
    userId: req?.user?.id ?? null,
    username: req?.user?.username ?? null,
    deviceId:
      typeof req?.body?.device_id === 'string'
        ? req.body.device_id
        : typeof req?.headers['x-device-id'] === 'string'
          ? req.headers['x-device-id']
          : null,
    details: appError?.details ?? null,
    stack: err.stack ?? null
  });
};

export const getIncidentFeed = async (input: {
  status: 'active' | 'resolved' | 'all';
  limit: number;
}) => {
  const [data, summary] = await Promise.all([
    listServerIncidents(input),
    summarizeServerIncidents()
  ]);

  return {
    data,
    summary
  };
};

export const resolveIncident = async (input: {
  id: string;
  resolvedByUserId?: string | null;
  resolvedByUsername?: string | null;
}) => {
  const incident = await resolveServerIncident(input);
  if (!incident) {
    throw new AppError('Incident not found', 404, 'INCIDENT_NOT_FOUND');
  }
  return incident;
};
