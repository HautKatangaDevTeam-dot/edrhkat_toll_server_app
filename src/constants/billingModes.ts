export const BILLING_MODES = ['PAYG', 'PREPAID', 'POSTPAID'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];
