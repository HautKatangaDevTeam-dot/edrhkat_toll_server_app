import { z } from 'zod';
import { POSTS } from '../constants/posts';

const transactionSchema = z.object({
  local_id: z.string().uuid(),
  company_id: z.string().uuid().optional(),
  company_code: z.string().trim().max(64).optional(),
  company_name: z.string().trim().max(255).optional(),
  amount_paid: z.coerce.number().positive(),
  amount_due: z.coerce.number().positive().optional(),
  payment_mode: z.enum(['CASH', 'CARD', 'OTHER']).default('CASH'),
  post_id: z.enum(POSTS),
  vehicle_plate: z.string().trim().max(32).optional(),
  tax_type: z.enum(['TRANSPORT', 'TRANSFERT']).optional(),
  provenance: z.string().trim().max(120).optional(),
  destination: z.string().trim().max(120).optional(),
  agent_id: z.string().uuid().optional(),
  agent_name: z.string().trim().max(120).optional(),
  transaction_date: z.coerce.date().optional(),
  carrier_name: z.string().trim().max(120).optional(),
  key_id: z.string().trim().max(120).optional(),
  signature: z.string().trim().max(512).optional(),
  created_at_local: z.coerce.date().optional(),
  updated_at_local: z.coerce.date().optional(),
  exceptional_issue: z.boolean().optional(),
  exception_reason: z.string().trim().max(2000).optional()
}).superRefine((value, ctx) => {
  if (value.exceptional_issue && (!value.exception_reason || !value.exception_reason.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exception_reason'],
      message: 'exception_reason is required when exceptional_issue is true'
    });
  }
});

export const posSyncSchema = z.object({
  body: z.preprocess(
    (input) => {
      if (Array.isArray(input)) {
        return { device_id: 'legacy-device', last_sync_at: undefined, transactions: input };
      }
      const maybe = input as any;
      if (maybe && Array.isArray(maybe.transactions)) {
        return maybe;
      }
      return input;
    },
    z.object({
      device_id: z.string().trim().min(1),
      device_type: z.enum(['OFFICE_POS', 'TOLL_POS']).optional(),
      last_sync_at: z.coerce.date().optional(),
      transactions: z.array(transactionSchema)
    })
  )
});

export const posCompaniesSinceSchema = z.object({
  query: z.object({
    since: z.coerce.date().optional()
  })
});

export const listTollTransactionsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    post_id: z.enum(POSTS).optional(),
    payment_mode: z.enum(['CASH', 'CARD', 'OTHER']).optional(),
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
  })
});
