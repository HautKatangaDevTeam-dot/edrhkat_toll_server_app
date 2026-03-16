import 'dotenv/config';
import crypto from 'crypto';
import pool from '../src/config/database';
import { ensureCompaniesTable } from '../src/repositories/company.repository';
import { ensureTollTransactionsTable } from '../src/repositories/toll.repository';

const COMPANY_NAMES = [
  'BOSS MINING',
  'C.D.M SAS',
  'CHEMICAL OF AFRICA (CHEMAF)',
  'COMIKA',
  'COMILU',
  'CONGO JIN JU',
  'CONGO MOON MINING',
  'COPROCO',
  'DIVINELAND MINING',
  'EPSILON',
  'EVERBRIGTH',
  'EXCELLENCE M',
  'FRONTIERS S.A',
  'GECAMINES',
  'GOLDEN AFRICA',
  'HUACHIN MABENDE',
  'HUACHIN METALS',
  'KAIPENG',
  'KAMBOVE MINING',
  'KASONTA MINING',
  'KICC',
  'KICO',
  'LUALABA MINING',
  'M.J.M',
  'M.M.G',
  'M.M.R SAS',
  'METAL MINES',
  'MIKAS SAS',
  'MM MINING',
  'MPC',
  'MSL',
  'NATIONAL METAL',
  'NEW CONGO',
  'NEW MINERALS I',
  'NOV CORPS',
  'RUASHI MINING',
  'RUBAMIN',
  'S.E.K',
  'SABWE MINING',
  'SEMHKAT',
  'SHITURU MINING',
  'SINO KATANGA',
  'SOMIKA SPRL',
  'STAR METAL',
  'STL'
];

const slugCode = (name: string, index: number) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .concat('_', String(index + 1));

const run = async () => {
  await ensureCompaniesTable();
  await ensureTollTransactionsTable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE toll_transactions RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE companies RESTART IDENTITY CASCADE');

    for (const [index, name] of COMPANY_NAMES.entries()) {
      await client.query(
        `
          INSERT INTO companies (id, name, code, billing_mode, is_active)
          VALUES ($1, $2, $3, 'PAYG', TRUE)
        `,
        [crypto.randomUUID(), name, slugCode(name, index)]
      );
    }
    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log(`Seeded ${COMPANY_NAMES.length} companies.`);
  } catch (error) {
    await client.query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('Seeding failed', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

void run();
