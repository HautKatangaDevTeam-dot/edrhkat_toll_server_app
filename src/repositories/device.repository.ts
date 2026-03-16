import pool from '../config/database';
import AppError from '../utils/appError';

export type PosDevice = {
  id: string;
  deviceType: string | null;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
};

export const ensureDevicesTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pos_devices (
      id VARCHAR(64) PRIMARY KEY,
      device_type VARCHAR(32),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(32);`);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;`);
};

export const upsertDevice = async (id: string, deviceType?: string | null): Promise<void> => {
  const normalizedType = deviceType?.trim() || null;
  const existing = await pool.query(
    `SELECT id, device_type FROM pos_devices WHERE id = $1 LIMIT 1;`,
    [id]
  );

  if (existing.rows[0]) {
    const currentType = (existing.rows[0].device_type as string | null) ?? null;
    if (currentType && normalizedType && currentType !== normalizedType) {
      throw new AppError('Device type mismatch', 409, 'DEVICE_TYPE_MISMATCH');
    }
    await pool.query(
      `
        UPDATE pos_devices
        SET device_type = COALESCE(device_type, $2),
            last_seen_at = NOW()
        WHERE id = $1;
      `,
      [id, normalizedType]
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO pos_devices (id, device_type, is_active, last_seen_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (id) DO NOTHING;
    `,
    [id, normalizedType]
  );
};

export const touchDevice = async (id: string): Promise<void> => {
  await pool.query(`UPDATE pos_devices SET last_seen_at = NOW() WHERE id = $1;`, [id]);
};

export const isDeviceActive = async (id: string): Promise<boolean> => {
  const result = await pool.query(
    `SELECT is_active FROM pos_devices WHERE id = $1 LIMIT 1;`,
    [id]
  );
  if (!result.rows[0]) return false;
  return Boolean(result.rows[0].is_active);
};
