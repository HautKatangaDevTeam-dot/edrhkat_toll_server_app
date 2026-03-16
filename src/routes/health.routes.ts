import { Router } from 'express';
import { verifyDatabaseConnection } from '../config/database';

const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    await verifyDatabaseConnection();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    next(error);
  }
});

export default healthRouter;
