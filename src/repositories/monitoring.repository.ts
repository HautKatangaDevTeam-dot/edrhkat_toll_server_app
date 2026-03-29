import pool from '../config/database';

export type ServerIncidentSeverity = 'error' | 'warning';
export type ServerIncidentStatus = 'active' | 'resolved';

export type ServerIncidentRow = {
  id: string;
  fingerprint: string;
  severity: ServerIncidentSeverity;
  status: ServerIncidentStatus;
  source: string;
  code: string | null;
  message: string;
  normalized_path: string | null;
  method: string | null;
  last_http_status: number | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_user_id: string | null;
  last_username: string | null;
  last_device_id: string | null;
  sample_details: unknown;
  sample_stack: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolved_by_username: string | null;
};

export const ensureMonitoringTables = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_incidents (
      id UUID PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      severity TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
      status TEXT NOT NULL CHECK (status IN ('active', 'resolved')) DEFAULT 'active',
      source TEXT NOT NULL,
      code TEXT,
      message TEXT NOT NULL,
      normalized_path TEXT,
      method TEXT,
      last_http_status INTEGER,
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_user_id UUID,
      last_username TEXT,
      last_device_id TEXT,
      sample_details JSONB,
      sample_stack TEXT,
      resolved_at TIMESTAMPTZ,
      resolved_by_user_id UUID,
      resolved_by_username TEXT
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_server_incidents_status_last_seen
    ON server_incidents (status, last_seen_at DESC);
  `);
};

export const upsertServerIncident = async (input: {
  id: string;
  fingerprint: string;
  severity: ServerIncidentSeverity;
  source: string;
  code?: string | null;
  message: string;
  normalizedPath?: string | null;
  method?: string | null;
  httpStatus?: number | null;
  userId?: string | null;
  username?: string | null;
  deviceId?: string | null;
  details?: unknown;
  stack?: string | null;
}): Promise<void> => {
  await pool.query(
    `
      INSERT INTO server_incidents (
        id,
        fingerprint,
        severity,
        status,
        source,
        code,
        message,
        normalized_path,
        method,
        last_http_status,
        occurrence_count,
        first_seen_at,
        last_seen_at,
        last_user_id,
        last_username,
        last_device_id,
        sample_details,
        sample_stack,
        resolved_at,
        resolved_by_user_id,
        resolved_by_username
      )
      VALUES (
        $1,$2,$3,'active',$4,$5,$6,$7,$8,$9,1,NOW(),NOW(),$10,$11,$12,$13::jsonb,$14,NULL,NULL,NULL
      )
      ON CONFLICT (fingerprint)
      DO UPDATE SET
        severity = EXCLUDED.severity,
        status = 'active',
        code = EXCLUDED.code,
        message = EXCLUDED.message,
        normalized_path = EXCLUDED.normalized_path,
        method = EXCLUDED.method,
        last_http_status = EXCLUDED.last_http_status,
        occurrence_count = server_incidents.occurrence_count + 1,
        last_seen_at = NOW(),
        last_user_id = EXCLUDED.last_user_id,
        last_username = EXCLUDED.last_username,
        last_device_id = EXCLUDED.last_device_id,
        sample_details = EXCLUDED.sample_details,
        sample_stack = EXCLUDED.sample_stack,
        resolved_at = NULL,
        resolved_by_user_id = NULL,
        resolved_by_username = NULL;
    `,
    [
      input.id,
      input.fingerprint,
      input.severity,
      input.source,
      input.code ?? null,
      input.message,
      input.normalizedPath ?? null,
      input.method ?? null,
      input.httpStatus ?? null,
      input.userId ?? null,
      input.username ?? null,
      input.deviceId ?? null,
      JSON.stringify(input.details ?? null),
      input.stack ?? null
    ]
  );
};

export const listServerIncidents = async (input: {
  status: ServerIncidentStatus | 'all';
  limit: number;
}): Promise<ServerIncidentRow[]> => {
  const params: Array<string | number> = [];
  let whereClause = '';
  if (input.status !== 'all') {
    params.push(input.status);
    whereClause = `WHERE status = $${params.length}`;
  }
  params.push(input.limit);

  const result = await pool.query<ServerIncidentRow>(
    `
      SELECT *
      FROM server_incidents
      ${whereClause}
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        last_seen_at DESC
      LIMIT $${params.length};
    `,
    params
  );
  return result.rows;
};

export const summarizeServerIncidents = async (): Promise<{
  activeCount: number;
  resolvedCount: number;
  criticalCount: number;
}> => {
  const result = await pool.query<{
    active_count: string;
    resolved_count: string;
    critical_count: string;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS active_count,
      COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
      COUNT(*) FILTER (WHERE status = 'active' AND severity = 'error') AS critical_count
    FROM server_incidents;
  `);

  return {
    activeCount: Number(result.rows[0]?.active_count ?? 0),
    resolvedCount: Number(result.rows[0]?.resolved_count ?? 0),
    criticalCount: Number(result.rows[0]?.critical_count ?? 0)
  };
};

export const resolveServerIncident = async (input: {
  id: string;
  resolvedByUserId?: string | null;
  resolvedByUsername?: string | null;
}): Promise<ServerIncidentRow | null> => {
  const result = await pool.query<ServerIncidentRow>(
    `
      UPDATE server_incidents
      SET
        status = 'resolved',
        resolved_at = NOW(),
        resolved_by_user_id = $2,
        resolved_by_username = $3
      WHERE id = $1
      RETURNING *;
    `,
    [input.id, input.resolvedByUserId ?? null, input.resolvedByUsername ?? null]
  );
  return result.rows[0] ?? null;
};
