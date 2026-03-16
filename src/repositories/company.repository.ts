import pool from '../config/database';
import { BILLING_MODES, BillingMode } from '../constants/billingModes';

export type Company = {
  id: string;
  name: string;
  code: string | null;
  billingMode: BillingMode;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanySnapshot = {
  id: string;
  name: string;
  code: string | null;
  billingMode: BillingMode;
  isActive: boolean;
  updatedAt: Date;
};

const mapRow = (row: any): Company => ({
  id: row.id,
  name: row.name,
  code: row.code,
  billingMode: row.billing_mode,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSnapshot = (row: any): CompanySnapshot => ({
  id: row.id,
  name: row.name,
  code: row.code,
  billingMode: row.billing_mode,
  isActive: row.is_active,
  updatedAt: row.updated_at,
});

export const ensureCompaniesTable = async (): Promise<void> => {
  const allowedModes = BILLING_MODES.map((m) => `'${m}'`).join(',');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(64) UNIQUE,
      billing_mode VARCHAR(16) NOT NULL DEFAULT 'PAYG',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT companies_billing_mode_check CHECK (billing_mode IN (${allowedModes}))
    );
  `);
};

export const createCompany = async (
  id: string,
  name: string,
  code: string | null,
  billingMode: BillingMode
): Promise<Company> => {
  const result = await pool.query(
    `
      INSERT INTO companies (id, name, code, billing_mode)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `,
    [id, name, code, billingMode]
  );
  return mapRow(result.rows[0]);
};

export const listCompanies = async (
  search: string | null,
  limit: number,
  offset: number
): Promise<{ rows: Company[]; total: number }> => {
  const params: any[] = [];
  const where: string[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(
      `(LOWER(name) LIKE $${params.length} OR LOWER(code) LIKE $${params.length})`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [data, count] = await Promise.all([
    pool.query(
      `
        SELECT * FROM companies
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2};
      `,
      [...params, limit, offset]
    ),
    pool.query(
      `
        SELECT COUNT(*) AS total
        FROM companies
        ${whereClause};
      `,
      params
    ),
  ]);

  return {
    rows: data.rows.map(mapRow),
    total: Number(count.rows[0]?.total ?? 0),
  };
};

export const getCompany = async (id: string): Promise<Company | null> => {
  const result = await pool.query(`SELECT * FROM companies WHERE id = $1 LIMIT 1;`, [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const updateCompany = async (
  id: string,
  fields: Partial<Pick<Company, 'name' | 'code' | 'billingMode' | 'isActive'>>
): Promise<Company | null> => {
  const sets: string[] = [];
  const values: any[] = [];

  if (fields.name !== undefined) {
    values.push(fields.name);
    sets.push(`name = $${values.length}`);
  }
  if (fields.code !== undefined) {
    values.push(fields.code);
    sets.push(`code = $${values.length}`);
  }
  if (fields.billingMode !== undefined) {
    values.push(fields.billingMode);
    sets.push(`billing_mode = $${values.length}`);
  }
  if (fields.isActive !== undefined) {
    values.push(fields.isActive);
    sets.push(`is_active = $${values.length}`);
  }

  if (sets.length === 0) return getCompany(id);

  values.push(id);
  const result = await pool.query(
    `
      UPDATE companies
      SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *;
    `,
    values
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const listCompanySnapshots = async (
  lastSyncAt: Date | undefined,
  touchedCompanyIds: string[]
): Promise<CompanySnapshot[]> => {
  const params: any[] = [];
  const where: string[] = [];

  if (lastSyncAt) {
    params.push(lastSyncAt);
    where.push(`updated_at > $${params.length}`);
  }
  if (touchedCompanyIds.length > 0) {
    params.push(touchedCompanyIds);
    where.push(`id = ANY($${params.length})`);
  }
  if (where.length === 0) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT *
      FROM companies
      WHERE ${where.join(' OR ')};
    `,
    params
  );

  return result.rows.map(mapSnapshot);
};

export const listCompanySnapshotsSince = async (
  since?: Date
): Promise<CompanySnapshot[]> => {
  if (!since) {
    const result = await pool.query(
      `
        SELECT *
        FROM companies
        ORDER BY updated_at DESC;
      `
    );

    return result.rows.map(mapSnapshot);
  }

  const result = await pool.query(
    `
      SELECT *
      FROM companies
      WHERE updated_at > $1
      ORDER BY updated_at DESC;
    `,
    [since]
  );

  return result.rows.map(mapSnapshot);
};
