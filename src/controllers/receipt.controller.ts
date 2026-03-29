import { NextFunction, Request, Response } from 'express';
import * as receiptService from '../services/receipt.service';
import type { ReceiptFinancialMode, ReceiptStatus, ReceiptTaxType } from '../constants/receipts';
import type { Role } from '../constants/roles';

export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { company_id, quantity, tax_type, provenance, destination, financial_mode, unit_amount_usd, payment_reference, note } = req.body;
    const result = await receiptService.issueCompanyBatch({
      companyId: company_id,
      quantity,
      taxType: tax_type as ReceiptTaxType,
      provenance,
      destination,
      financialMode: financial_mode as ReceiptFinancialMode,
      unitAmountUsd: unit_amount_usd,
      paymentReference: payment_reference,
      note,
      issuedByUserId: req.user?.id ?? null,
      issuedByUsername: req.user?.username ?? null,
      issuedByRole: (req.user?.role as Role | undefined) ?? null
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const listBatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, company_id, tax_type, financial_mode, page = '1', pageSize = '10' } = req.query as Record<string, string | undefined>;
    const result = await receiptService.listBatches({
      search,
      companyId: company_id,
      taxType: tax_type as ReceiptTaxType | undefined,
      financialMode: financial_mode as ReceiptFinancialMode | undefined,
      issuerUserId: req.user?.role === 'AGENT_BUREAU' ? (req.user?.id ?? null) : null,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 10
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const syncBatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { since } = req.query as { since?: string };
    const result = await receiptService.syncBatches(since);
    res.json({ success: true, server_time: result.serverTime.toISOString(), data: result.data });
  } catch (error) {
    next(error);
  }
};

export const lookupBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, qr_payload } = req.query as { code?: string; qr_payload?: string };
    const batch = await receiptService.getBatchByLookup({
      batchShortCode: code,
      qrPayload: qr_payload
    });
    res.json({ success: true, batch });
  } catch (error) {
    next(error);
  }
};

export const consumeBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batch_code, quantity, consumed_at, post_id, source_device_id, source_device_type, local_event_id, source, metadata } = req.body;
    const result = await receiptService.consumeBatch({
      batchShortCode: batch_code,
      quantity,
      consumedAt: consumed_at,
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      actorRole: (req.user?.role as Role | undefined) ?? null,
      postId: post_id,
      sourceDeviceId: source_device_id,
      sourceDeviceType: source_device_type,
      localEventId: local_event_id,
      source,
      metadata
    });
    res.status(201).json({
      success: true,
      status: result.alreadyProcessed ? 'duplicate' : 'success',
      batch: result.batch,
      event: result.event
    });
  } catch (error) {
    next(error);
  }
};

export const syncBatchConsumptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { events } = req.body as { events: Array<Record<string, unknown>> };
    const result = await receiptService.syncBatchConsumptions({
      events: events as any,
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      actorRole: (req.user?.role as Role | undefined) ?? null
    });
    res.status(201).json({ success: true, server_time: result.serverTime.toISOString(), results: result.results });
  } catch (error) {
    next(error);
  }
};

export const getBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await receiptService.getBatch(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const listReceipts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', pageSize = '20', status } = req.query as Record<string, string | undefined>;
    const result = await receiptService.getBatchReceipts(
      req.params.id,
      Number(page) || 1,
      Number(pageSize) || 20,
      status as ReceiptStatus | undefined
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};


export const consumeReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, qr_payload, consumed_at, post_id, source_device_id, source_device_type, local_event_id, source, metadata } = req.body;
    const result = await receiptService.consumeReceipt({
      shortCode: code,
      qrPayload: qr_payload,
      consumedAt: consumed_at,
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      actorRole: (req.user?.role as Role | undefined) ?? null,
      postId: post_id,
      sourceDeviceId: source_device_id,
      sourceDeviceType: source_device_type,
      localEventId: local_event_id,
      source,
      metadata,
    });
    res.status(result.alreadyProcessed ? 200 : 201).json({
      success: true,
      status: result.alreadyProcessed ? 'duplicate' : 'success',
      receipt: result.receipt,
      event: result.event
    });
  } catch (error) {
    next(error);
  }
};

export const syncReceiptConsumptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { events } = req.body as { events: Array<Record<string, unknown>> };
    const result = await receiptService.syncReceiptConsumptions({
      events: events as any,
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      actorRole: (req.user?.role as Role | undefined) ?? null
    });
    res.status(201).json({
      success: true,
      server_time: result.serverTime.toISOString(),
      results: result.results
    });
  } catch (error) {
    next(error);
  }
};

export const lookupReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, qr_payload } = req.query as { code?: string; qr_payload?: string };
    const result = await receiptService.getReceiptByLookup({
      shortCode: code,
      qrPayload: qr_payload
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
