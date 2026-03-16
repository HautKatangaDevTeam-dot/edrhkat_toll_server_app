import app from './app';
import env from './config/env';
import logger from './config/logger';
import { verifyDatabaseConnection } from './config/database';
import { initializeAuth } from './services/auth.service';
import { initializeCompanies } from './services/company.service';
import { initializePos } from './services/pos.service';

const startServer = async () => {
  try {
    await verifyDatabaseConnection();
    logger.info('Database connected');
    await initializeAuth();
    logger.info('Auth module initialized');
    await initializeCompanies();
    logger.info('Company and receipt modules initialized');
    await initializePos();
    logger.info('POS module initialized');

    const server = app.listen(env.port, () => {
      logger.info(`Server running at http://localhost:${env.port}`);
    });

    const shutdown = (signal: NodeJS.Signals) => {
      logger.warn(`${signal} received, shutting down gracefully`);
      server.close(() => process.exit(0));
    };

    ['SIGTERM', 'SIGINT'].forEach((signal) => {
      process.on(signal, shutdown);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

void startServer();
