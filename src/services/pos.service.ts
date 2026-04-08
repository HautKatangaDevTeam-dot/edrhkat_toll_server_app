import crypto from 'crypto';
import AppError from '../utils/appError';
import {
  ensureDevicesTable,
  isDeviceActive,
  listDevicesForMonitoring,
  markDeviceSync,
  updateDeviceRegistryEntry,
  upsertDevice
} from '../repositories/device.repository';
import {
  getCompany,
  listCompanySnapshots,
  listCompanySnapshotsSince
} from '../repositories/company.repository';
import pool from '../config/database';
import {
  ensureTollTransactionsTable,
  findByDeviceLocal,
  insertTollTransaction,
  hasRecentTransactionForPlate
} from '../repositories/toll.repository';
import { ensureCompaniesTable } from '../repositories/company.repository';
import { createReceiptForTollTransaction, ensureReceiptTables } from '../repositories/receipt.repository';
import logger from '../config/logger';
import {
  ensureKeyBundleTable,
  getPublishedKeyBundle,
  listRegisteredPublicKeys,
  publishKeyBundle
} from '../repositories/keyBundle.repository';

let posInitPromise: Promise<void> | null = null;

const ensurePosTables = async () => {
  if (!posInitPromise) {
    posInitPromise = (async () => {
      await ensureCompaniesTable();
      await ensureDevicesTable();
      await ensureKeyBundleTable();
      await ensureTollTransactionsTable();
      await ensureReceiptTables();
    })();
  }
  return posInitPromise;
};

export const initializePos = async (): Promise<void> => {
  await ensurePosTables();
};

type PosTransactionDTO = {
  local_id: string;
  company_id?: string;
  company_code?: string | null;
  company_name?: string | null;
  amount_paid: number;
  amount_due?: number;
  payment_mode: string;
  post_id: string;
  vehicle_plate?: string;
  tax_type?: string;
  provenance?: string;
  destination?: string;
  agent_id?: string;
  agent_name?: string;
  transaction_date?: Date;
  carrier_name?: string;
  key_id?: string;
  signature?: string;
  created_at_local?: Date;
  updated_at_local?: Date;
  exceptional_issue?: boolean;
  exception_reason?: string;
};

type SyncResultItem = {
  local_id: string;
  remote_id: string | null;
  receipt_short_code?: string | null;
  status: 'success' | 'duplicate' | 'error';
  reason_code?: string;
  reason_message?: string;
};

const DUPLICATE_PLATE_WINDOW_MINUTES = 5;

export const processTransactions = async (
  deviceId: string,
  lastSyncAt: Date | undefined,
  transactions: PosTransactionDTO[],
  deviceType?: string
) => {
  await ensurePosTables();

  // Ensure/validate device
  await upsertDevice(deviceId, deviceType ?? 'TOLL_POS');
  const active = await isDeviceActive(deviceId);
  await markDeviceSync(deviceId);
  if (!active) {
    throw new AppError('Device is not active', 403);
  }

  const results: SyncResultItem[] = [];
  const touchedCompanies = new Set<string>();

  for (const tx of transactions) {
    const existing = await findByDeviceLocal(deviceId, tx.local_id);
    if (existing) {
      results.push({ local_id: tx.local_id, remote_id: existing.id, status: 'duplicate' });
      if (existing.companyId) {
        touchedCompanies.add(existing.companyId);
      }
      continue;
    }

    const companyId = tx.company_id ?? null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const company = companyId ? await getCompany(companyId) : null;
      if (companyId && !company) {
        throw new AppError('Company not found', 404);
      }

      const remoteId = crypto.randomUUID();

      // Disabled temporarily because offline POS batches can sync late after connectivity returns.
      // if (tx.vehicle_plate) {
      //   const windowStart = new Date(Date.now() - DUPLICATE_PLATE_WINDOW_MINUTES * 60 * 1000);
      //   const isRecentDuplicate = await hasRecentTransactionForPlate(tx.post_id, tx.vehicle_plate, windowStart);
      //   if (isRecentDuplicate) {
      //     throw new AppError('Duplicate plate within time window', 409);
      //   }
      // }

      // Insert toll transaction
      const amountPaid = tx.amount_paid;
      const amountDue = tx.amount_due ?? tx.amount_paid;

      await insertTollTransaction(client, {
        id: remoteId,
        deviceId,
        localId: tx.local_id,
        companyId: company?.id ?? null,
        companyCode: tx.company_code ?? null,
        companyName: tx.company_name ?? null,
        amountUsd: amountPaid,
        amountDue,
        amountPaid,
        paymentMode: tx.payment_mode,
        overrideUsed: false,
        postId: tx.post_id,
        vehiclePlate: tx.vehicle_plate ?? null,
        taxType: tx.tax_type ?? null,
        provenance: tx.provenance ?? null,
        destination: tx.destination ?? null,
        agentId: tx.agent_id ?? null,
        agentName: tx.agent_name ?? null,
        transactionDate: tx.transaction_date ?? null,
        carrierName: tx.carrier_name ?? null,
        keyId: tx.key_id ?? null,
        signature: tx.signature ?? null,
        createdAtLocal: tx.created_at_local ?? null,
        updatedAtLocal: tx.updated_at_local ?? null,
        walletSnapshotBefore: null,
        walletSnapshotAfter: null,
        negativeLimitAtTime: null,
        exceptionalIssue: Boolean(tx.exceptional_issue),
        exceptionReason: tx.exception_reason ?? null
      });

      const receipt = await createReceiptForTollTransaction(client, {
        transactionId: remoteId,
        companyId: company?.id ?? null,
        taxType: tx.tax_type ?? null,
        provenance: tx.provenance ?? null,
        destination: tx.destination ?? null,
        amountUsd: amountPaid,
        postId: tx.post_id,
        agentId: tx.agent_id ?? null,
        agentName: tx.agent_name ?? null,
        keyId: tx.key_id ?? null,
        signature: tx.signature ?? null,
        paymentMode: tx.payment_mode ?? null,
        exceptionalIssue: Boolean(tx.exceptional_issue),
        transactionDate: tx.transaction_date ?? null,
        vehiclePlate: tx.vehicle_plate ?? null,
        carrierName: tx.carrier_name ?? null,
        localId: tx.local_id,
        deviceId,
      });

      await client.query('COMMIT');
      results.push({ local_id: tx.local_id, remote_id: remoteId, receipt_short_code: receipt.shortCode, status: 'success' });
      if (company) {
        touchedCompanies.add(company.id);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      const reason = error instanceof AppError ? error.message : (error as Error)?.message ?? 'internal_error';
      logger.error('POS transaction failed', {
        deviceId,
        local_id: tx.local_id,
        reason,
        error
      });
      results.push({
        local_id: tx.local_id,
        remote_id: null,
        status: 'error',
        reason_code: error instanceof AppError ? reason : 'internal_error',
        reason_message: reason
      });
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      client.release();
    }
  }

  // Company snapshots delta
  const snapshots = await listCompanySnapshots(lastSyncAt, Array.from(touchedCompanies));

  return {
    server_time: new Date().toISOString(),
    data: results,
    company_snapshots_delta: snapshots
  };
};

