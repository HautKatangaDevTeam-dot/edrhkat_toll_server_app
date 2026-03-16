import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import AppError from '../utils/appError';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND'));
};

// Centralized error handler to keep responses consistent and avoid leaking stack traces.
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal server error';
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';

  logger.error(message, err);
  res.status(status).json({ success: false, message, code });
};
