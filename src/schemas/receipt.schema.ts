import { z } from 'zod';
import { RECEIPT_FINANCIAL_MODES, RECEIPT_STATUSES, RECEIPT_TAX_TYPES } from '../constants/receipts';

export const createReceiptBatchSchema = z.object({
  body: z.object({
    company_id: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(10000),
    tax_type: z.enum(RECEIPT_TAX_TYPES),
    provenance: z.string().trim().max(120).optional(),
    destination: z.string().trim().max(120).optional(),
    financial_mode: z.enum(RECEIPT_FINANCIAL_MODES),
    unit_amount_usd: z.coerce.number().min(0),
    payment_reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(512).optional()
  })
});

export const listReceiptBatchesSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    tax_type: z.enum(RECEIPT_TAX_TYPES).optional(),
    financial_mode: z.enum(RECEIPT_FINANCIAL_MODES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
  })
});

export const receiptSummarySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    tax_type: z.enum(RECEIPT_TAX_TYPES).optional(),
    financial_mode: z.enum(RECEIPT_FINANCIAL_MODES).optional()
  })
});

export const batchLookupSchema = z.object({
  query: z.object({
    code: z.string().trim().min(4).max(32).optional(),
    qr_payload: z.string().trim().min(8).max(2048).optional()
  }).refine(
    (value) => Boolean(value.code || value.qr_payload),
    {
      message: 'code or qr_payload is required'
    }
  )
});

export const batchSyncSchema = z.object({
  query: z.object({
    since: z.string().datetime().optional()
  })
});

export const batchConsumeSchema = z.object({
  body: z.object({
    batch_code: z.string().trim().min(4).max(32),
    quantity: z.coerce.number().int().min(1).max(1000),
    consumed_at: z.string().datetime().optional(),
    post_id: z.string().trim().max(64).optional(),
    source_device_id: z.string().trim().max(64).optional(),
    source_device_type: z.string().trim().max(32).optional(),
    local_event_id: z.string().trim().max(64).optional(),
    source: z.enum(['manual', 'scan', 'sync']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
});

export const batchConsumeSyncSchema = z.object({
  body: z.object({
    events: z.array(
      z.object({
        batch_code: z.string().trim().min(4).max(32),
        quantity: z.coerce.number().int().min(1).max(1000),
        consumed_at: z.string().datetime().optional(),
        post_id: z.string().trim().max(64).optional(),
        source_device_id: z.string().trim().max(64).optional(),
        source_device_type: z.string().trim().max(32).optional(),
        local_event_id: z.string().trim().max(64).optional(),
        source: z.enum(['manual', 'scan', 'sync']).optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      })
    ).min(1).max(200)
  })
});

export const receiptBatchIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const listBatchReceiptsSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({
    status: z.enum(RECEIPT_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
  })
});

export const receiptLookupSchema = z.object({
  query: z.object({
    code: z.string().trim().min(4).max(32).optional(),
    qr_payload: z.string().trim().min(8).max(4096).optional()
  }).refine((value) => Boolean(value.code || value.qr_payload), {
    message: 'code or qr_payload is required'
  })
});

export const receiptConsumeSchema = z.object({
  body: z.object({
    code: z.string().trim().min(4).max(32).optional(),
    qr_payload: z.string().trim().min(8).max(4096).optional(),
    consumed_at: z.string().datetime().optional(),
    post_id: z.string().trim().max(64).optional(),
    source_device_id: z.string().trim().max(64).optional(),
    source_device_type: z.string().trim().max(32).optional(),
    local_event_id: z.string().trim().max(64).optional(),
    source: z.enum(['manual', 'scan', 'sync']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }).refine((value) => Boolean(value.code || value.qr_payload), {
    message: 'code or qr_payload is required'
  })
});

export const receiptConsumeSyncSchema = z.object({
  body: z.object({
    events: z.array(
      z.object({
        code: z.string().trim().min(4).max(32).optional(),
        qr_payload: z.string().trim().min(8).max(4096).optional(),
        consumed_at: z.string().datetime().optional(),
        post_id: z.string().trim().max(64).optional(),
        source_device_id: z.string().trim().max(64).optional(),
        source_device_type: z.string().trim().max(32).optional(),
        local_event_id: z.string().trim().max(64).optional(),
        source: z.enum(['manual', 'scan', 'sync']).optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      }).refine((value) => Boolean(value.code || value.qr_payload), {
        message: 'code or qr_payload is required'
      })
    ).min(1).max(200)
  })
});
