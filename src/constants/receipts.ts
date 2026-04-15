export const RECEIPT_TAX_TYPES = ['TRANSPORT', 'TRANSFERT'] as const;
export type ReceiptTaxType = (typeof RECEIPT_TAX_TYPES)[number];

export const RECEIPT_FINANCIAL_MODES = ['NORMAL', 'EXONERATED'] as const;
export type ReceiptFinancialMode = (typeof RECEIPT_FINANCIAL_MODES)[number];

export const RECEIPT_STATUSES = ['ISSUED', 'CONSUMED', 'CANCELLED', 'VOID'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_CHANNELS = ['COMPANY_BATCH', 'SINGLE_TOLL', 'EXCEPTIONAL_TOLL'] as const;
export type ReceiptChannel = (typeof RECEIPT_CHANNELS)[number];

export const RECEIPT_BATCH_CORRECTION_MODES = ['TRANSFER_ALL', 'MOVE_REMAINING'] as const;
export type ReceiptBatchCorrectionMode = (typeof RECEIPT_BATCH_CORRECTION_MODES)[number];
