import { getCompany } from '../repositories/company.repository';
import type { Role } from '../constants/roles';
import type { ReceiptChannel, ReceiptFinancialMode, ReceiptStatus, ReceiptTaxType } from '../constants/receipts';
import {
  consumeReceiptBatchQuantity,
  createReceiptBatch,
  ensureReceiptTables,
  findReceiptBatchByShortCode,
  verifyBatchQrPayload,
  findReceiptByLookup,
  getReceiptBatch,
  listBatchConsumptionEvents,
  listBatchReceipts,
  listReceiptBatches,
  listReceiptBatchesForSync,
  listReceiptsForReport,
  listReceiptEvents,
  summarizeReceiptBatches,
  consumeSingleReceipt
} from '../repositories/receipt.repository';
import AppError from '../utils/appError';

export const initializeReceipts = async (): Promise<void> => {
  await ensureReceiptTables();
};

export const issueCompanyBatch = async (input: {
  companyId: string;
  quantity: number;
  taxType: ReceiptTaxType;
  provenance?: string | null;
  destination?: string | null;
  financialMode: ReceiptFinancialMode;
  unitAmountUsd: number;
  paymentReference?: string | null;
  note?: string | null;
  issuedByUserId?: string | null;
  issuedByUsername?: string | null;
  issuedByRole?: Role | null;
}) => {
  const company = await getCompany(input.companyId);
  if (!company) {
    throw new AppError('Company not found', 404, 'RECEIPT_BATCH_COMPANY_NOT_FOUND');
  }

  return createReceiptBatch({
    ...input,
    channel: 'COMPANY_BATCH'
  });
};

export const listBatches = async (filters: {
  search?: string;
  companyId?: string;
  taxType?: ReceiptTaxType;
  financialMode?: ReceiptFinancialMode;
  issuerUserId?: string | null;
  page: number;
  pageSize: number;
}) => {
  const normalizedFilters = {
    search: filters.search ?? null,
    companyId: filters.companyId ?? null,
    taxType: filters.taxType ?? null,
    financialMode: filters.financialMode ?? null,
    issuerUserId: filters.issuerUserId ?? null
  };

  const [summary, { rows, total }] = await Promise.all([
    summarizeReceiptBatches(normalizedFilters),
    listReceiptBatches({
      ...normalizedFilters,
      page: filters.page,
      pageSize: filters.pageSize
    })
  ]);

  return {
    data: rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    summary
  };
};

