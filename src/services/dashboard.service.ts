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
  getRecentConnections,
} from '../repositories/dashboard.repository';

const MAX_RANGE_DAYS = 90;
const postScopedRoles: Role[] = [];

export type DashboardSummary = {
  rangeDays: number | null;
  since: string | null;
  companies: {
    total: number;
    active: number;
    blocked: number;
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
  recentConnections: Array<{
    sessionId: string;
    username: string;
    role: string;
    userPost: string;
    clientType: string;
    connectedAt: string;
  }>;
};

const clampRange = (days?: number): number | null => {
  if (days == null || Number.isNaN(days) || days <= 0) return null;
  return Math.min(days, MAX_RANGE_DAYS);
};

export const getDashboardSummary = async (
  role: Role,
  post: Post | undefined,
  requestedDays?: number
): Promise<DashboardSummary> => {
  // All authorized roles receive the same summary today; adjust here if per-role filtering is needed later.
  const rangeDays = clampRange(requestedDays);
  const since = rangeDays == null
    ? null
    : new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const scopedPost = postScopedRoles.includes(role) ? post : undefined;

  const isFinancialSupervisor = role === 'SUPERVISEUR';

  const [companyStats, txnStats, paymentModes, topPosts, topCompanies, deviceStats, recentConnections] =
    await Promise.all([
      isFinancialSupervisor
        ? Promise.resolve({ total: 0, active: 0, blocked: 0 })
        : getCompanyStats(),
      getTransactionStats(since, scopedPost),
      getPaymentModeBreakdown(since, scopedPost),
      getTopPostsByAmount(since, undefined, scopedPost),
      isFinancialSupervisor
        ? Promise.resolve([])
        : getTopCompaniesByAmount(since, undefined, scopedPost),
      isFinancialSupervisor
        ? Promise.resolve({ total: 0, active: 0, inactive: 0 })
        : getDeviceStats(),
      isFinancialSupervisor
        ? Promise.resolve([])
        : getRecentConnections(10)
    ]);

  return {
    rangeDays,
    since: since?.toISOString() ?? null,
    companies: {
      total: companyStats.total,
      active: companyStats.active,
      blocked: companyStats.blocked
    },
    transactions: {
      total: txnStats.total,
      totalAmount: txnStats.totalAmount,
      byPaymentMode: paymentModes,
      topPosts,
      topCompanies
    },
    devices: deviceStats
    ,
    recentConnections: recentConnections.map((item) => ({
      sessionId: item.sessionId,
      username: item.username,
      role: item.role,
      userPost: item.userPost,
      clientType: item.clientType,
      connectedAt: item.connectedAt.toISOString()
    }))
  };
};