export const listCompaniesSince = async (since?: Date) => {
  await ensurePosTables();
  const snapshots = await listCompanySnapshotsSince(since);
  return {
    success: true,
    server_time: new Date().toISOString(),
    data: snapshots
  };
};

export const heartbeatPosDevice = async (
  deviceId: string,
  deviceType?: string | null
) => {
  await ensurePosTables();
  await upsertDevice(deviceId, deviceType ?? 'TOLL_POS');
  return {
    success: true,
    server_time: new Date().toISOString(),
    data: {
      device_id: deviceId,
      device_type: deviceType ?? 'TOLL_POS'
    }
  };
};

export const listPosDevices = async (staleMinutes: number) => {
  await ensurePosTables();
  const effectiveStaleMinutes = Number.isNaN(staleMinutes) || staleMinutes <= 0 ? 60 : staleMinutes;
  const devices = await listDevicesForMonitoring(effectiveStaleMinutes);
  return {
    success: true,
    stale_minutes: effectiveStaleMinutes,
    stale_count: devices.filter((device) => device.stale).length,
    data: devices
  };
};

export const updatePosDevice = async (
  id: string,
  input: {
    label?: string | null;
    contactPhone?: string | null;
    assignedPost?: string | null;
    isActive?: boolean;
  }
) => {
  await ensurePosTables();
  await upsertDevice(id, 'TOLL_POS');
  const updated = await updateDeviceRegistryEntry(id, input);
  if (!updated) {
    throw new AppError('POS device not found', 404, 'POS_DEVICE_NOT_FOUND');
  }
  return { success: true, data: updated };
};

export const getCentralKeyBundle = async () => {
  await ensurePosTables();
  const bundle = await getPublishedKeyBundle();
  if (!bundle) {
    throw new AppError('No central key bundle published', 404, 'POS_KEY_BUNDLE_NOT_FOUND');
  }
  return {
    success: true,
    data: {
      bundle_json: bundle.bundleJson,
      updated_at: bundle.updatedAt.toISOString(),
      updated_by_user_id: bundle.updatedByUserId,
      updated_by_username: bundle.updatedByUsername
    }
  };
};

export const listCentralKeyRegistry = async () => {
  await ensurePosTables();
  const keys = await listRegisteredPublicKeys();
  return {
    success: true,
    data: keys.map((key) => ({
      key_id: key.keyId,
      label: key.label,
      status: key.status,
      created_at: key.createdAt.toISOString(),
      updated_at: key.updatedAt.toISOString(),
      updated_by_user_id: key.updatedByUserId,
      updated_by_username: key.updatedByUsername
    }))
  };
};

export const publishCentralKeyBundle = async (input: {
  bundleJson: string;
  updatedByUserId?: string | null;
  updatedByUsername?: string | null;
}) => {
  await ensurePosTables();
  const bundle = await publishKeyBundle(input);
  return {
    success: true,
    data: {
      bundle_json: bundle.bundleJson,
      updated_at: bundle.updatedAt.toISOString(),
      updated_by_user_id: bundle.updatedByUserId,
      updated_by_username: bundle.updatedByUsername
    }
  };
};
