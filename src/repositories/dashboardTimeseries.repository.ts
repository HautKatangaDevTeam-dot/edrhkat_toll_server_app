import pool from '../config/database';

export type TimeSeriesPoint = {
  period: string;
  totalAmount: number;
  totalCount: number;
};

export const getTransactionTimeSeries = async (
  since: Date,
  granularity: 'day' | 'week',
  postId?: string
): Promise<TimeSeriesPoint[]> => {
  const params: any[] = [since];
  const where: string[] = ['tt.created_at >= $1'];
  if (postId) {
    params.push(postId);
    where.push(`tt.post_id = $${params.length}`);
  }

  const bucket =
    granularity === 'week'
      ? "to_char(date_trunc('week', tt.created_at), 'YYYY-IW')"
      : "to_char(date_trunc('day', tt.created_at), 'YYYY-MM-DD')";

  const result = await pool.query(
    `
      SELECT
        ${bucket} AS period,
        COUNT(*) AS total_count,
        COALESCE(SUM(tt.amount_usd), 0) AS total_amount
      FROM toll_transactions tt
      WHERE ${where.join(' AND ')}
      GROUP BY period
      ORDER BY period ASC;
    `,
    params
  );

  return result.rows.map((row) => ({
    period: row.period,
    totalAmount: Number(row.total_amount ?? 0),
    totalCount: Number(row.total_count ?? 0)
  }));
};
