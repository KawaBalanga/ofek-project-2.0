import dotenv from 'dotenv';
import { createClient, type Client } from '@libsql/client';
import bcrypt from 'bcryptjs';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db: Client = createClient({ url, authToken });

const ALL_PERMS = ['upload_collection', 'remove_collection', 'edit_tags', 'view_cart', 'send_interested', 'view_interested_lists', 'admin'];

async function seedUser(username: string, password: string, permissions: string[]) {
  const r = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
  if (r.rows.length === 0) {
    const hash = bcrypt.hashSync(password, 10);
    const ins = await db.execute({ sql: 'INSERT INTO users (username, password) VALUES (?, ?)', args: [username, hash] });
    const uid = Number(ins.lastInsertRowid);
    for (const p of permissions) {
      await db.execute({ sql: 'INSERT INTO permissions (user_id, permission) VALUES (?, ?)', args: [uid, p] });
    }
    console.log(`${username} user created`);
  }
}

export async function initDb() {
  await db.batch([
    { sql: `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0)` },
    { sql: `CREATE TABLE IF NOT EXISTS permissions (user_id INTEGER NOT NULL, permission TEXT NOT NULL, PRIMARY KEY (user_id, permission), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)` },
    { sql: `CREATE TABLE IF NOT EXISTS collection_prices (batch_id TEXT PRIMARY KEY, price REAL NOT NULL DEFAULT 0)` },
    { sql: `CREATE TABLE IF NOT EXISTS collection_titles (batch_id TEXT PRIMARY KEY, title TEXT NOT NULL)` },
    { sql: `CREATE TABLE IF NOT EXISTS collection_upload_dates (batch_id TEXT PRIMARY KEY, uploaded_at TEXT NOT NULL, uploaded_by TEXT)` },
    { sql: `CREATE TABLE IF NOT EXISTS interested_lists (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_username TEXT NOT NULL, sent_at TEXT NOT NULL, handled_at TEXT, handled_by TEXT)` },
    { sql: `CREATE TABLE IF NOT EXISTS interested_list_items (id INTEGER PRIMARY KEY AUTOINCREMENT, list_id INTEGER NOT NULL, position INTEGER NOT NULL, collection_id TEXT NOT NULL, collection_title TEXT NOT NULL, representative_image TEXT, price REAL, FOREIGN KEY (list_id) REFERENCES interested_lists(id) ON DELETE CASCADE)` },
    { sql: `CREATE TABLE IF NOT EXISTS interested_list_shoper_handles (list_id INTEGER NOT NULL, shoper_username TEXT NOT NULL, handled_at TEXT NOT NULL, PRIMARY KEY (list_id, shoper_username), FOREIGN KEY (list_id) REFERENCES interested_lists(id) ON DELETE CASCADE)` },
    { sql: `CREATE TABLE IF NOT EXISTS cart_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_username TEXT NOT NULL, sent_at TEXT NOT NULL, handled_at TEXT, handled_by TEXT)` },
    { sql: `CREATE TABLE IF NOT EXISTS cart_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, position INTEGER NOT NULL, collection_id TEXT NOT NULL, collection_title TEXT NOT NULL, representative_image TEXT, price REAL, quantity INTEGER NOT NULL DEFAULT 1, size TEXT, FOREIGN KEY (order_id) REFERENCES cart_orders(id) ON DELETE CASCADE)` },
    { sql: `CREATE TABLE IF NOT EXISTS tags (name TEXT PRIMARY KEY)` },
    { sql: `CREATE TABLE IF NOT EXISTS user_groups (user_id INTEGER NOT NULL, group_name TEXT NOT NULL, PRIMARY KEY (user_id, group_name), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)` },
  ], 'deferred');

  // Migrations
  for (const sql of [
    'ALTER TABLE interested_lists ADD COLUMN handled_at TEXT',
    'ALTER TABLE interested_lists ADD COLUMN handled_by TEXT',
    'ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE collection_upload_dates ADD COLUMN uploaded_by TEXT',
  ]) { try { await db.execute({ sql, args: [] }); } catch {} }

  // Rename migrations
  for (const sql of [
    "UPDATE users SET username = 'shoper1' WHERE username = 'shoper'",
    "UPDATE users SET username = 'buyer1' WHERE username = 'buyer'",
    "DELETE FROM users WHERE username = 'btest'",
    "DELETE FROM users WHERE username = 'stest'",
    "UPDATE users SET username = 'mega_shoper' WHERE username = 'mage_shoper'",
  ]) { try { await db.execute({ sql, args: [] }); } catch {} }

  // Seed users
  await seedUser('admin', 'admin', ALL_PERMS);
  const adminRow = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: ['admin'] });
  if (adminRow.rows.length > 0) {
    const adminId = Number(adminRow.rows[0].id);
    for (const p of ALL_PERMS) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO permissions (user_id, permission) VALUES (?, ?)', args: [adminId, p] });
    }
  }

  await seedUser('shoper1', 'shoper1', ['upload_collection', 'edit_tags', 'view_interested_lists']);
  await seedUser('buyer1', 'buyer1', ['view_cart', 'remove_collection', 'send_interested']);
  await seedUser('b_test', 'test', ['view_cart', 'remove_collection', 'send_interested']);
  await seedUser('s_test', 'test', ['upload_collection', 'edit_tags', 'view_interested_lists']);
  await seedUser('mega_shoper', 'megashoper', ['upload_collection', 'edit_tags', 'view_interested_lists']);

  // Permission migrations for existing users
  for (const [username, perm] of [['buyer1', 'send_interested'], ['shoper1', 'view_interested_lists']]) {
    const row = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
    if (row.rows.length > 0) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO permissions (user_id, permission) VALUES (?, ?)', args: [Number(row.rows[0].id), perm] });
    }
  }

  // Seed default group assignments for existing users
  const defaultGroups: [string, string][] = [
    ['admin', 'administrators'],
    ['mega_shoper', 'super_viewers'],
    ['shoper1', 'shopers'],
    ['buyer1', 'buyers'],
    ['b_test', 'buyers'],
    ['s_test', 'shopers'],
    ['charles', 'shopers'],
  ];
  for (const [username, group] of defaultGroups) {
    const row = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
    if (row.rows.length > 0) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO user_groups (user_id, group_name) VALUES (?, ?)', args: [Number(row.rows[0].id), group] });
    }
  }

  // Seed default tags
  for (const tag of ['Shirt', 'Pants', 'Skirt', 'Top', 'Dress', 'Bodysuit', 'Jacket']) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO tags (name) VALUES (?)', args: [tag] });
  }
}
