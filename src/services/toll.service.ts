import { listTollTransactions } from '../repositories/toll.repository';

export const listTransactions = async (filters: {
  search?: string;
  companyId?: string;
  postId?: string;
  paymentMode?: string;
  startDate?: Date;
  endDate?: Date;
  page: number;
  pageSize: number;
}) => {
  const { rows, total } = await listTollTransactions({
    search: filters.search,
    companyId: filters.companyId,
    postId: filters.postId,
    paymentMode: filters.paymentMode,
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize
  });

  return {
    data: rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize
  };
};
