import { Post } from '../constants/posts';
import { Role } from '../constants/roles';
import {
  BreakdownItem,
  CompanyBreakdownItem,
  getCompanyStats,
  getPaymentModeBreakdown,
  getTopCompaniesByAmount,
  getTopPostsByAmount,
  getTransactionStats,
  getDeviceStats,
} from '../repositories/dashboard.repository';

const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 90;
const postScopedRoles: Role[] = [];

export type DashboardSummary = {
  rangeDays: number;
  since: string;
  companies: {
    total: number;
    active: number;
  };
  transactions: {
    total: number;
    totalAmount: number;
    byPaymentMode: BreakdownItem[];
    topPosts: BreakdownItem[];
    topCompanies: CompanyBreakdownItem[];
  };
  devices: {
    total: number;
    active: number;
    inactive: number;
  };
};

const clampRange = (days: number): number => {
  if (Number.isNaN(days) || days <= 0) return DEFAULT_RANGE_DAYS;
  return Math.min(days, MAX_RANGE_DAYS);
};

export const getDashboardSummary = async (
  role: Role,
  post: Post | undefined,
  requestedDays: number
): Promise<DashboardSummary> => {
  // All authorized roles receive the same summary today; adjust here if per-role filtering is needed later.
  const rangeDays = clampRange(requestedDays);
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const scopedPost = postScopedRoles.includes(role) ? post : undefined;

  const [companyStats, txnStats, paymentModes, topPosts, topCompanies, deviceStats] =
    await Promise.all([
      getCompanyStats(),
      getTransactionStats(since, scopedPost),
      getPaymentModeBreakdown(since, scopedPost),
      getTopPostsByAmount(since, undefined, scopedPost),
      getTopCompaniesByAmount(since, undefined, scopedPost),
      getDeviceStats()
    ]);

  return {
    rangeDays,
    since: since.toISOString(),
    companies: {
      total: companyStats.total,
      active: companyStats.active
    },
    transactions: {
      total: txnStats.total,
      totalAmount: txnStats.totalAmount,
      byPaymentMode: paymentModes,
      topPosts,
      topCompanies
    },
    devices: deviceStats
  };
};
