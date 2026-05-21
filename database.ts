import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';

const db = new Database(path.join(process.cwd(), 'database.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS permissions (
    user_id INTEGER NOT NULL,
    permission TEXT NOT NULL,
    PRIMARY KEY (user_id, permission),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS collection_prices (
    batch_id TEXT PRIMARY KEY,
    price REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS collection_titles (
    batch_id TEXT PRIMARY KEY,
    title TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collection_upload_dates (
    batch_id TEXT PRIMARY KEY,
    uploaded_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS interested_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_username TEXT NOT NULL,
    sent_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS interested_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    collection_id TEXT NOT NULL,
    collection_title TEXT NOT NULL,
    representative_image TEXT,
    price REAL,
    FOREIGN KEY (list_id) REFERENCES interested_lists(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS cart_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_username TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    handled_at TEXT,
    handled_by TEXT
  );
  CREATE TABLE IF NOT EXISTS interested_list_shoper_handles (
    list_id INTEGER NOT NULL,
    shoper_username TEXT NOT NULL,
    handled_at TEXT NOT NULL,
    PRIMARY KEY (list_id, shoper_username),
    FOREIGN KEY (list_id) REFERENCES interested_lists(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS cart_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    collection_id TEXT NOT NULL,
    collection_title TEXT NOT NULL,
    representative_image TEXT,
    price REAL,
    quantity INTEGER NOT NULL DEFAULT 1,
    size TEXT,
    FOREIGN KEY (order_id) REFERENCES cart_orders(id) ON DELETE CASCADE
  );
`);

// Migrate: add handled columns to interested_lists if missing
try { db.exec('ALTER TABLE interested_lists ADD COLUMN handled_at TEXT'); } catch {}
try { db.exec('ALTER TABLE interested_lists ADD COLUMN handled_by TEXT'); } catch {}

// Migrate: add locked column to users if missing
try { db.exec('ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0'); } catch {}

// Migrate: add uploaded_by column to collection_upload_dates if missing
try { db.exec('ALTER TABLE collection_upload_dates ADD COLUMN uploaded_by TEXT'); } catch {}

// Migrate: rename default shoper/buyer users to shoper1/buyer1
try { db.prepare("UPDATE users SET username = 'shoper1' WHERE username = 'shoper'").run(); } catch {}
try { db.prepare("UPDATE users SET username = 'buyer1' WHERE username = 'buyer'").run(); } catch {}

// Migrate: remove duplicate btest/stest created after manual rename to b_test/s_test
try { db.prepare("DELETE FROM users WHERE username = 'btest'").run(); } catch {}
try { db.prepare("DELETE FROM users WHERE username = 'stest'").run(); } catch {}

// Migrate: rename mage_shoper to mega_shoper
try { db.prepare("UPDATE users SET username = 'mega_shoper' WHERE username = 'mage_shoper'").run(); } catch {}

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as { id: number } | undefined;
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['upload_collection', 'remove_collection', 'edit_tags', 'view_cart', 'send_interested', 'view_interested_lists', 'admin']) {
    insertPerm.run(lastInsertRowid, p);
  }
  console.log('Admin user created');
}

// Grant all permissions to existing admin (migration)
const adminRow = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as { id: number } | undefined;
if (adminRow) {
  const grantAdmin = db.prepare('INSERT OR IGNORE INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['upload_collection', 'remove_collection', 'edit_tags', 'view_cart', 'send_interested', 'view_interested_lists', 'admin']) {
    grantAdmin.run(adminRow.id, p);
  }
}

const shoper1Exists = db.prepare('SELECT id FROM users WHERE username = ?').get('shoper1') as { id: number } | undefined;
if (!shoper1Exists) {
  const hash = bcrypt.hashSync('shoper1', 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('shoper1', hash);
  const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['upload_collection', 'edit_tags', 'view_interested_lists']) {
    insertPerm.run(lastInsertRowid, p);
  }
  console.log('Shoper1 user created');
}

const buyer1Exists = db.prepare('SELECT id FROM users WHERE username = ?').get('buyer1') as { id: number } | undefined;
if (!buyer1Exists) {
  const hash = bcrypt.hashSync('buyer1', 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('buyer1', hash);
  const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['view_cart', 'remove_collection', 'send_interested']) {
    insertPerm.run(lastInsertRowid, p);
  }
  console.log('Buyer1 user created');
}

const btestExists = db.prepare('SELECT id FROM users WHERE username = ?').get('b_test') as { id: number } | undefined;
if (!btestExists) {
  const hash = bcrypt.hashSync('test', 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('b_test', hash);
  const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['view_cart', 'remove_collection', 'send_interested']) {
    insertPerm.run(lastInsertRowid, p);
  }
  console.log('b_test user created');
}

const stestExists = db.prepare('SELECT id FROM users WHERE username = ?').get('s_test') as { id: number } | undefined;
if (!stestExists) {
  const hash = bcrypt.hashSync('test', 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('s_test', hash);
  const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['upload_collection', 'edit_tags', 'view_interested_lists']) {
    insertPerm.run(lastInsertRowid, p);
  }
  console.log('s_test user created');
}

const megaShoperExists = db.prepare('SELECT id FROM users WHERE username = ?').get('mega_shoper') as { id: number } | undefined;
if (!megaShoperExists) {
  const hash = bcrypt.hashSync('megashoper', 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('mega_shoper', hash);
  const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
  for (const p of ['upload_collection', 'edit_tags', 'view_interested_lists']) {
    insertPerm.run(lastInsertRowid, p);
  }
  console.log('Mega_shoper user created');
}

// Migrations for existing users
const migrate = db.prepare('INSERT OR IGNORE INTO permissions (user_id, permission) VALUES (?, ?)');
const buyer1Row = db.prepare('SELECT id FROM users WHERE username = ?').get('buyer1') as { id: number } | undefined;
if (buyer1Row) migrate.run(buyer1Row.id, 'send_interested');
const shoper1Row = db.prepare('SELECT id FROM users WHERE username = ?').get('shoper1') as { id: number } | undefined;
if (shoper1Row) migrate.run(shoper1Row.id, 'view_interested_lists');

// Tags table
db.exec(`CREATE TABLE IF NOT EXISTS tags (name TEXT PRIMARY KEY);`);
const defaultTags = ['Shirt', 'Pants', 'Skirt', 'Top', 'Dress', 'Bodysuit', 'Jacket'];
const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
defaultTags.forEach(t => insertTag.run(t));

export default db;
