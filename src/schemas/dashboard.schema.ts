import { z } from 'zod';

export const dashboardSummarySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(90).optional()
  })
});
