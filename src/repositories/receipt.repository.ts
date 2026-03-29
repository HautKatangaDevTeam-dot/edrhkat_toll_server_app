import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import env from '../config/env';
import type {
  ReceiptChannel,
  ReceiptFinancialMode,
  ReceiptStatus,
  ReceiptTaxType
} from '../constants/receipts';
import AppError from '../utils/appError';

export type ReceiptBatch = {
  id: string;
  batchShortCode: string;
  batchQrPayload: string;
  companyId: string;
  companyName: string | null;
  companyCode: string | null;
  quantity: number;
  issuedCount: number;
  consumedCount: number;
  remainingCount: number;
  taxType: ReceiptTaxType;
  provenance: string | null;
  destination: string | null;
  financialMode: ReceiptFinancialMode;
  unitAmountUsd: number;
  totalTheoreticalUsd: number;
  totalPaidUsd: number;
  totalExoneratedUsd: number;
  paymentReference: string | null;
  note: string | null;
  issuedByUserId: string | null;
  issuedByUsername: string | null;
  issuedByRole: string | null;
  channel: ReceiptChannel;
  createdAt: Date;
  updatedAt: Date;
};

export type Receipt = {
  id: string;
  batchId: string | null;
  companyId: string | null;
  companyName: string | null;
  companyCode: string | null;
  shortCode: string;
  sequenceNo: number | null;
  status: ReceiptStatus;
  channel: ReceiptChannel;
  taxType: ReceiptTaxType;
  provenance: string | null;
  destination: string | null;
  financialMode: ReceiptFinancialMode;
  tariffAmountUsd: number;
  paidAmountUsd: number;
  exoneratedAmountUsd: number;
  consumedAt: Date | null;
  consumedPost: string | null;
  consumedByUserId: string | null;
  createdAt: Date;
};

