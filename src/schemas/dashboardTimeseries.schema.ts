import { z } from 'zod';

export const revenueTimeSeriesSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(180).default(30).optional(),
    granularity: z.enum(['day', 'week']).default('day').optional()
  })
});
