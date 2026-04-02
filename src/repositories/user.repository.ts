import { Role, ROLES } from '../constants/roles';
import { Post, POSTS } from '../constants/posts';
import pool from '../config/database';

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  refreshTokenHash: string | null;
  role: Role;
  post: Post;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRefreshSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  clientType: string;
  createdAt: Date;
  updatedAt: Date;
};

const mapRow = (row: any): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  refreshTokenHash: row.refresh_token_hash,
  role: row.role,
  post: row.post,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapSessionRow = (row: any): UserRefreshSession => ({
  id: row.id,
  userId: row.user_id,
  refreshTokenHash: row.refresh_token_hash,
  clientType: row.client_type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const ensureUsersTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      password_hash TEXT NOT NULL,
      refresh_token_hash TEXT,
      role VARCHAR(64) NOT NULL,
      post VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_username_key UNIQUE (username)
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(64) NOT NULL DEFAULT 'AGENT_TOLL';
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(64);
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS post VARCHAR(64) DEFAULT 'KAMPEMBA';
  `);

  await pool.query(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  `);

  await pool.query(`
    UPDATE users
    SET role = CASE role
      WHEN 'AGENT_CAISSIER' THEN 'AGENT_TOLL'
      WHEN 'SUPERVISOR_CHEF_POSTE' THEN 'SUPERVISEUR'
      WHEN 'FINANCE_CAISSE' THEN 'SUPERVISEUR'
      WHEN 'RECOUVREMENT_AGENT' THEN 'SUPERVISEUR'
      WHEN 'DECISIONNEUR_VI' THEN 'SUPERVISEUR'
      ELSE role
    END,
    username = COALESCE(username, 'user_' || substr(id::text, 1, 8)),
    post = COALESCE(post, 'KAMPEMBA');
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN username SET NOT NULL,
    ALTER COLUMN post SET NOT NULL,
    ALTER COLUMN role SET DEFAULT 'AGENT_TOLL';
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users(username);
  `);

  const allowedRoles = ROLES.map((r) => `'${r}'`).join(',');
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN (${allowedRoles}));
  `);

  const allowedPosts = POSTS.map((p) => `'${p}'`).join(',');
  await pool.query(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_post_check;
  `);
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_post_check CHECK (post IN (${allowedPosts}));
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
      ) THEN
        ALTER TABLE users DROP COLUMN email;
      END IF;
    END$$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_refresh_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL,
      client_type VARCHAR(32) NOT NULL DEFAULT 'web',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_refresh_sessions_user_id_idx
    ON user_refresh_sessions(user_id);
  `);
};

export const createUser = async (
  id: string,
  username: string,
  passwordHash: string,
  role: Role,
  post: Post
): Promise<User> => {
  const result = await pool.query(
    `
      INSERT INTO users (id, username, password_hash, role, post)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `,
    [id, username, passwordHash, role, post]
  );
  return mapRow(result.rows[0]);
};

export const updateUserCredentialsAndScope = async (
  username: string,
  passwordHash: string,
  role: Role,
  post: Post
): Promise<User | null> => {
  const result = await pool.query(
    `
      UPDATE users
      SET password_hash = $2,
          role = $3,
          post = $4,
          updated_at = NOW()
      WHERE username = $1
      RETURNING *;
    `,
    [username, passwordHash, role, post]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const updateUserById = async (
  id: string,
  username: string,
  role: Role,
  post: Post
): Promise<User | null> => {
  const result = await pool.query(
    `
      UPDATE users
      SET username = $2,
          role = $3,
          post = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [id, username, role, post]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const findByUsername = async (username: string): Promise<User | null> => {
  const result = await pool.query(`SELECT * FROM users WHERE username = $1 LIMIT 1;`, [username]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const listUsers = async (
  search: string | null,
  role: string | null,
  post: string | null,
  limit: number,
  offset: number
): Promise<{ rows: User[]; total: number }> => {
  const params: any[] = [];
  const where: string[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`LOWER(username) LIKE $${params.length}`);
  }

  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }

  if (post) {
    params.push(post);
    where.push(`post = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataQuery = `
    SELECT * FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM users
    ${whereClause};
  `;

  const dataParams = [...params, limit, offset];
  const [{ rows: dataRows }, { rows: countRows }] = await Promise.all([
    pool.query(dataQuery, dataParams),
    pool.query(countQuery, params)
  ]);

  return {
    rows: dataRows.map(mapRow),
    total: Number(countRows[0].total)
  };
};

export const findById = async (id: string): Promise<User | null> => {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1;`, [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const saveRefreshToken = async (id: string, refreshTokenHash: string | null): Promise<void> => {
  await pool.query(
    `
      UPDATE users
      SET refresh_token_hash = $2,
          updated_at = NOW()
      WHERE id = $1;
    `,
    [id, refreshTokenHash]
  );
};

export const saveRefreshSession = async (
  sessionId: string,
  userId: string,
  refreshTokenHash: string,
  clientType: string
): Promise<void> => {
  await pool.query(
    `
      INSERT INTO user_refresh_sessions (id, user_id, refresh_token_hash, client_type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id)
      DO UPDATE SET
        refresh_token_hash = EXCLUDED.refresh_token_hash,
        client_type = EXCLUDED.client_type,
        updated_at = NOW();
    `,
    [sessionId, userId, refreshTokenHash, clientType]
  );
};

export const findRefreshSessionById = async (
  sessionId: string
): Promise<UserRefreshSession | null> => {
  const result = await pool.query(
    `SELECT * FROM user_refresh_sessions WHERE id = $1 LIMIT 1;`,
    [sessionId]
  );
  return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
};

export const deleteRefreshSessionById = async (sessionId: string): Promise<void> => {
  await pool.query(`DELETE FROM user_refresh_sessions WHERE id = $1;`, [sessionId]);
};

export const deleteAllRefreshSessionsForUser = async (userId: string): Promise<void> => {
  await pool.query(`DELETE FROM user_refresh_sessions WHERE user_id = $1;`, [userId]);
};

export const updateUserPasswordById = async (
  id: string,
  passwordHash: string
): Promise<User | null> => {
  const result = await pool.query(
    `
      UPDATE users
      SET password_hash = $2,
          refresh_token_hash = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [id, passwordHash]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};
