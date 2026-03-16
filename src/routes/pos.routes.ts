import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest';
import { posCompaniesSinceSchema, posSyncSchema, listTollTransactionsSchema } from '../schemas/pos.schema';
import * as posController from '../controllers/pos.controller';
import * as tollController from '../controllers/toll.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

const router = Router();
const readRoles = ['ADMIN_SYSTEME', 'SUPERVISEUR'] as const;
const posRoles = ['ADMIN_SYSTEME', 'AGENT_BUREAU', 'AGENT_TOLL'] as const;
const tollRoles = ['ADMIN_SYSTEME', 'AGENT_TOLL'] as const;

router.post(
  '/transaction',
  authenticate,
  authorize(...tollRoles),
  validateRequest(posSyncSchema),
  posController.syncTransactions
);
router.get(
  '/companies',
  authenticate,
  authorize(...posRoles),
  validateRequest(posCompaniesSinceSchema),
  posController.listCompaniesSince
);
router.get(
  '/transactions',
  authenticate,
  authorize(...readRoles),
  validateRequest(listTollTransactionsSchema),
  tollController.listTransactions
);

export default router;
