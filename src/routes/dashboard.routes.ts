import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateRequest } from '../middlewares/validateRequest';
import { dashboardSummarySchema } from '../schemas/dashboard.schema';
import * as dashboardController from '../controllers/dashboard.controller';
import { revenueTimeSeriesSchema } from '../schemas/dashboardTimeseries.schema';
import * as dashboardTimeseriesController from '../controllers/dashboardTimeseries.controller';

const router = Router();
const readRoles = ['ADMIN_SYSTEME', 'SUPERVISEUR'] as const;

router.get(
  '/summary',
  authenticate,
  authorize(...readRoles),
  validateRequest(dashboardSummarySchema),
  dashboardController.getSummary
);

router.get(
  '/timeseries/revenue',
  authenticate,
  authorize(...readRoles),
  validateRequest(revenueTimeSeriesSchema),
  dashboardTimeseriesController.revenue
);

export default router;