export type ReceiptEvent = {
  id: string;
  receiptId: string;
  batchId: string | null;
  eventType: string;
  actorUserId: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  sourceDeviceId: string | null;
  sourceDeviceType: string | null;
  postId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ReceiptBatchConsumptionEvent = {
  id: string;
  batchId: string;
  batchCode: string;
  quantityConsumed: number;
  actorUserId: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  sourceDeviceId: string | null;
  sourceDeviceType: string | null;
  postId: string | null;
  localEventId: string | null;
  source: string | null;
  consumedAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

const mapBatchRow = (row: any): ReceiptBatch => ({
  id: row.id,
  batchShortCode: row.batch_short_code,
  batchQrPayload: row.batch_qr_payload,
  companyId: row.company_id,
  companyName: row.company_name ?? null,
  companyCode: row.company_code ?? null,
  quantity: Number(row.quantity),
  issuedCount: Number(row.issued_count ?? row.quantity),
  consumedCount: Number(row.consumed_count ?? 0),
  remainingCount: Number(row.remaining_count ?? Number(row.quantity) - Number(row.consumed_count ?? 0)),
  taxType: row.tax_type,
  provenance: row.provenance ?? null,
  destination: row.destination ?? null,
  financialMode: row.financial_mode,
  unitAmountUsd: Number(row.unit_amount_usd),
  totalTheoreticalUsd: Number(row.total_theoretical_usd),
  totalPaidUsd: Number(row.total_paid_usd),
  totalExoneratedUsd: Number(row.total_exonerated_usd),
  paymentReference: row.payment_reference ?? null,
  note: row.note ?? null,
  issuedByUserId: row.issued_by_user_id ?? null,
  issuedByUsername: row.issued_by_username ?? null,
  issuedByRole: row.issued_by_role ?? null,
  channel: row.channel,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapReceiptRow = (row: any): Receipt => ({
  id: row.id,
  batchId: row.batch_id ?? null,
  companyId: row.company_id ?? null,
  companyName: row.company_name ?? null,
  companyCode: row.company_code ?? null,
  shortCode: row.short_code,
  sequenceNo: row.sequence_no == null ? null : Number(row.sequence_no),
  status: row.status,
  channel: row.channel,
  taxType: row.tax_type,
  provenance: row.provenance ?? null,
  destination: row.destination ?? null,
  financialMode: row.financial_mode,
  tariffAmountUsd: Number(row.tariff_amount_usd),
  paidAmountUsd: Number(row.paid_amount_usd),
  exoneratedAmountUsd: Number(row.exonerated_amount_usd),
  consumedAt: row.consumed_at ?? null,
  consumedPost: row.consumed_post ?? null,
  consumedByUserId: row.consumed_by_user_id ?? null,
  createdAt: row.created_at
});

const mapEventRow = (row: any): ReceiptEvent => ({
  id: row.id,
  receiptId: row.receipt_id,
  batchId: row.batch_id ?? null,
  eventType: row.event_type,
  actorUserId: row.actor_user_id ?? null,
  actorUsername: row.actor_username ?? null,
  actorRole: row.actor_role ?? null,
  sourceDeviceId: row.source_device_id ?? null,
  sourceDeviceType: row.source_device_type ?? null,
  postId: row.post_id ?? null,
  metadata: row.metadata ?? {},
  createdAt: row.created_at
});

const mapBatchConsumptionRow = (row: any): ReceiptBatchConsumptionEvent => ({
  id: row.id,
  batchId: row.batch_id,
  batchCode: row.batch_code,
  quantityConsumed: Number(row.quantity_consumed),
  actorUserId: row.actor_user_id ?? null,
  actorUsername: row.actor_username ?? null,
  actorRole: row.actor_role ?? null,
  sourceDeviceId: row.source_device_id ?? null,
  sourceDeviceType: row.source_device_type ?? null,
  postId: row.post_id ?? null,
  localEventId: row.local_event_id ?? null,
  source: row.source ?? null,
  consumedAt: row.consumed_at,
  metadata: row.metadata ?? {},
  createdAt: row.created_at
});

const batchSelect = `
  SELECT
    rb.*, c.name AS company_name, c.code AS company_code,
    rb.quantity AS issued_count,
    COALESCE(rs.consumed_count, 0) AS consumed_count,
    GREATEST(rb.quantity - COALESCE(rs.consumed_count, 0), 0) AS remaining_count
  FROM receipt_batches rb
  INNER JOIN companies c ON c.id = rb.company_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE status = 'CONSUMED') AS consumed_count
    FROM receipts r
    WHERE r.batch_id = rb.id
  ) rs ON TRUE
`;

const getBatchByIdWithClient = async (client: PoolClient, id: string): Promise<ReceiptBatch | null> => {
  const result = await client.query(`${batchSelect} WHERE rb.id = $1 LIMIT 1;`, [id]);
  return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
};

export const ensureReceiptTables = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_batches (
      id UUID PRIMARY KEY,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      tax_type VARCHAR(16) NOT NULL CHECK (tax_type IN ('TRANSPORT', 'TRANSFERT')),
      provenance VARCHAR(120),
      destination VARCHAR(120),
      financial_mode VARCHAR(16) NOT NULL CHECK (financial_mode IN ('NORMAL', 'EXONERATED')),
      unit_amount_usd NUMERIC(12,2) NOT NULL CHECK (unit_amount_usd >= 0),
      total_theoretical_usd NUMERIC(12,2) NOT NULL CHECK (total_theoretical_usd >= 0),
      total_paid_usd NUMERIC(12,2) NOT NULL CHECK (total_paid_usd >= 0),
      total_exonerated_usd NUMERIC(12,2) NOT NULL CHECK (total_exonerated_usd >= 0),
      payment_reference VARCHAR(120),
      note VARCHAR(512),
      issued_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      issued_by_username VARCHAR(64),
      issued_by_role VARCHAR(64),
      batch_short_code VARCHAR(32) UNIQUE,
      batch_qr_payload TEXT,
      channel VARCHAR(32) NOT NULL CHECK (channel IN ('COMPANY_BATCH', 'SINGLE_TOLL', 'EXCEPTIONAL_TOLL')) DEFAULT 'COMPANY_BATCH',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id UUID PRIMARY KEY,
      batch_id UUID REFERENCES receipt_batches(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      short_code VARCHAR(32) NOT NULL UNIQUE,
      sequence_no INTEGER,
      status VARCHAR(16) NOT NULL CHECK (status IN ('ISSUED', 'CONSUMED', 'CANCELLED', 'VOID')),
      channel VARCHAR(32) NOT NULL CHECK (channel IN ('COMPANY_BATCH', 'SINGLE_TOLL', 'EXCEPTIONAL_TOLL')),
      tax_type VARCHAR(16) NOT NULL CHECK (tax_type IN ('TRANSPORT', 'TRANSFERT')),
      provenance VARCHAR(120),
      destination VARCHAR(120),
      financial_mode VARCHAR(16) NOT NULL CHECK (financial_mode IN ('NORMAL', 'EXONERATED')),
      tariff_amount_usd NUMERIC(12,2) NOT NULL CHECK (tariff_amount_usd >= 0),
      paid_amount_usd NUMERIC(12,2) NOT NULL CHECK (paid_amount_usd >= 0),
      exonerated_amount_usd NUMERIC(12,2) NOT NULL CHECK (exonerated_amount_usd >= 0),
      consumed_at TIMESTAMPTZ,
      consumed_post VARCHAR(64),
      consumed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_events (
      id UUID PRIMARY KEY,
      receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      batch_id UUID REFERENCES receipt_batches(id) ON DELETE CASCADE,
      event_type VARCHAR(32) NOT NULL,
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      actor_username VARCHAR(64),
      actor_role VARCHAR(64),
      source_device_id VARCHAR(64),
      source_device_type VARCHAR(32),
      post_id VARCHAR(64),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_batch_consumption_events (
      id UUID PRIMARY KEY,
      batch_id UUID NOT NULL REFERENCES receipt_batches(id) ON DELETE CASCADE,
      batch_code VARCHAR(32) NOT NULL,
      quantity_consumed INTEGER NOT NULL CHECK (quantity_consumed > 0),
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      actor_username VARCHAR(64),
      actor_role VARCHAR(64),
      source_device_id VARCHAR(64),
      source_device_type VARCHAR(32),
      post_id VARCHAR(64),
      local_event_id VARCHAR(64),
      source VARCHAR(16),
      consumed_at TIMESTAMPTZ NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE receipt_batches ADD COLUMN IF NOT EXISTS batch_short_code VARCHAR(32);`);
  await pool.query(`ALTER TABLE receipt_batches ADD COLUMN IF NOT EXISTS batch_qr_payload TEXT;`);
  await pool.query(`
    UPDATE receipt_batches
    SET batch_short_code = CONCAT(
      SUBSTR(UPPER(REPLACE(id::text, '-', '')), 1, 4),
      '-',
      SUBSTR(UPPER(REPLACE(id::text, '-', '')), 5, 4)
    )
    WHERE batch_short_code IS NULL;
  `);
  await pool.query(`
    UPDATE receipt_batches
    SET batch_qr_payload = json_build_object(
      'type', 'RECEIPT_BATCH',
      'batch_id', id,
      'batch_code', batch_short_code
    )::text
    WHERE batch_qr_payload IS NULL OR batch_qr_payload = '';
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS receipt_batches_short_code_key ON receipt_batches(batch_short_code);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS receipt_batch_consumption_device_local_idx ON receipt_batch_consumption_events(source_device_id, local_event_id) WHERE source_device_id IS NOT NULL AND local_event_id IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS receipt_batches_company_idx ON receipt_batches(company_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS receipt_batches_updated_idx ON receipt_batches(updated_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS receipts_batch_idx ON receipts(batch_id, sequence_no);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS receipts_company_idx ON receipts(company_id, status, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS receipt_events_receipt_idx ON receipt_events(receipt_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS receipt_batch_consumption_batch_idx ON receipt_batch_consumption_events(batch_id, consumed_at DESC);`);
};

const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BATCH_QR_PAYLOAD_VERSION = 2;

const createShortCode = (): string => {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += SHORT_CODE_ALPHABET[crypto.randomInt(0, SHORT_CODE_ALPHABET.length)];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
};

const resolveExistingUserId = async (
  client: PoolClient,
  userId?: string | null
): Promise<string | null> => {
  if (!userId) {
    return null;
  }

  const result = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE id = $1 LIMIT 1;',
    [userId]
  );

  return result.rows[0]?.id ?? null;
};

const signBatchQrPayload = (batchId: string, batchShortCode: string, issuedAt: string): string => {
  return crypto
    .createHmac('sha256', env.receiptBatchQrSecret)
    .update(`${batchId}:${batchShortCode}:${issuedAt}`)
    .digest('base64url');
};

const nextUniqueShortCode = async (client: PoolClient): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shortCode = createShortCode();
    const result = await client.query(`SELECT 1 FROM receipts WHERE short_code = $1 LIMIT 1;`, [shortCode]);
    if (result.rowCount === 0) {
      return shortCode;
    }
  }
  throw new Error('Unable to generate unique receipt short code');
};

const buildBatchQrPayload = (batchId: string, batchShortCode: string): string => {
  const issuedAt = new Date().toISOString();
  return JSON.stringify({
    type: 'RECEIPT_BATCH',
    v: BATCH_QR_PAYLOAD_VERSION,
    batch_id: batchId,
    batch_code: batchShortCode,
    issued_at: issuedAt,
    sig: signBatchQrPayload(batchId, batchShortCode, issuedAt)
  });
};

type VerifiedBatchQrPayload = {
  batchId: string | null;
  batchCode: string;
  signatureVerified: boolean;
};

export const verifyBatchQrPayload = (rawPayload: string): VerifiedBatchQrPayload => {
  let decoded: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawPayload.trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    decoded = parsed as Record<string, unknown>;
  } catch {
    throw new AppError('QR lot invalide.', 400, 'RECEIPT_BATCH_QR_INVALID');
  }

  if (decoded.type !== 'RECEIPT_BATCH' || typeof decoded.batch_code !== 'string') {
    throw new AppError('QR lot invalide.', 400, 'RECEIPT_BATCH_QR_INVALID');
  }

  const batchCode = decoded.batch_code.trim().toUpperCase();
  const batchId = typeof decoded.batch_id === 'string' ? decoded.batch_id : null;
  const issuedAt = typeof decoded.issued_at === 'string' ? decoded.issued_at : null;
  const signature = typeof decoded.sig === 'string' ? decoded.sig : null;
  const version = typeof decoded.v === 'number' ? decoded.v : null;

  if (version != null && version >= 2) {
    if (!batchId || !issuedAt || !signature) {
      throw new AppError('Signature QR lot manquante.', 400, 'RECEIPT_BATCH_QR_SIGNATURE_REQUIRED');
    }
    const expectedSignature = signBatchQrPayload(batchId, batchCode, issuedAt);
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    const signatureVerified =
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected);

    if (!signatureVerified) {
      throw new AppError('Signature QR lot invalide.', 400, 'RECEIPT_BATCH_QR_SIGNATURE_INVALID');
    }

    return {
      batchId,
      batchCode,
      signatureVerified: true
    };
  }

  return {
    batchId,
    batchCode,
    signatureVerified: false
  };
};

const nextUniqueBatchShortCode = async (client: PoolClient): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `BT-${createShortCode()}`;
    const result = await client.query(
      `SELECT 1 FROM receipt_batches WHERE batch_short_code = $1 LIMIT 1;`,
      [candidate]
    );
    if (result.rowCount === 0) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique batch short code');
};


export const createReceiptForTollTransaction = async (
  client: PoolClient,
  input: {
    transactionId: string;
    companyId?: string | null;
    taxType?: string | null;
    provenance?: string | null;
    destination?: string | null;
    amountUsd: number;
    postId?: string | null;
    agentId?: string | null;
    agentName?: string | null;
    keyId?: string | null;
    signature?: string | null;
    paymentMode?: string | null;
    exceptionalIssue?: boolean;
    transactionDate?: Date | null;
    vehiclePlate?: string | null;
    carrierName?: string | null;
    localId?: string | null;
    deviceId?: string | null;
  }
): Promise<Receipt> => {
  const receiptId = crypto.randomUUID();
  const shortCode = await nextUniqueShortCode(client);
  const actorUserId = await resolveExistingUserId(client, input.agentId ?? null);
  const channel: ReceiptChannel = input.exceptionalIssue
    ? 'EXCEPTIONAL_TOLL'
    : 'SINGLE_TOLL';
  const taxType = (
    input.taxType && input.taxType.trim().length > 0
      ? input.taxType.trim().toUpperCase()
      : 'TRANSPORT'
  ) as ReceiptTaxType;

  const receiptResult = await client.query(
    `
      INSERT INTO receipts (
        id,
        batch_id,
        company_id,
        short_code,
        sequence_no,
        status,
        channel,
        tax_type,
        provenance,
        destination,
        financial_mode,
        tariff_amount_usd,
        paid_amount_usd,
        exonerated_amount_usd
      )
      VALUES ($1,NULL,$2,$3,NULL,'ISSUED',$4,$5,$6,$7,'NORMAL',$8,$9,0)
      RETURNING *;
    `,
    [
      receiptId,
      input.companyId ?? null,
      shortCode,
      channel,
      taxType,
      input.provenance ?? null,
      input.destination ?? null,
      input.amountUsd,
      input.amountUsd,
    ]
  );

  const receipt = mapReceiptRow(receiptResult.rows[0]);

  const normalizedTransactionDate =
    input.transactionDate instanceof Date
      ? input.transactionDate
      : typeof input.transactionDate === 'string'
        ? new Date(input.transactionDate)
        : null;

  await client.query(
    `
      INSERT INTO receipt_events (
        id,
        receipt_id,
        batch_id,
        event_type,
        actor_user_id,
        actor_username,
        actor_role,
        post_id,
        metadata
      )
      VALUES ($1,$2,NULL,'ISSUED',$3,$4,'AGENT_TOLL',$5,$6::jsonb);
    `,
    [
      crypto.randomUUID(),
      receipt.id,
      actorUserId,
      input.agentName ?? null,
      input.postId ?? null,
      JSON.stringify({
        transaction_id: input.transactionId,
        key_id: input.keyId ?? null,
        signature: input.signature ?? null,
        payload_hash: computePayloadHash(
          buildTollReceiptSignedPayload({
            keyId: input.keyId ?? null,
            postId: input.postId ?? null,
            agentId: input.agentId ?? null,
            vehiclePlate: input.vehiclePlate ?? null,
            provenance: input.provenance ?? null,
            destination: input.destination ?? null,
            taxType,
            amountUsd: input.amountUsd,
            paymentMode: input.paymentMode ?? 'CASH',
            companyId: input.companyId ?? null,
            exceptionalIssue: input.exceptionalIssue,
            transactionDate: normalizedTransactionDate ?? null,
          }),
        ),
        transaction_date: normalizedTransactionDate?.toISOString() ?? null,
        vehicle_plate: input.vehiclePlate ?? null,
        carrier_name: input.carrierName ?? null,
        local_id: input.localId ?? null,
        device_id: input.deviceId ?? null,
        channel,
      }),
    ]
  );

  return receipt;
};

export const createReceiptBatch = async (input: {
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
  issuedByRole?: string | null;
  channel?: ReceiptChannel;
}): Promise<{ batch: ReceiptBatch; receipts: Receipt[] }> => {
  const totalTheoreticalUsd = Number((input.unitAmountUsd * input.quantity).toFixed(2));
  const totalPaidUsd = input.financialMode === 'EXONERATED' ? 0 : totalTheoreticalUsd;
  const totalExoneratedUsd = input.financialMode === 'EXONERATED' ? totalTheoreticalUsd : 0;
  const batchId = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchShortCode = await nextUniqueBatchShortCode(client);
    const batchQrPayload = buildBatchQrPayload(batchId, batchShortCode);

    const batchResult = await client.query(
      `
        INSERT INTO receipt_batches (
          id,
          company_id,
          quantity,
          tax_type,
          provenance,
          destination,
          financial_mode,
          unit_amount_usd,
          total_theoretical_usd,
          total_paid_usd,
          total_exonerated_usd,
          payment_reference,
          note,
          issued_by_user_id,
          issued_by_username,
          issued_by_role,
          batch_short_code,
          batch_qr_payload,
          channel
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING *;
      `,
      [
        batchId,
        input.companyId,
        input.quantity,
        input.taxType,
        input.provenance ?? null,
        input.destination ?? null,
        input.financialMode,
        input.unitAmountUsd,
        totalTheoreticalUsd,
        totalPaidUsd,
        totalExoneratedUsd,
        input.paymentReference ?? null,
        input.note ?? null,
        input.issuedByUserId ?? null,
        input.issuedByUsername ?? null,
        input.issuedByRole ?? null,
        batchShortCode,
        batchQrPayload,
        input.channel ?? 'COMPANY_BATCH'
      ]
    );

    const receipts: Receipt[] = [];
    for (let index = 0; index < input.quantity; index += 1) {
      const shortCode = await nextUniqueShortCode(client);
      const receiptResult = await client.query(
        `
          INSERT INTO receipts (
            id,
            batch_id,
            company_id,
            short_code,
            sequence_no,
            status,
            channel,
            tax_type,
            provenance,
            destination,
            financial_mode,
            tariff_amount_usd,
            paid_amount_usd,
            exonerated_amount_usd
          )
          VALUES ($1,$2,$3,$4,$5,'ISSUED',$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING *;
        `,
        [
          crypto.randomUUID(),
          batchId,
          input.companyId,
          shortCode,
          index + 1,
          input.channel ?? 'COMPANY_BATCH',
          input.taxType,
          input.provenance ?? null,
          input.destination ?? null,
          input.financialMode,
          input.unitAmountUsd,
          input.financialMode === 'EXONERATED' ? 0 : input.unitAmountUsd,
          input.financialMode === 'EXONERATED' ? input.unitAmountUsd : 0
        ]
      );
      const receipt = mapReceiptRow(receiptResult.rows[0]);
      receipts.push(receipt);

      await client.query(
        `
          INSERT INTO receipt_events (
            id,
            receipt_id,
            batch_id,
            event_type,
            actor_user_id,
            actor_username,
            actor_role,
            metadata
          )
          VALUES ($1,$2,$3,'ISSUED',$4,$5,$6,$7::jsonb);
        `,
        [
          crypto.randomUUID(),
          receipt.id,
          batchId,
          input.issuedByUserId ?? null,
          input.issuedByUsername ?? null,
          input.issuedByRole ?? null,
          JSON.stringify({
            sequence_no: receipt.sequenceNo,
            tax_type: input.taxType,
            financial_mode: input.financialMode
          })
        ]
      );
    }

    await client.query('COMMIT');
    return {
      batch: mapBatchRow(batchResult.rows[0]),
      receipts
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listReceiptBatches = async (filters: {
  search?: string | null;
  companyId?: string | null;
  taxType?: ReceiptTaxType | null;
  financialMode?: ReceiptFinancialMode | null;
  issuerUserId?: string | null;
  page: number;
  pageSize: number;
}): Promise<{ rows: ReceiptBatch[]; total: number }> => {
  const params: any[] = [];
  const where: string[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(c.name) LIKE $${params.length} OR LOWER(COALESCE(c.code, '')) LIKE $${params.length} OR LOWER(COALESCE(rb.payment_reference, '')) LIKE $${params.length} OR LOWER(COALESCE(rb.batch_short_code, '')) LIKE $${params.length})`);
  }
  if (filters.companyId) {
    params.push(filters.companyId);
    where.push(`rb.company_id = $${params.length}`);
  }
  if (filters.taxType) {
    params.push(filters.taxType);
    where.push(`rb.tax_type = $${params.length}`);
  }
  if (filters.financialMode) {
    params.push(filters.financialMode);
    where.push(`rb.financial_mode = $${params.length}`);
  }
  if (filters.issuerUserId) {
    params.push(filters.issuerUserId);
    where.push(`rb.issued_by_user_id = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;

  const base = `
    FROM receipt_batches rb
    INNER JOIN companies c ON c.id = rb.company_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE status = 'CONSUMED') AS consumed_count
      FROM receipts r
      WHERE r.batch_id = rb.id
    ) rs ON TRUE
    ${whereClause}
  `;

  const dataQuery = `
    SELECT
      rb.*, c.name AS company_name, c.code AS company_code,
      rb.quantity AS issued_count,
      COALESCE(rs.consumed_count, 0) AS consumed_count,
      GREATEST(rb.quantity - COALESCE(rs.consumed_count, 0), 0) AS remaining_count
    ${base}
    ORDER BY rb.created_at DESC
    LIMIT $${limitParam} OFFSET $${offsetParam};
  `;

  const countQuery = `SELECT COUNT(*) AS total ${base};`;
  const dataParams = [...params, filters.pageSize, (filters.page - 1) * filters.pageSize];
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(dataQuery, dataParams),
    pool.query(countQuery, params)
  ]);

  return { rows: rows.map(mapBatchRow), total: Number(countRows[0].total) };
};

export const getReceiptBatch = async (id: string): Promise<ReceiptBatch | null> => {
  const result = await pool.query(`${batchSelect} WHERE rb.id = $1 LIMIT 1;`, [id]);
  return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
};

export const listBatchReceipts = async (
  batchId: string,
  page: number,
  pageSize: number,
  status?: ReceiptStatus | null
): Promise<{ rows: Receipt[]; total: number }> => {
  const params: any[] = [batchId];
  let where = 'WHERE r.batch_id = $1';
  if (status) {
    params.push(status);
    where += ` AND r.status = $${params.length}`;
  }

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const select = `
    FROM receipts r
    LEFT JOIN companies c ON c.id = r.company_id
    ${where}
  `;

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `
        SELECT r.*, c.name AS company_name, c.code AS company_code
        ${select}
        ORDER BY r.sequence_no ASC NULLS LAST, r.created_at ASC
        LIMIT $${limitParam} OFFSET $${offsetParam};
      `,
      [...params, pageSize, (page - 1) * pageSize]
    ),
    pool.query(`SELECT COUNT(*) AS total ${select};`, params)
  ]);

  return {
    rows: rows.map(mapReceiptRow),
    total: Number(countRows[0].total)
  };
};

export const listReceiptsForReport = async (filters: {
  search?: string;
  companyId?: string;
  postId?: string;
  financialMode?: ReceiptFinancialMode;
  channel?: ReceiptChannel;
  family: 'financial' | 'passage';
  startDate?: Date;
  endDate?: Date;
  limit: number;
  offset: number;
}): Promise<{ rows: Receipt[]; total: number }> => {
  const params: any[] = [];
  const where: string[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(r.short_code) LIKE $${params.length} OR LOWER(COALESCE(c.name, '')) LIKE $${params.length} OR LOWER(COALESCE(c.code, '')) LIKE $${params.length})`);
  }
  if (filters.companyId) {
    params.push(filters.companyId);
    where.push(`r.company_id = $${params.length}`);
  }
  if (filters.financialMode) {
    params.push(filters.financialMode);
    where.push(`r.financial_mode = $${params.length}`);
  }
  if (filters.channel) {
    params.push(filters.channel);
    where.push(`r.channel = $${params.length}`);
  }

  let orderBy = 'r.created_at DESC, r.short_code DESC';
  if (filters.family === 'passage') {
    where.push(`r.status = 'CONSUMED'`);
    if (filters.postId) {
      params.push(filters.postId);
      where.push(`r.consumed_post = $${params.length}`);
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      where.push(`r.consumed_at >= $${params.length}`);
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      where.push(`r.consumed_at <= $${params.length}`);
    }
    orderBy = 'r.consumed_at DESC NULLS LAST, r.short_code DESC';
  } else {
    if (filters.postId) {
      params.push(filters.postId);
      where.push(`EXISTS (
        SELECT 1
        FROM receipt_events e
        WHERE e.receipt_id = r.id
          AND e.event_type = 'ISSUED'
          AND e.post_id = $${params.length}
      )`);
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      where.push(`r.created_at >= $${params.length}`);
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      where.push(`r.created_at <= $${params.length}`);
    }
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataQuery = `
    SELECT r.*, c.name AS company_name, c.code AS company_code
    FROM receipts r
    LEFT JOIN companies c ON c.id = r.company_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM receipts r
    LEFT JOIN companies c ON c.id = r.company_id
    ${whereClause};
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...params, filters.limit, filters.offset]),
    pool.query(countQuery, params)
  ]);

  return {
    rows: dataResult.rows.map(mapReceiptRow),
    total: Number(countResult.rows[0]?.total ?? 0)
  };
};

export const listReceiptBatchesForSync = async (since?: Date | null): Promise<ReceiptBatch[]> => {
  const params: any[] = [];
  let whereClause = `WHERE rb.channel = 'COMPANY_BATCH'`;
  if (since) {
    params.push(since.toISOString());
    whereClause += ` AND rb.updated_at >= $${params.length}`;
  } else {
    whereClause += ` AND EXISTS (SELECT 1 FROM receipts r WHERE r.batch_id = rb.id AND r.status = 'ISSUED')`;
  }

  const result = await pool.query(
    `
      SELECT
        rb.*, c.name AS company_name, c.code AS company_code,
        rb.quantity AS issued_count,
        COALESCE(rs.consumed_count, 0) AS consumed_count,
        GREATEST(rb.quantity - COALESCE(rs.consumed_count, 0), 0) AS remaining_count
      FROM receipt_batches rb
      INNER JOIN companies c ON c.id = rb.company_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE status = 'CONSUMED') AS consumed_count
        FROM receipts r
        WHERE r.batch_id = rb.id
      ) rs ON TRUE
      ${whereClause}
      ORDER BY rb.updated_at DESC, rb.created_at DESC
      LIMIT 1000;
    `,
    params
  );

  return result.rows.map(mapBatchRow);
};

export const findReceiptBatchByShortCode = async (batchShortCode: string): Promise<ReceiptBatch | null> => {
  const result = await pool.query(
    `${batchSelect} WHERE rb.batch_short_code = $1 LIMIT 1;`,
    [batchShortCode.toUpperCase()]
  );

  return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
};


const computePayloadHash = (payload: string): string =>
  crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

const buildTollReceiptSignedPayload = (input: {
  keyId?: string | null;
  postId?: string | null;
  agentId?: string | null;
  vehiclePlate?: string | null;
  provenance?: string | null;
  destination?: string | null;
  taxType?: string | null;
  amountUsd: number;
  paymentMode?: string | null;
  companyId?: string | null;
  exceptionalIssue?: boolean;
  transactionDate?: Date | string | null;
}) => {
  const resolvedDate =
    input.transactionDate instanceof Date
      ? input.transactionDate
      : typeof input.transactionDate === 'string'
        ? new Date(input.transactionDate)
        : null;
  const timestamp = (resolvedDate ?? new Date()).toISOString();
  return [
    input.keyId ?? '',
    input.postId ?? '',
    input.agentId ?? '',
    input.vehiclePlate ?? '',
    input.provenance ?? '',
    input.destination ?? '',
    input.taxType ?? 'TRANSPORT',
    input.amountUsd,
    input.paymentMode ?? 'CASH',
    input.companyId ?? 'SOLO',
    input.exceptionalIssue ? 'EXCEPTIONAL' : 'NORMAL',
    timestamp,
  ].join('|');
};

const extractReceiptQrIdentity = (rawPayload: string): {
  keyId: string;
  signature: string;
  payloadHash: string;
  shortCode: string | null;
} => {
  let decoded: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawPayload.trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    decoded = parsed as Record<string, unknown>;
  } catch {
    throw new AppError('QR recu invalide.', 400, 'RECEIPT_QR_INVALID');
  }

  const keyId = typeof decoded.keyId === 'string' ? decoded.keyId.trim() : '';
  const signature = typeof decoded.signature === 'string' ? decoded.signature.trim() : '';
  const payload = typeof decoded.payload === 'string' ? decoded.payload.trim() : '';
  const shortCode =
    typeof decoded.shortCode === 'string' && decoded.shortCode.trim().length > 0
      ? decoded.shortCode.trim().toUpperCase()
      : null;
  if (!keyId || !signature || !payload) {
    throw new AppError('QR recu invalide.', 400, 'RECEIPT_QR_INVALID');
  }

  return { keyId, signature, payloadHash: computePayloadHash(payload), shortCode };
};

export const findReceiptByLookup = async (input: {
  shortCode?: string | null;
  qrPayload?: string | null;
}): Promise<Receipt | null> => {
  if (input.shortCode && input.shortCode.trim()) {
    return findReceiptByShortCode(input.shortCode.trim().toUpperCase());
  }

  if (input.qrPayload && input.qrPayload.trim()) {
    const identity = extractReceiptQrIdentity(input.qrPayload);
    const exactResult = await pool.query(
      `
        SELECT r.*, c.name AS company_name, c.code AS company_code
        FROM receipts r
        LEFT JOIN companies c ON c.id = r.company_id
        INNER JOIN receipt_events e ON e.receipt_id = r.id
        WHERE e.event_type = 'ISSUED'
          AND e.metadata->>'key_id' = $1
          AND e.metadata->>'signature' = $2
          AND e.metadata->>'payload_hash' = $3
        ORDER BY e.created_at DESC
        LIMIT 1;
      `,
      [identity.keyId, identity.signature, identity.payloadHash]
    );

    if (exactResult.rows[0]) {
      return mapReceiptRow(exactResult.rows[0]);
    }

    // Fallback for receipts issued before QR payload format fixes: key_id + signature are
    // still enough to identify the issued receipt uniquely in practice.
    const fallbackResult = await pool.query(
      `
        SELECT r.*, c.name AS company_name, c.code AS company_code
        FROM receipts r
        LEFT JOIN companies c ON c.id = r.company_id
        INNER JOIN receipt_events e ON e.receipt_id = r.id
        WHERE e.event_type = 'ISSUED'
          AND e.metadata->>'key_id' = $1
          AND e.metadata->>'signature' = $2
        ORDER BY e.created_at DESC
        LIMIT 1;
      `,
      [identity.keyId, identity.signature]
    );

    if (fallbackResult.rows[0]) {
      return mapReceiptRow(fallbackResult.rows[0]);
    }

    if (identity.shortCode) {
      return findReceiptByShortCode(identity.shortCode);
    }

    return null;
  }

  return null;
};

export const consumeSingleReceipt = async (input: {
  shortCode?: string | null;
  qrPayload?: string | null;
  consumedAt?: Date | null;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: string | null;
  postId?: string | null;
  sourceDeviceId?: string | null;
  sourceDeviceType?: string | null;
  localEventId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ receipt: Receipt; event: ReceiptEvent; alreadyProcessed: boolean }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (input.localEventId && input.sourceDeviceId) {
      const existingResult = await client.query(
        `
          SELECT e.*, r.*, c.name AS company_name, c.code AS company_code
          FROM receipt_events e
          INNER JOIN receipts r ON r.id = e.receipt_id
          LEFT JOIN companies c ON c.id = r.company_id
          WHERE e.event_type = 'CONSUMED'
            AND e.source_device_id = $1
            AND COALESCE(e.metadata->>'local_event_id', '') = $2
          ORDER BY e.created_at DESC
          LIMIT 1;
        `,
        [input.sourceDeviceId, input.localEventId]
      );

      if (existingResult.rows[0]) {
        await client.query('COMMIT');
        return {
          receipt: mapReceiptRow(existingResult.rows[0]),
          event: mapEventRow(existingResult.rows[0]),
          alreadyProcessed: true
        };
      }
    }

    let receiptRowResult;
    if (input.shortCode && input.shortCode.trim()) {
      receiptRowResult = await client.query(
        `
          SELECT r.*, c.name AS company_name, c.code AS company_code
          FROM receipts r
          LEFT JOIN companies c ON c.id = r.company_id
          WHERE r.short_code = $1
          LIMIT 1
          FOR UPDATE OF r;
        `,
        [input.shortCode.trim().toUpperCase()]
      );
    } else {
      const identity = extractReceiptQrIdentity(input.qrPayload ?? '');
      receiptRowResult = await client.query(
        `
          SELECT r.*, c.name AS company_name, c.code AS company_code
          FROM receipts r
          LEFT JOIN companies c ON c.id = r.company_id
          INNER JOIN receipt_events e ON e.receipt_id = r.id
          WHERE e.event_type = 'ISSUED'
            AND e.metadata->>'key_id' = $1
            AND e.metadata->>'signature' = $2
          ORDER BY e.created_at DESC
          LIMIT 1
          FOR UPDATE OF r;
        `,
        [identity.keyId, identity.signature]
      );

      if (!receiptRowResult.rows[0] && identity.shortCode) {
        receiptRowResult = await client.query(
          `
            SELECT r.*, c.name AS company_name, c.code AS company_code
            FROM receipts r
            LEFT JOIN companies c ON c.id = r.company_id
            WHERE r.short_code = $1
            LIMIT 1
            FOR UPDATE OF r;
          `,
          [identity.shortCode]
        );
      }
    }

    if (!receiptRowResult.rows[0]) {
      throw new AppError('Receipt not found', 404, 'RECEIPT_NOT_FOUND');
    }

    const current = mapReceiptRow(receiptRowResult.rows[0]);
    if (current.status === 'CONSUMED') {
      throw new AppError('Receipt already consumed', 409, 'RECEIPT_ALREADY_CONSUMED');
    }
    if (current.status !== 'ISSUED') {
      throw new AppError('Receipt cannot be consumed in its current state', 409, 'RECEIPT_INVALID_STATUS');
    }

    const consumedAt = input.consumedAt ?? new Date();
    const updatedResult = await client.query(
      `
        UPDATE receipts
        SET status = 'CONSUMED',
            consumed_at = $2,
            consumed_post = $3,
            consumed_by_user_id = $4
        WHERE id = $1
        RETURNING *;
      `,
      [current.id, consumedAt, input.postId ?? null, input.actorUserId ?? null]
    );
    const receipt = mapReceiptRow(updatedResult.rows[0]);

    const eventResult = await client.query(
      `
        INSERT INTO receipt_events (
          id,
          receipt_id,
          batch_id,
          event_type,
          actor_user_id,
          actor_username,
          actor_role,
          source_device_id,
          source_device_type,
          post_id,
          metadata
        )
        VALUES ($1,$2,$3,'CONSUMED',$4,$5,$6,$7,$8,$9,$10::jsonb)
        RETURNING *;
      `,
      [
        crypto.randomUUID(),
        receipt.id,
        receipt.batchId,
        input.actorUserId ?? null,
        input.actorUsername ?? null,
        input.actorRole ?? null,
        input.sourceDeviceId ?? null,
        input.sourceDeviceType ?? null,
        input.postId ?? null,
        JSON.stringify({
          source: input.source ?? 'manual',
          local_event_id: input.localEventId ?? null,
          ...((input.metadata ?? {}) as Record<string, unknown>)
        }),
      ]
    );

    await client.query('COMMIT');
    return {
      receipt,
      event: mapEventRow(eventResult.rows[0]),
      alreadyProcessed: false
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const findReceiptByShortCode = async (shortCode: string): Promise<Receipt | null> => {
  const result = await pool.query(
    `
      SELECT r.*, c.name AS company_name, c.code AS company_code
      FROM receipts r
      LEFT JOIN companies c ON c.id = r.company_id
      WHERE r.short_code = $1
      LIMIT 1;
    `,
    [shortCode.toUpperCase()]
  );

  return result.rows[0] ? mapReceiptRow(result.rows[0]) : null;
};

export const listReceiptEvents = async (receiptId: string): Promise<ReceiptEvent[]> => {
  const result = await pool.query(
    `SELECT * FROM receipt_events WHERE receipt_id = $1 ORDER BY created_at DESC;`,
    [receiptId]
  );
  return result.rows.map(mapEventRow);
};

export const listBatchConsumptionEvents = async (batchId: string): Promise<ReceiptBatchConsumptionEvent[]> => {
  const result = await pool.query(
    `SELECT * FROM receipt_batch_consumption_events WHERE batch_id = $1 ORDER BY consumed_at DESC, created_at DESC;`,
    [batchId]
  );
  return result.rows.map(mapBatchConsumptionRow);
};

export const consumeReceiptBatchQuantity = async (input: {
  batchShortCode: string;
  quantity: number;
  consumedAt?: Date | null;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: string | null;
  postId?: string | null;
  sourceDeviceId?: string | null;
  sourceDeviceType?: string | null;
  localEventId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ batch: ReceiptBatch; event: ReceiptBatchConsumptionEvent; alreadyProcessed: boolean }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (input.localEventId && input.sourceDeviceId) {
      const existingResult = await client.query(
        `
          SELECT *
          FROM receipt_batch_consumption_events
          WHERE source_device_id = $1 AND local_event_id = $2
          LIMIT 1;
        `,
        [input.sourceDeviceId, input.localEventId]
      );

      if (existingResult.rows[0]) {
        const event = mapBatchConsumptionRow(existingResult.rows[0]);
        const batch = await getBatchByIdWithClient(client, event.batchId);
        await client.query('COMMIT');
        if (!batch) {
          throw new AppError('Receipt batch not found', 404, 'RECEIPT_BATCH_NOT_FOUND');
        }
        return { batch, event, alreadyProcessed: true };
      }
    }

    const batchLockResult = await client.query(
      `SELECT id, batch_short_code FROM receipt_batches WHERE batch_short_code = $1 FOR UPDATE;`,
      [input.batchShortCode.toUpperCase()]
    );
    if (!batchLockResult.rows[0]) {
      throw new AppError('Receipt batch not found', 404, 'RECEIPT_BATCH_NOT_FOUND');
    }
    const batchId = batchLockResult.rows[0].id as string;
    const normalizedBatchCode = batchLockResult.rows[0].batch_short_code as string;

    const availableReceiptResult = await client.query(
      `
        SELECT id, sequence_no
        FROM receipts
        WHERE batch_id = $1 AND status = 'ISSUED'
        ORDER BY sequence_no ASC NULLS LAST, created_at ASC
        LIMIT $2
        FOR UPDATE;
      `,
      [batchId, input.quantity]
    );

    if (availableReceiptResult.rows.length < input.quantity) {
      throw new AppError(
        'Batch remaining quantity is insufficient',
        409,
        'RECEIPT_BATCH_INSUFFICIENT_REMAINING'
      );
    }

    const consumedAt = input.consumedAt ?? new Date();
    const receiptIds = availableReceiptResult.rows.map((row) => row.id as string);
    const batchConsumptionEventId = crypto.randomUUID();

    await client.query(
      `
        INSERT INTO receipt_batch_consumption_events (
          id,
          batch_id,
          batch_code,
          quantity_consumed,
          actor_user_id,
          actor_username,
          actor_role,
          source_device_id,
          source_device_type,
          post_id,
          local_event_id,
          source,
          consumed_at,
          metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb);
      `,
      [
        batchConsumptionEventId,
        batchId,
        normalizedBatchCode,
        input.quantity,
        input.actorUserId ?? null,
        input.actorUsername ?? null,
        input.actorRole ?? null,
        input.sourceDeviceId ?? null,
        input.sourceDeviceType ?? null,
        input.postId ?? null,
        input.localEventId ?? null,
        input.source ?? 'manual',
        consumedAt,
        JSON.stringify({
          receipt_ids: receiptIds,
          ...((input.metadata ?? {}) as Record<string, unknown>)
        })
      ]
    );

    await client.query(
      `
        UPDATE receipts
        SET status = 'CONSUMED',
            consumed_at = $2,
            consumed_post = $3,
            consumed_by_user_id = $4
        WHERE id = ANY($1::uuid[]);
      `,
      [receiptIds, consumedAt, input.postId ?? null, input.actorUserId ?? null]
    );

    for (const row of availableReceiptResult.rows) {
      await client.query(
        `
          INSERT INTO receipt_events (
            id,
            receipt_id,
            batch_id,
            event_type,
            actor_user_id,
            actor_username,
            actor_role,
            source_device_id,
            source_device_type,
            post_id,
            metadata
          )
          VALUES ($1,$2,$3,'CONSUMED',$4,$5,$6,$7,$8,$9,$10::jsonb);
        `,
        [
          crypto.randomUUID(),
          row.id,
          batchId,
          input.actorUserId ?? null,
          input.actorUsername ?? null,
          input.actorRole ?? null,
          input.sourceDeviceId ?? null,
          input.sourceDeviceType ?? null,
          input.postId ?? null,
          JSON.stringify({
            batch_consumption_event_id: batchConsumptionEventId,
            source: input.source ?? 'manual',
            local_event_id: input.localEventId ?? null,
            sequence_no: row.sequence_no ?? null
          })
        ]
      );
    }

    await client.query(`UPDATE receipt_batches SET updated_at = NOW() WHERE id = $1;`, [batchId]);

    const batch = await getBatchByIdWithClient(client, batchId);
    const eventResult = await client.query(
      `SELECT * FROM receipt_batch_consumption_events WHERE id = $1 LIMIT 1;`,
      [batchConsumptionEventId]
    );

    await client.query('COMMIT');

    if (!batch || !eventResult.rows[0]) {
      throw new AppError('Receipt batch not found', 404, 'RECEIPT_BATCH_NOT_FOUND');
    }

    return {
      batch,
      event: mapBatchConsumptionRow(eventResult.rows[0]),
      alreadyProcessed: false
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export type ReceiptSummary = {
  batchCount: number;
  issuedCount: number;
  consumedCount: number;
  remainingCount: number;
  totalTheoreticalUsd: number;
  totalPaidUsd: number;
  totalExoneratedUsd: number;
};

export const summarizeReceiptBatches = async (filters: {
  search?: string | null;
  companyId?: string | null;
  taxType?: ReceiptTaxType | null;
  financialMode?: ReceiptFinancialMode | null;
  issuerUserId?: string | null;
}): Promise<ReceiptSummary> => {
  const params: any[] = [];
  const where: string[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(c.name) LIKE $${params.length} OR LOWER(COALESCE(c.code, '')) LIKE $${params.length} OR LOWER(COALESCE(rb.payment_reference, '')) LIKE $${params.length} OR LOWER(COALESCE(rb.batch_short_code, '')) LIKE $${params.length})`);
  }
  if (filters.companyId) {
    params.push(filters.companyId);
    where.push(`rb.company_id = $${params.length}`);
  }
  if (filters.taxType) {
    params.push(filters.taxType);
    where.push(`rb.tax_type = $${params.length}`);
  }
  if (filters.financialMode) {
    params.push(filters.financialMode);
    where.push(`rb.financial_mode = $${params.length}`);
  }
  if (filters.issuerUserId) {
    params.push(filters.issuerUserId);
    where.push(`rb.issued_by_user_id = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await pool.query(
    `
      SELECT
        COUNT(*) AS batch_count,
        COALESCE(SUM(rb.quantity), 0) AS issued_count,
        COALESCE(SUM(COALESCE(rs.consumed_count, 0)), 0) AS consumed_count,
        COALESCE(SUM(GREATEST(rb.quantity - COALESCE(rs.consumed_count, 0), 0)), 0) AS remaining_count,
        COALESCE(SUM(rb.total_theoretical_usd), 0) AS total_theoretical_usd,
        COALESCE(SUM(rb.total_paid_usd), 0) AS total_paid_usd,
        COALESCE(SUM(rb.total_exonerated_usd), 0) AS total_exonerated_usd
      FROM receipt_batches rb
      INNER JOIN companies c ON c.id = rb.company_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE status = 'CONSUMED') AS consumed_count
        FROM receipts r
        WHERE r.batch_id = rb.id
      ) rs ON TRUE
      ${whereClause};
    `,
    params
  );

  const row = result.rows[0];
  return {
    batchCount: Number(row.batch_count ?? 0),
    issuedCount: Number(row.issued_count ?? 0),
    consumedCount: Number(row.consumed_count ?? 0),
    remainingCount: Number(row.remaining_count ?? 0),
    totalTheoreticalUsd: Number(row.total_theoretical_usd ?? 0),
    totalPaidUsd: Number(row.total_paid_usd ?? 0),
    totalExoneratedUsd: Number(row.total_exonerated_usd ?? 0)
  };
};
