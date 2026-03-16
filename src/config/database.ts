import { Pool } from 'pg';
import env from './env';

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined
});

export const verifyDatabaseConnection = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

export default pool;
