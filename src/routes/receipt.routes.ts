import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateRequest } from '../middlewares/validateRequest';
import * as receiptController from '../controllers/receipt.controller';
import {
  batchConsumeSchema,
  batchConsumeSyncSchema,
  batchLookupSchema,
  batchSyncSchema,
  correctReceiptBatchCompanySchema,
  createReceiptBatchSchema,
  listBatchReceiptsSchema,
  listReceiptBatchesSchema,
  receiptBatchIdSchema,
  receiptConsumeSyncSchema,
  receiptLookupSchema,
  receiptConsumeSchema
} from '../schemas/receipt.schema';

const router = Router();
const readRoles = ['ADMIN_SYSTEME', 'AGENT_BUREAU'] as const;
const issueRoles = ['ADMIN_SYSTEME', 'AGENT_BUREAU'] as const;
const lookupRoles = ['ADMIN_SYSTEME', 'AGENT_TOLL'] as const;
const receiptLookupRoles = ['ADMIN_SYSTEME', 'SUPERVISEUR', 'AGENT_BUREAU', 'AGENT_TOLL'] as const;
const consumeRoles = ['ADMIN_SYSTEME', 'AGENT_TOLL'] as const;
const correctionRoles = ['ADMIN_SYSTEME'] as const;

router.post(
  '/batches',
  authenticate,
  authorize(...issueRoles),
  validateRequest(createReceiptBatchSchema),
  receiptController.createBatch
);

router.get(
  '/batches',
  authenticate,
  authorize(...readRoles),
  validateRequest(listReceiptBatchesSchema),
  receiptController.listBatches
);

router.get(
  '/batches/sync',
  authenticate,
  authorize(...consumeRoles),
  validateRequest(batchSyncSchema),
  receiptController.syncBatches
);

router.get(
  '/batches/lookup',
  authenticate,
  authorize(...lookupRoles),
  validateRequest(batchLookupSchema),
  receiptController.lookupBatch
);

router.post(
  '/batches/consume/sync',
  authenticate,
  authorize(...consumeRoles),
  validateRequest(batchConsumeSyncSchema),
  receiptController.syncBatchConsumptions
);

router.post(
  '/batches/consume',
  authenticate,
  authorize(...consumeRoles),
  validateRequest(batchConsumeSchema),
  receiptController.consumeBatch
);

router.get(
  '/batches/:id',
  authenticate,
  authorize(...readRoles),
  validateRequest(receiptBatchIdSchema),
  receiptController.getBatch
);

router.post(
  '/batches/:id/correct-company',
  authenticate,
  authorize(...correctionRoles),
  validateRequest(correctReceiptBatchCompanySchema),
  receiptController.correctBatchCompany
);

router.get(
  '/batches/:id/receipts',
  authenticate,
  authorize(...readRoles),
  validateRequest(listBatchReceiptsSchema),
  receiptController.listReceipts
);

router.get(
  '/lookup',
  authenticate,
  authorize(...receiptLookupRoles),
  validateRequest(receiptLookupSchema),
  receiptController.lookupReceipt
);

router.post(
  '/consume/sync',
  authenticate,
  authorize(...consumeRoles),
  validateRequest(receiptConsumeSyncSchema),
  receiptController.syncReceiptConsumptions
);

router.post(
  '/consume',
  authenticate,
  authorize(...consumeRoles),
  validateRequest(receiptConsumeSchema),
  receiptController.consumeReceipt
);

export default router;
