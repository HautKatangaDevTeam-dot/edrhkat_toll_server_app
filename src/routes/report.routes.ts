import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateRequest } from '../middlewares/validateRequest';
import { reportReceiptsSchema, reportTransactionsSchema } from '../schemas/report.schema';
import * as reportController from '../controllers/report.controller';

const router = Router();
const readRoles = ['ADMIN_SYSTEME', 'SUPERVISEUR'] as const;

router.get(
  '/transactions',
  authenticate,
  authorize('ADMIN_SYSTEME'),
  validateRequest(reportTransactionsSchema),
  reportController.transactionsReport
);

router.get(
  '/receipts',
  authenticate,
  authorize(...readRoles),
  validateRequest(reportReceiptsSchema),
  reportController.receiptsReport
);

export default router;
