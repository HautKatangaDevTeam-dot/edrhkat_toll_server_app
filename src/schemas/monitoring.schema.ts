import { z } from 'zod';

export const listIncidentsSchema = z.object({
  query: z.object({
    status: z.enum(['active', 'resolved', 'all']).default('active').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional()
  })
});

export const incidentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});
