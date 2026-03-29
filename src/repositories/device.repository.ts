import pool from '../config/database';
import AppError from '../utils/appError';

export type PosDevice = {
  id: string;
  deviceType: string | null;
  label: string | null;
  contactPhone: string | null;
  assignedPost: string | null;
  isActive: boolean;
  lastSeenAt: Date | null;
  lastSyncAt: Date | null;
  createdAt: Date;
};

export type PosDeviceMonitorRow = PosDevice & {
  stale: boolean;
  staleMinutes: number | null;
};

export const ensureDevicesTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pos_devices (
      id VARCHAR(64) PRIMARY KEY,
      device_type VARCHAR(32),
      label VARCHAR(120),
      contact_phone VARCHAR(32),
      assigned_post VARCHAR(64),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ,
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(32);`);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS label VARCHAR(120);`);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32);`);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS assigned_post VARCHAR(64);`);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE pos_devices ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;`);
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

export const markDeviceSync = async (id: string): Promise<void> => {
  await pool.query(
    `UPDATE pos_devices SET last_seen_at = NOW(), last_sync_at = NOW() WHERE id = $1;`,
    [id]
  );
};

export const listDevicesForMonitoring = async (staleMinutes: number): Promise<PosDeviceMonitorRow[]> => {
  const result = await pool.query(
    `
      SELECT
        id,
        device_type,
        label,
        contact_phone,
        assigned_post,
        is_active,
        last_seen_at,
        last_sync_at,
        created_at,
        CASE
          WHEN last_seen_at IS NULL THEN TRUE
          WHEN last_seen_at < NOW() - ($1::text || ' minutes')::interval THEN TRUE
          ELSE FALSE
        END AS stale,
        CASE
          WHEN last_seen_at IS NULL THEN NULL
          ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - last_seen_at)) / 60)
        END AS stale_minutes
      FROM pos_devices
      ORDER BY
        CASE
          WHEN last_seen_at IS NULL THEN 0
          WHEN last_seen_at < NOW() - ($1::text || ' minutes')::interval THEN 1
          ELSE 2
        END,
        COALESCE(last_seen_at, created_at) ASC,
        id ASC;
    `,
    [staleMinutes]
  );

  return result.rows.map((row) => ({
    id: row.id,
    deviceType: row.device_type ?? null,
    label: row.label ?? null,
    contactPhone: row.contact_phone ?? null,
    assignedPost: row.assigned_post ?? null,
    isActive: Boolean(row.is_active),
    lastSeenAt: row.last_seen_at ?? null,
    lastSyncAt: row.last_sync_at ?? null,
    createdAt: row.created_at,
    stale: Boolean(row.stale),
    staleMinutes: row.stale_minutes == null ? null : Number(row.stale_minutes)
  }));
};

export const updateDeviceRegistryEntry = async (
  id: string,
  input: {
    label?: string | null;
    contactPhone?: string | null;
    assignedPost?: string | null;
    isActive?: boolean;
  }
): Promise<PosDevice | null> => {
  const result = await pool.query(
    `
      UPDATE pos_devices
      SET label = $2,
          contact_phone = $3,
          assigned_post = $4,
          is_active = COALESCE($5, is_active)
      WHERE id = $1
      RETURNING *;
    `,
    [
      id,
      input.label?.trim() || null,
      input.contactPhone?.trim() || null,
      input.assignedPost?.trim() || null,
      typeof input.isActive === 'boolean' ? input.isActive : null
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    id: result.rows[0].id,
    deviceType: result.rows[0].device_type ?? null,
    label: result.rows[0].label ?? null,
    contactPhone: result.rows[0].contact_phone ?? null,
    assignedPost: result.rows[0].assigned_post ?? null,
    isActive: Boolean(result.rows[0].is_active),
    lastSeenAt: result.rows[0].last_seen_at ?? null,
    lastSyncAt: result.rows[0].last_sync_at ?? null,
    createdAt: result.rows[0].created_at
  };
};

export const isDeviceActive = async (id: string): Promise<boolean> => {
  const result = await pool.query(
    `SELECT is_active FROM pos_devices WHERE id = $1 LIMIT 1;`,
    [id]
  );
  if (!result.rows[0]) return false;
  return Boolean(result.rows[0].is_active);
};
