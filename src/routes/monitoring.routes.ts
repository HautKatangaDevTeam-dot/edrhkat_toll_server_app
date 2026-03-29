import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateRequest } from '../middlewares/validateRequest';
import * as monitoringController from '../controllers/monitoring.controller';
import { incidentIdSchema, listIncidentsSchema } from '../schemas/monitoring.schema';

const router = Router();
const readRoles = ['ADMIN_SYSTEME', 'SUPERVISEUR'] as const;

router.get(
  '/incidents',
  authenticate,
  authorize(...readRoles),
  validateRequest(listIncidentsSchema),
  monitoringController.listIncidents
);

router.patch(
  '/incidents/:id/resolve',
  authenticate,
  authorize(...readRoles),
  validateRequest(incidentIdSchema),
  monitoringController.resolveIncident
);

export default router;
