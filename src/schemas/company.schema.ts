import { z } from 'zod';
import { BILLING_MODES } from '../constants/billingModes';

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    code: z.string().trim().min(1).max(64).optional(),
    billing_mode: z.enum(BILLING_MODES).optional()
  })
});

export const listCompaniesSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
  })
});

export const companyIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const updateCompanySchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      code: z.string().trim().min(1).max(64).optional(),
      billing_mode: z.enum(BILLING_MODES).optional(),
      is_active: z.boolean().optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required'
    })
});
