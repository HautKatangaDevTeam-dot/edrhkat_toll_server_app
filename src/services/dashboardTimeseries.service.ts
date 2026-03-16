import { Post } from '../constants/posts';
import { Role } from '../constants/roles';
import { getTransactionTimeSeries, TimeSeriesPoint } from '../repositories/dashboardTimeseries.repository';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 180;
const postScopedRoles: Role[] = [];

const clampRange = (days: number): number => {
  if (Number.isNaN(days) || days <= 0) return DEFAULT_RANGE_DAYS;
  return Math.min(days, MAX_RANGE_DAYS);
};

export const getRevenueTimeSeries = async (
  role: Role,
  post: Post | undefined,
  requestedDays: number,
  granularity: 'day' | 'week'
): Promise<{ rangeDays: number; since: string; granularity: string; series: TimeSeriesPoint[] }> => {
  const rangeDays = clampRange(requestedDays);
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const scopedPost = postScopedRoles.includes(role) ? post : undefined;

  const series = await getTransactionTimeSeries(since, granularity, scopedPost);

  return {
    rangeDays,
    since: since.toISOString(),
    granularity,
    series
  };
};
