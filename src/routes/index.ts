import { Router } from 'express';
import healthRouter from './health.routes';
import authRouter from './auth.routes';
import companyRouter from './company.routes';
import posRouter from './pos.routes';
import dashboardRouter from './dashboard.routes';
import reportRouter from './report.routes';
import receiptRouter from './receipt.routes';
import monitoringRouter from './monitoring.routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/companies', companyRouter);
router.use('/pos', posRouter);
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportRouter);
router.use('/receipts', receiptRouter);
router.use('/monitoring', monitoringRouter);

export default router;