export const listReceiptsReport = async (filters: {
  search?: string;
  companyId?: string;
  postId?: string;
  financialMode?: ReceiptFinancialMode;
  channel?: ReceiptChannel;
  family: 'financial' | 'passage';
  startDate?: Date;
  endDate?: Date;
  page: number;
  pageSize: number;
}) => {
  const { rows, total } = await listReceiptsForReport({
    search: filters.search,
    companyId: filters.companyId,
    postId: filters.postId,
    financialMode: filters.financialMode,
    channel: filters.channel,
    family: filters.family,
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

export const getBatch = async (id: string) => {
  const batch = await getReceiptBatch(id);
  if (!batch) {
    throw new AppError('Receipt batch not found', 404, 'RECEIPT_BATCH_NOT_FOUND');
  }
  const events = await listBatchConsumptionEvents(batch.id);
  return { batch, events };
};

export const getBatchByLookup = async (input: {
  batchShortCode?: string | null;
  qrPayload?: string | null;
}) => {
  const resolvedCode = input.qrPayload
    ? verifyBatchQrPayload(input.qrPayload).batchCode
    : input.batchShortCode?.trim().toUpperCase();

  if (!resolvedCode) {
    throw new AppError('Receipt batch code is required', 400, 'RECEIPT_BATCH_LOOKUP_REQUIRED');
  }

  const batch = await findReceiptBatchByShortCode(resolvedCode);
  if (!batch) {
    throw new AppError('Receipt batch not found', 404, 'RECEIPT_BATCH_NOT_FOUND');
  }
  return batch;
};

export const syncBatches = async (since?: string) => {
  const parsedSince = since ? new Date(since) : null;
  if (since && Number.isNaN(parsedSince?.getTime())) {
    throw new AppError('Invalid sync timestamp', 400, 'RECEIPT_BATCH_SYNC_INVALID_TIMESTAMP');
  }

  const data = await listReceiptBatchesForSync(parsedSince ?? null);
  return {
    serverTime: new Date(),
    data
  };
};

export const consumeBatch = async (input: {
  batchShortCode: string;
  quantity: number;
  consumedAt?: string;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: Role | null;
  postId?: string | null;
  sourceDeviceId?: string | null;
  sourceDeviceType?: string | null;
  localEventId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  const consumedAt = input.consumedAt ? new Date(input.consumedAt) : null;
  if (input.consumedAt && Number.isNaN(consumedAt?.getTime())) {
    throw new AppError('Invalid consumed timestamp', 400, 'RECEIPT_BATCH_CONSUME_INVALID_TIMESTAMP');
  }

  return consumeReceiptBatchQuantity({
    batchShortCode: input.batchShortCode.trim().toUpperCase(),
    quantity: input.quantity,
    consumedAt,
    actorUserId: input.actorUserId ?? null,
    actorUsername: input.actorUsername ?? null,
    actorRole: input.actorRole ?? null,
    postId: input.postId ?? null,
    sourceDeviceId: input.sourceDeviceId ?? null,
    sourceDeviceType: input.sourceDeviceType ?? null,
    localEventId: input.localEventId ?? null,
    source: input.source ?? 'manual',
    metadata: input.metadata ?? {}
  });
};

export const syncBatchConsumptions = async (input: {
  events: Array<{
    local_event_id?: string | null;
    batch_code: string;
    quantity: number;
    consumed_at?: string;
    post_id?: string | null;
    source_device_id?: string | null;
    source_device_type?: string | null;
    source?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: Role | null;
}) => {
  const results = [] as Array<Record<string, unknown>>;

  for (const event of input.events) {
    try {
      const consumed = await consumeBatch({
        batchShortCode: event.batch_code,
        quantity: event.quantity,
        consumedAt: event.consumed_at,
        actorUserId: input.actorUserId ?? null,
        actorUsername: input.actorUsername ?? null,
        actorRole: input.actorRole ?? null,
        postId: event.post_id ?? null,
        sourceDeviceId: event.source_device_id ?? null,
        sourceDeviceType: event.source_device_type ?? null,
        localEventId: event.local_event_id ?? null,
        source: event.source ?? 'manual',
        metadata: event.metadata ?? {}
      });

      results.push({
        local_event_id: event.local_event_id ?? null,
        status: consumed.alreadyProcessed ? 'duplicate' : 'success',
        remote_event_id: consumed.event.id,
        batch: consumed.batch,
        message: consumed.alreadyProcessed ? 'Evenement deja synchronise.' : 'Consommation synchronisee.'
      });
    } catch (error) {
      if (error instanceof AppError) {
        results.push({
          local_event_id: event.local_event_id ?? null,
          status: 'error',
          code: error.code,
          message: error.message
        });
        continue;
      }
      throw error;
    }
  }

  return {
    serverTime: new Date(),
    results
  };
};

export const getBatchReceipts = async (
  batchId: string,
  page: number,
  pageSize: number,
  status?: ReceiptStatus
) => {
  const batch = await getReceiptBatch(batchId);
  if (!batch) {
    throw new AppError('Receipt batch not found', 404, 'RECEIPT_BATCH_NOT_FOUND');
  }

  const [receiptPage, events] = await Promise.all([
    listBatchReceipts(batchId, page, pageSize, status ?? null),
    listBatchConsumptionEvents(batchId)
  ]);

  return {
    batch,
    data: receiptPage.rows,
    total: receiptPage.total,
    page,
    pageSize,
    events
  };
};

export const getReceiptByLookup = async (input: { shortCode?: string | null; qrPayload?: string | null }) => {
  const receipt = await findReceiptByLookup(input);
  if (!receipt) {
    throw new AppError('Receipt not found', 404, 'RECEIPT_NOT_FOUND');
  }

  const events = await listReceiptEvents(receipt.id);
  return { receipt, events };
};

export const consumeReceipt = async (input: {
  shortCode?: string | null;
  qrPayload?: string | null;
  consumedAt?: string;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: Role | null;
  postId?: string | null;
  sourceDeviceId?: string | null;
  sourceDeviceType?: string | null;
  localEventId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  const consumedAt = input.consumedAt ? new Date(input.consumedAt) : null;
  if (input.consumedAt && Number.isNaN(consumedAt?.getTime())) {
    throw new AppError('Invalid consumed timestamp', 400, 'RECEIPT_CONSUME_INVALID_TIMESTAMP');
  }

  return consumeSingleReceipt({
    shortCode: input.shortCode ?? null,
    qrPayload: input.qrPayload ?? null,
    consumedAt,
    actorUserId: input.actorUserId ?? null,
    actorUsername: input.actorUsername ?? null,
    actorRole: input.actorRole ?? null,
    postId: input.postId ?? null,
    sourceDeviceId: input.sourceDeviceId ?? null,
    sourceDeviceType: input.sourceDeviceType ?? null,
    localEventId: input.localEventId ?? null,
    source: input.source ?? 'manual',
    metadata: input.metadata ?? {}
  });
};

export const syncReceiptConsumptions = async (input: {
  events: Array<{
    code?: string | null;
    qr_payload?: string | null;
    consumed_at?: string;
    post_id?: string | null;
    source_device_id?: string | null;
    source_device_type?: string | null;
    local_event_id?: string | null;
    source?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: Role | null;
}) => {
  const results = [] as Array<Record<string, unknown>>;

  for (const event of input.events) {
    try {
      const consumed = await consumeReceipt({
        shortCode: event.code ?? null,
        qrPayload: event.qr_payload ?? null,
        consumedAt: event.consumed_at,
        actorUserId: input.actorUserId ?? null,
        actorUsername: input.actorUsername ?? null,
        actorRole: input.actorRole ?? null,
        postId: event.post_id ?? null,
        sourceDeviceId: event.source_device_id ?? null,
        sourceDeviceType: event.source_device_type ?? null,
        localEventId: event.local_event_id ?? null,
        source: event.source ?? 'sync',
        metadata: event.metadata ?? {}
      });

      results.push({
        local_event_id: event.local_event_id ?? null,
        status: consumed.alreadyProcessed ? 'duplicate' : 'success',
        receipt: consumed.receipt,
        remote_event_id: consumed.event.id,
        message: consumed.alreadyProcessed ? 'Consommation deja synchronisee.' : 'Consommation synchronisee.'
      });
    } catch (error) {
      if (error instanceof AppError) {
        results.push({
          local_event_id: event.local_event_id ?? null,
          status: 'error',
          code: error.code,
          message: error.message
        });
        continue;
      }
      throw error;
    }
  }

  return {
    serverTime: new Date(),
    results
  };
};
