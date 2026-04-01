import pool from '../config/database';

export type CompanyStats = {
  total: number;
  active: number;
  blocked: number;
};

export const getCompanyStats = async (): Promise<CompanyStats> => {
  const companies = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_active) AS active
    FROM companies;
  `);

  return {
    total: Number(companies.rows[0]?.total ?? 0),
    active: Number(companies.rows[0]?.active ?? 0),
    blocked:
      Number(companies.rows[0]?.total ?? 0) -
      Number(companies.rows[0]?.active ?? 0)
  };
};

export type TransactionStats = {
  total: number;
  totalAmount: number;
};

export const getTransactionStats = async (since: Date | null, postId?: string): Promise<TransactionStats> => {
  const params: any[] = [];
  const where: string[] = [];
  if (since) {
    params.push(since);
    where.push(`created_at >= $${params.length}`);
  }
  if (postId) {
    params.push(postId);
    where.push(`post_id = $${params.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(amount_usd), 0) AS total_amount
      FROM toll_transactions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''};
    `,
    params
  );

  return {
    total: Number(result.rows[0]?.total ?? 0),
    totalAmount: Number(result.rows[0]?.total_amount ?? 0)
  };
};

export type BreakdownItem = {
  key: string;
  count: number;
  amount: number;
};

export const getPaymentModeBreakdown = async (since: Date | null, postId?: string): Promise<BreakdownItem[]> => {
  const params: any[] = [];
  const where: string[] = [];
  if (since) {
    params.push(since);
    where.push(`created_at >= $${params.length}`);
  }
  if (postId) {
    params.push(postId);
    where.push(`post_id = $${params.length}`);
  }

  const result = await pool.query(
    `
      SELECT payment_mode AS key, COUNT(*) AS count, COALESCE(SUM(amount_usd), 0) AS amount
      FROM toll_transactions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY payment_mode
      ORDER BY amount DESC;
    `,
    params
  );

  return result.rows.map((row) => ({
    key: row.key,
    count: Number(row.count ?? 0),
    amount: Number(row.amount ?? 0)
  }));
};

export const getTopPostsByAmount = async (
  since: Date | null,
  limit = 5,
  postId?: string
): Promise<BreakdownItem[]> => {
  const params: any[] = [];
  const where: string[] = [];
  if (since) {
    params.push(since);
    where.push(`created_at >= $${params.length}`);
  }
  if (postId) {
    params.push(postId);
    where.push(`post_id = $${params.length}`);
  }

  const result = await pool.query(
    `
      SELECT post_id AS key, COUNT(*) AS count, COALESCE(SUM(amount_usd), 0) AS amount
      FROM toll_transactions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY post_id
      ORDER BY amount DESC
      LIMIT $${params.length + 1};
    `,
    [...params, limit]
  );

  return result.rows.map((row) => ({
    key: row.key,
    count: Number(row.count ?? 0),
    amount: Number(row.amount ?? 0)
  }));
};

export type CompanyBreakdownItem = {
  companyId: string;
  companyName: string | null;
  count: number;
  amount: number;
};

export const getTopCompaniesByAmount = async (
  since: Date | null,
  limit = 5,
  postId?: string
): Promise<CompanyBreakdownItem[]> => {
  const params: any[] = [];
  const where: string[] = ['tt.company_id IS NOT NULL'];
  if (since) {
    params.push(since);
    where.push(`tt.created_at >= $${params.length}`);
  }
  if (postId) {
    params.push(postId);
    where.push(`tt.post_id = $${params.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        company_id,
        COALESCE(company_name, c.name) AS company_name,
        COUNT(*) AS count,
        COALESCE(SUM(amount_usd), 0) AS amount
      FROM toll_transactions tt
      LEFT JOIN companies c ON c.id = tt.company_id
      WHERE ${where.join(' AND ')}
      GROUP BY company_id, company_name, c.name
      ORDER BY amount DESC
      LIMIT $${params.length + 1};
    `,
    [...params, limit]
  );

  return result.rows.map((row) => ({
    companyId: row.company_id,
    companyName: row.company_name ?? null,
    count: Number(row.count ?? 0),
    amount: Number(row.amount ?? 0)
  }));
};

export type DeviceStats = {
  total: number;
  active: number;
  inactive: number;
};

export type RecentConnectionItem = {
  sessionId: string;
  username: string;
  role: string;
  userPost: string;
  clientType: string;
  connectedAt: Date;
};

export const getDeviceStats = async (): Promise<DeviceStats> => {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_active) AS active,
      COUNT(*) FILTER (WHERE NOT is_active) AS inactive
    FROM pos_devices;
  `);

  return {
    total: Number(result.rows[0]?.total ?? 0),
    active: Number(result.rows[0]?.active ?? 0),
    inactive: Number(result.rows[0]?.inactive ?? 0)
  };
};

export const getRecentConnections = async (limit = 10): Promise<RecentConnectionItem[]> => {
  const result = await pool.query(
    `
      SELECT
        s.id AS session_id,
        u.username,
        u.role,
        u.post AS user_post,
        s.client_type,
        s.created_at AS connected_at
      FROM user_refresh_sessions s
      INNER JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT $1;
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    sessionId: row.session_id,
    username: row.username,
    role: row.role,
    userPost: row.user_post,
    clientType: row.client_type,
    connectedAt: row.connected_at
  }));
};
