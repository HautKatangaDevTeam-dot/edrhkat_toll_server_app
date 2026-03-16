import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import logger from '../config/logger';

export const validateRequest =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      const issues = result.error.issues;
      const errors = issues.map((issue: any) => {
        const path = issue.path?.length ? ` (${issue.path.join('.')})` : '';
        return `${issue.message}${path}`;
      });
      logger.error('Request validation failed', {
        path: req.path,
        errors,
        body: req.body,
        query: req.query,
        params: req.params
      });
      res.status(400).json({
        success: false,
        message: errors.join('; '),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    next();
  };
