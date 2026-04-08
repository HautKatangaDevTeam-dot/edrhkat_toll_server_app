import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import AppError from '../utils/appError';
import { captureServerIncident } from '../services/monitoring.service';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND'));
};

// Centralized error handler to keep responses consistent and avoid leaking stack traces.
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  void _next;
  const isPayloadTooLarge =
    'type' in err && typeof err.type === 'string' && err.type === 'entity.too.large';
  const status = isPayloadTooLarge ? 413 : err instanceof AppError ? err.statusCode : 500;
  const message = isPayloadTooLarge
    ? 'Request body exceeds 5mb limit'
    : err instanceof AppError
      ? err.message
      : 'Internal server error';
  const code = isPayloadTooLarge
    ? 'PAYLOAD_TOO_LARGE'
    : err instanceof AppError
      ? err.code
      : 'INTERNAL_ERROR';

  logger.error(message, err);
  if (isPayloadTooLarge) {
    logger.error('Payload too large', {
      method: req.method,
      path: req.originalUrl,
      contentLength: req.headers['content-length'] ?? null,
      contentType: req.headers['content-type'] ?? null,
      requestId: req.headers['x-request-id'] ?? null,
    });
  }
  void captureServerIncident(req, err).catch((captureError) => {
    logger.error('Failed to capture server incident', captureError);
  });
  res.status(status).json({ success: false, message, code });
};
