import pool from '../config/database';

export type RegisteredPublicKey = {
  keyId: string;
  publicKey: string;
  label: string;
  status: 'active' | 'legacy' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId: string | null;
  updatedByUsername: string | null;
};

export type PublishedKeyBundle = {
  bundleJson: string;
  updatedAt: Date;
  updatedByUserId: string | null;
  updatedByUsername: string | null;
};

type IncomingBundleEntry = {
  keyId: string;
  publicKey: string;
  label?: string;
  status?: 'active' | 'legacy' | 'revoked' | string;
  createdAt?: string;
};

const normalizeStatus = (value: string | undefined): RegisteredPublicKey['status'] => {
  if (value === 'revoked') return 'revoked';
  if (value === 'legacy') return 'legacy';
  return 'active';
};

const moreRestrictiveStatus = (
  left: RegisteredPublicKey['status'],
  right: RegisteredPublicKey['status']
): RegisteredPublicKey['status'] => {
  const rank = (value: RegisteredPublicKey['status']) => {
    switch (value) {
      case 'active':
        return 0;
      case 'legacy':
        return 1;
      case 'revoked':
        return 2;
    }
  };

  return rank(left) >= rank(right) ? left : right;
};

const parseBundle = (bundleJson: string): IncomingBundleEntry[] => {
  const parsed = JSON.parse(bundleJson) as {
    keys?: IncomingBundleEntry[];
  };

  if (!Array.isArray(parsed.keys)) {
    return [];
  }

  return parsed.keys.filter(
    (entry): entry is IncomingBundleEntry =>
      Boolean(entry?.keyId?.trim()) && Boolean(entry?.publicKey?.trim())
  );
};

const buildBundleJson = (keys: RegisteredPublicKey[]) =>
  JSON.stringify({
    version: keys.length + 1,
    updatedAt: new Date().toISOString(),
    keys: keys.map((key) => ({
      keyId: key.keyId,
      publicKey: key.publicKey,
      label: key.label,
      status: key.status,
      createdAt: key.createdAt.toISOString()
    }))
  });

const mapRow = (row: any): RegisteredPublicKey => ({
  keyId: row.key_id,
  publicKey: row.public_key,
  label: row.label ?? '',
  status: normalizeStatus(row.status),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  updatedByUserId: row.updated_by_user_id ?? null,
  updatedByUsername: row.updated_by_username ?? null
});

export const ensureKeyBundleTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pos_public_keys (
      key_id VARCHAR(64) PRIMARY KEY,
      public_key TEXT NOT NULL,
      label VARCHAR(160) NOT NULL DEFAULT '',
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by_username VARCHAR(64)
    );
  `);
  await pool.query(`ALTER TABLE pos_public_keys ADD COLUMN IF NOT EXISTS label VARCHAR(160) NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE pos_public_keys ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';`);
  await pool.query(`ALTER TABLE pos_public_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  await pool.query(`ALTER TABLE pos_public_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  await pool.query(`ALTER TABLE pos_public_keys ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE pos_public_keys ADD COLUMN IF NOT EXISTS updated_by_username VARCHAR(64);`);
};

export const listRegisteredPublicKeys = async (): Promise<RegisteredPublicKey[]> => {
  const result = await pool.query(
    `
      SELECT
        key_id,
        public_key,
        label,
        status,
        created_at,
        updated_at,
        updated_by_user_id,
        updated_by_username
      FROM pos_public_keys
      ORDER BY updated_at DESC, key_id ASC;
    `
  );

  return result.rows.map(mapRow);
};

export const getPublishedKeyBundle = async (): Promise<PublishedKeyBundle | null> => {
  const keys = await listRegisteredPublicKeys();
  if (keys.length === 0) {
    return null;
  }

  const latest = keys.reduce((current, entry) =>
    current.updatedAt >= entry.updatedAt ? current : entry
  );

  return {
    bundleJson: buildBundleJson(keys),
    updatedAt: latest.updatedAt,
    updatedByUserId: latest.updatedByUserId,
    updatedByUsername: latest.updatedByUsername
  };
};

export const publishKeyBundle = async (input: {
  bundleJson: string;
  updatedByUserId?: string | null;
  updatedByUsername?: string | null;
}): Promise<PublishedKeyBundle> => {
  const entries = parseBundle(input.bundleJson);

  for (const entry of entries) {
    const existing = await pool.query(
      `
        SELECT key_id, public_key, label, status, created_at
        FROM pos_public_keys
        WHERE key_id = $1
        LIMIT 1;
      `,
      [entry.keyId]
    );

    const existingRow = existing.rows[0];
    const nextStatus = existingRow
      ? moreRestrictiveStatus(normalizeStatus(existingRow.status), normalizeStatus(entry.status))
      : normalizeStatus(entry.status);

    const nextCreatedAt =
      existingRow?.created_at ??
      (entry.createdAt ? new Date(entry.createdAt) : new Date());

    await pool.query(
      `
        INSERT INTO pos_public_keys (
          key_id,
          public_key,
          label,
          status,
          created_at,
          updated_at,
          updated_by_user_id,
          updated_by_username
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        ON CONFLICT (key_id)
        DO UPDATE SET
          public_key = EXCLUDED.public_key,
          label = CASE
            WHEN EXCLUDED.label <> '' THEN EXCLUDED.label
            ELSE pos_public_keys.label
          END,
          status = EXCLUDED.status,
          updated_at = NOW(),
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_by_username = EXCLUDED.updated_by_username;
      `,
      [
        entry.keyId,
        entry.publicKey,
        entry.label?.trim() ?? '',
        nextStatus,
        nextCreatedAt,
        input.updatedByUserId ?? null,
        input.updatedByUsername ?? null
      ]
    );
  }

  const bundle = await getPublishedKeyBundle();
  if (!bundle) {
    throw new Error('Published key registry is empty');
  }
  return bundle;
};
