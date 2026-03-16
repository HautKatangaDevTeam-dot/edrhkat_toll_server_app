import pool from '../config/database';
import { POSTS } from '../constants/posts';

export type TollTransaction = {
  id: string;
  deviceId: string;
  localId: string;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;
  amountUsd: number;
  amountDue: number | null;
  amountPaid: number | null;
  paymentMode: string;
  overrideUsed: boolean;
  postId: string;
  vehiclePlate: string | null;
  taxType: string | null;
  provenance: string | null;
  destination: string | null;
  agentId: string | null;
  agentName: string | null;
  transactionDate: Date | null;
  carrierName: string | null;
  keyId: string | null;
  signature: string | null;
  createdAtLocal: Date | null;
  updatedAtLocal: Date | null;
  walletSnapshotBefore: number | null;
  walletSnapshotAfter: number | null;
  negativeLimitAtTime: number | null;
  exceptionalIssue: boolean;
  exceptionReason: string | null;
  createdAt: Date;
};

const mapRow = (row: any): TollTransaction => ({
  id: row.id,
  deviceId: row.device_id,
  localId: row.local_id,
  companyId: row.company_id,
  companyCode: row.company_code ?? null,
  companyName: row.company_name ?? null,
  amountUsd: Number(row.amount_usd),
  amountDue: row.amount_due !== null ? Number(row.amount_due) : null,
  amountPaid: row.amount_paid !== null ? Number(row.amount_paid) : null,
  paymentMode: row.payment_mode,
  overrideUsed: row.override_used,
  postId: row.post_id,
  vehiclePlate: row.vehicle_plate,
  taxType: row.tax_type,
  provenance: row.provenance,
  destination: row.destination,
  agentId: row.agent_id,
  agentName: row.agent_name,
  transactionDate: row.transaction_date,
  carrierName: row.carrier_name,
  keyId: row.key_id,
  signature: row.signature,
  createdAtLocal: row.created_at_local,
  updatedAtLocal: row.updated_at_local,
  walletSnapshotBefore: row.wallet_snapshot_before !== null ? Number(row.wallet_snapshot_before) : null,
  walletSnapshotAfter: row.wallet_snapshot_after !== null ? Number(row.wallet_snapshot_after) : null,
  negativeLimitAtTime: row.negative_limit_at_time !== null ? Number(row.negative_limit_at_time) : null,
  exceptionalIssue: row.exceptional_issue ?? false,
  exceptionReason: row.exception_reason ?? null,
  createdAt: row.created_at
});

