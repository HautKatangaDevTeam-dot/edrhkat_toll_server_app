import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest';
import {
  posCompaniesSinceSchema,
  posHeartbeatSchema,
  posSyncSchema,
  listTollTransactionsSchema,
  listPosDevicesSchema,
  updatePosDeviceSchema,
  publishKeyBundleSchema
} from '../schemas/pos.schema';
import * as posController from '../controllers/pos.controller';
import * as tollController from '../controllers/toll.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

const router = Router();
const transactionReadRoles = ['ADMIN_SYSTEME', 'SUPERVISEUR'] as const;
const readRoles = ['ADMIN_SYSTEME'] as const;
const posRoles = ['ADMIN_SYSTEME', 'AGENT_BUREAU', 'AGENT_TOLL'] as const;
const tollRoles = ['ADMIN_SYSTEME', 'AGENT_TOLL'] as const;

router.post(
  '/heartbeat',
  authenticate,
  authorize(...posRoles),
  validateRequest(posHeartbeatSchema),
  posController.heartbeatDevice
);
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
  authorize(...transactionReadRoles),
  validateRequest(listTollTransactionsSchema),
  tollController.listTransactions
);
router.get(
  '/devices',
  authenticate,
  authorize(...readRoles),
  validateRequest(listPosDevicesSchema),
  posController.listDevices
);
router.patch(
  '/devices/:id',
  authenticate,
  authorize(...readRoles),
  validateRequest(updatePosDeviceSchema),
  posController.updateDevice
);
router.get(
  '/key-bundle',
  authenticate,
  authorize(...posRoles),
  posController.getKeyBundle
);
router.get(
  '/key-registry',
  authenticate,
  authorize(...readRoles),
  posController.listKeyRegistry
);
router.put(
  '/key-bundle',
  authenticate,
  authorize(...posRoles),
  validateRequest(publishKeyBundleSchema),
  posController.publishKeyBundle
);

export default router;
