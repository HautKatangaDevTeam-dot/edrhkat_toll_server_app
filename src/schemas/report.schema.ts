import { z } from 'zod';
import { POSTS } from '../constants/posts';
import { RECEIPT_CHANNELS, RECEIPT_FINANCIAL_MODES } from '../constants/receipts';

const RECEIPT_REPORT_FAMILIES = ['financial', 'passage'] as const;

export const reportTransactionsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    post_id: z.enum(POSTS).optional(),
    payment_mode: z.enum(['CASH', 'CARD', 'OTHER']).optional(),
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500)
  })
});

export const reportReceiptsSchema = z.object({
  query: z
    .object({
      search: z.string().trim().optional(),
      company_id: z.string().uuid().optional(),
      post_id: z.enum(POSTS).optional(),
      financial_mode: z.enum(RECEIPT_FINANCIAL_MODES).optional(),
      channel: z.enum(RECEIPT_CHANNELS).optional(),
      family: z.enum(RECEIPT_REPORT_FAMILIES).default('financial'),
      date_from: z.coerce.date().optional(),
      date_to: z.coerce.date().optional(),
      limit: z.coerce.number().int().min(1).max(1000).default(500)
    })
    .superRefine((query, ctx) => {
      const isTollChannel =
        query.channel === 'SINGLE_TOLL' || query.channel === 'EXCEPTIONAL_TOLL';

      if (isTollChannel && query.financial_mode === 'EXONERATED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['financial_mode'],
          message: "Les recus de peage et exceptionnels ne peuvent etre qu'en mode NORMAL."
        });
      }
    })
});