export const ensureTollTransactionsTable = async (): Promise<void> => {
  const allowedPosts = POSTS.map((p) => `'${p}'`).join(',');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS toll_transactions (
      id UUID PRIMARY KEY,
      device_id VARCHAR(64) NOT NULL,
      local_id UUID NOT NULL,
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      company_code VARCHAR(64),
      company_name VARCHAR(255),
      amount_usd NUMERIC(18,2) NOT NULL,
      amount_due NUMERIC(18,2),
      amount_paid NUMERIC(18,2),
      payment_mode VARCHAR(32) NOT NULL,
      override_used BOOLEAN NOT NULL DEFAULT FALSE,
      post_id VARCHAR(50) NOT NULL,
      vehicle_plate VARCHAR(32),
      tax_type VARCHAR(16),
      provenance VARCHAR(120),
      destination VARCHAR(120),
      agent_id UUID,
      agent_name VARCHAR(120),
      transaction_date TIMESTAMPTZ,
      carrier_name VARCHAR(120),
      key_id VARCHAR(120),
      signature TEXT,
      created_at_local TIMESTAMPTZ,
      updated_at_local TIMESTAMPTZ,
      wallet_snapshot_before NUMERIC(18,2),
      wallet_snapshot_after NUMERIC(18,2),
      negative_limit_at_time NUMERIC(18,2),
      exceptional_issue BOOLEAN NOT NULL DEFAULT FALSE,
      exception_reason VARCHAR(2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT toll_transactions_post_check CHECK (post_id IN (${allowedPosts})),
      CONSTRAINT toll_transactions_unique_device_local UNIQUE (device_id, local_id)
    );
  `);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS company_code VARCHAR(64);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS amount_due NUMERIC(18,2);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(18,2);`);
  await pool.query(`ALTER TABLE toll_transactions ALTER COLUMN company_id DROP NOT NULL;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(32);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS tax_type VARCHAR(16);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS provenance VARCHAR(120);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS destination VARCHAR(120);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS agent_id UUID;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS agent_name VARCHAR(120);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(120);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS key_id VARCHAR(120);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS signature TEXT;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS created_at_local TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS updated_at_local TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS wallet_snapshot_before NUMERIC(18,2);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS wallet_snapshot_after NUMERIC(18,2);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS negative_limit_at_time NUMERIC(18,2);`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS exceptional_issue BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE toll_transactions ADD COLUMN IF NOT EXISTS exception_reason VARCHAR(2000);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS toll_transactions_company_idx ON toll_transactions(company_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS toll_transactions_created_idx ON toll_transactions(created_at DESC);`);
};

export const findByDeviceLocal = async (deviceId: string, localId: string): Promise<TollTransaction | null> => {
  const result = await pool.query(
    `SELECT * FROM toll_transactions WHERE device_id = $1 AND local_id = $2 LIMIT 1;`,
    [deviceId, localId]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const insertTollTransaction = async (
  client: any,
  tx: Omit<TollTransaction, 'createdAt'>
): Promise<TollTransaction> => {
  const result = await client.query(
    `
      INSERT INTO toll_transactions
        (id, device_id, local_id, company_id, company_code, company_name, amount_usd, amount_due, amount_paid, payment_mode, override_used, post_id, vehicle_plate, tax_type, provenance, destination, agent_id, agent_name, transaction_date, carrier_name, key_id, signature, created_at_local, updated_at_local, wallet_snapshot_before, wallet_snapshot_after, negative_limit_at_time, exceptional_issue, exception_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      RETURNING *;
    `,
    [
      tx.id,
      tx.deviceId,
      tx.localId,
      tx.companyId,
      tx.companyCode,
      tx.companyName,
      tx.amountUsd,
      tx.amountDue ?? null,
      tx.amountPaid,
      tx.paymentMode,
      tx.overrideUsed,
      tx.postId,
      tx.vehiclePlate,
      tx.taxType,
      tx.provenance,
      tx.destination,
      tx.agentId,
      tx.agentName,
      tx.transactionDate,
      tx.carrierName,
      tx.keyId,
      tx.signature,
      tx.createdAtLocal,
      tx.updatedAtLocal,
      tx.walletSnapshotBefore,
      tx.walletSnapshotAfter,
      tx.negativeLimitAtTime,
      tx.exceptionalIssue,
      tx.exceptionReason
    ]
  );
  return mapRow(result.rows[0]);
};

export const hasRecentTransactionForPlate = async (
  postId: string,
  vehiclePlate: string,
  since: Date
): Promise<boolean> => {
  const result = await pool.query(
    `
      SELECT 1
      FROM toll_transactions
      WHERE post_id = $1
        AND vehicle_plate = $2
        AND created_at >= $3
      LIMIT 1;
    `,
    [postId, vehiclePlate, since]
  );
  return Boolean(result.rows[0]);
};

export const listTollTransactions = async (filters: {
  search?: string;
  companyId?: string;
  postId?: string;
  paymentMode?: string;
  startDate?: Date;
  endDate?: Date;
  limit: number;
  offset: number;
}): Promise<{ rows: TollTransaction[]; total: number }> => {
  const where: string[] = [];
  const params: any[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(
      `(LOWER(vehicle_plate) LIKE $${params.length} OR LOWER(carrier_name) LIKE $${params.length} OR LOWER(company_name) LIKE $${params.length})`
    );
  }
  if (filters.companyId) {
    params.push(filters.companyId);
    where.push(`company_id = $${params.length}`);
  }
  if (filters.postId) {
    params.push(filters.postId);
    where.push(`post_id = $${params.length}`);
  }
  if (filters.paymentMode) {
    params.push(filters.paymentMode);
    where.push(`payment_mode = $${params.length}`);
  }
  if (filters.startDate) {
    params.push(filters.startDate);
    where.push(`created_at >= $${params.length}`);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    where.push(`created_at <= $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataQuery = `
    SELECT * FROM toll_transactions
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM toll_transactions
    ${whereClause};
  `;

  const dataParams = [...params, filters.limit, filters.offset];
  const [{ rows: dataRows }, { rows: countRows }] = await Promise.all([
    pool.query(dataQuery, dataParams),
    pool.query(countQuery, params)
  ]);

  return {
    rows: dataRows.map(mapRow),
    total: Number(countRows[0].total)
  };
};
