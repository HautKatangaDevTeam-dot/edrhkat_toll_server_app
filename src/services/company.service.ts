import crypto from 'crypto';
import { BillingMode } from '../constants/billingModes';
import {
  Company,
  createCompany,
  ensureCompaniesTable,
  getCompany,
  listCompanies,
  updateCompany
} from '../repositories/company.repository';
import AppError from '../utils/appError';
import { initializeReceipts } from './receipt.service';

export const initializeCompanies = async (): Promise<void> => {
  await ensureCompaniesTable();
  await initializeReceipts();
};

export const create = async (name: string, code?: string, billingMode?: BillingMode): Promise<Company> => {
  return createCompany(
    crypto.randomUUID(),
    name,
    code ?? null,
    billingMode ?? 'PAYG'
  );
};

export const list = async (search: string | undefined, page: number, pageSize: number) => {
  const { rows, total } = await listCompanies(search ?? null, pageSize, (page - 1) * pageSize);
  return { data: rows, total, page, pageSize };
};

export const get = async (id: string): Promise<Company> => {
  const company = await getCompany(id);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  return company;
};

export const update = async (
  id: string,
  fields: {
    name?: string;
    code?: string;
    billing_mode?: BillingMode;
    is_active?: boolean;
  }
): Promise<Company> => {
  const company = await updateCompany(id, {
    name: fields.name,
    code: fields.code,
    billingMode: fields.billing_mode,
    isActive: fields.is_active
  });
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  return company;
};
