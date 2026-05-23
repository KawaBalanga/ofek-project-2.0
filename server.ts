import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, initDb } from "./database.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Server will not start.");
  process.exit(1);
}

const GROUP_PERMISSIONS: Record<string, string[]> = {
  administrators: ['upload_collection', 'remove_collection', 'edit_tags', 'view_cart', 'send_interested', 'view_interested_lists', 'admin'],
  super_viewers: ['upload_collection', 'edit_tags', 'view_interested_lists'],
  shopers: ['upload_collection', 'edit_tags', 'view_interested_lists'],
  buyers: ['view_cart', 'remove_collection', 'send_interested'],
};
const SUPER_VIEWER_GROUPS = new Set(['super_viewers', 'administrators']);

function requirePermission(permission: string) {
  return (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      if (!payload.permissions.includes(permission)) {
        return res.status(403).json({ error: "You do not have permission to perform this action" });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.CLOUDINARY_URL) {
  const match = process.env.CLOUDINARY_URL.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    cloudinary.config({ api_key: match[1], api_secret: match[2], cloud_name: match[3], secure: true });
  }
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'YOUR_NAME',
    api_key: process.env.CLOUDINARY_API_KEY || 'YOUR_KEY',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'YOUR_SECRET',
    secure: true
  });
}

async function startServer() {
  await initDb();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const tags = req.body.tags ? req.body.tags.split(',') : [];
      const title = req.body.title || "Unnamed";
      const batchId = req.body.batchId || `batch_${Date.now()}`;
      return { folder: 'clothing_gallery', allowed_formats: ['jpg', 'png', 'jpeg'], tags, context: { caption: title, batchId }, resource_type: 'image' };
    },
  });

  const upload = multer({ storage });

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // Login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const r = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] });
    const user = r.rows[0] as any;
    if (!user || !bcrypt.compareSync(password, user.password as string)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    if (user.locked) return res.status(403).json({ error: "This account has been locked. Contact an administrator." });
    const [permsR, groupsR] = await Promise.all([
      db.execute({ sql: "SELECT permission FROM permissions WHERE user_id = ?", args: [user.id] }),
      db.execute({ sql: "SELECT group_name FROM user_groups WHERE user_id = ?", args: [user.id] }),
    ]);
    const groups = groupsR.rows.map((g: any) => g.group_name as string);
    const groupPerms = new Set<string>(groups.flatMap(g => GROUP_PERMISSIONS[g] || []));
    const indivPerms = permsR.rows.map((p: any) => p.permission as string);
    const permissions = [...new Set([...groupPerms, ...indivPerms])];
    const token = jwt.sign({ id: user.id, username: user.username, permissions, groups }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, permissions, groups } });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      res.json({ id: payload.id, username: payload.username, permissions: payload.permissions, groups: payload.groups || [] });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Get all images
  app.get('/api/images', async (_req, res) => {
    try {
      const config = cloudinary.config();
      if (!config.cloud_name || config.cloud_name === 'YOUR_NAME') throw new Error("Cloudinary is not configured.");

      const { resources } = await cloudinary.search.expression('folder:clothing_gallery').with_field('context').with_field('tags').sort_by('created_at', 'desc').max_results(500).execute();

      const [priceRes, titleRes, dateRes] = await Promise.all([
        db.execute('SELECT batch_id, price FROM collection_prices'),
        db.execute('SELECT batch_id, title FROM collection_titles'),
        db.execute('SELECT batch_id, uploaded_at, uploaded_by FROM collection_upload_dates'),
      ]);
      const priceMap: Record<string, number> = Object.fromEntries(priceRes.rows.map((r: any) => [r.batch_id, r.price]));
      const titleMap: Record<string, string> = Object.fromEntries(titleRes.rows.map((r: any) => [r.batch_id, r.title]));
      const dateMap: Record<string, string> = Object.fromEntries(dateRes.rows.map((r: any) => [r.batch_id, r.uploaded_at]));

      const images = resources.map((resource: any) => {
        const batchId = (resource.context && resource.context.batchId) || resource.public_id;
        return { id: resource.public_id, title: titleMap[batchId] || (resource.context && resource.context.caption) || "Unnamed", batchId, filename: resource.secure_url, tags: resource.tags || [] };
      });

      const groups = new Map<string, any>();
      images.forEach((img: any) => {
        if (!groups.has(img.batchId)) groups.set(img.batchId, { id: img.batchId, title: img.title, representativeImage: img.filename, images: [], tags: new Set() });
        const g = groups.get(img.batchId);
        g.images.push({ id: img.id, url: img.filename });
        img.tags.forEach((t: string) => g.tags.add(t));
      });

      const today = new Date().toISOString();
      const liveBatchIds = new Set(groups.keys());

      const orphanedIds = Object.keys(dateMap).filter(id => !liveBatchIds.has(id));
      const batchOps = [
        ...[...liveBatchIds].map(batchId => ({ sql: 'INSERT OR IGNORE INTO collection_upload_dates (batch_id, uploaded_at) VALUES (?, ?)', args: [batchId, today] as any[] })),
        ...orphanedIds.map(id => ({ sql: 'DELETE FROM collection_upload_dates WHERE batch_id = ?', args: [id] as any[] })),
      ];
      if (batchOps.length > 0) await db.batch(batchOps, 'deferred');

      const finalDateRes = await db.execute('SELECT batch_id, uploaded_at, uploaded_by FROM collection_upload_dates');
      const finalDateMap: Record<string, string> = Object.fromEntries(finalDateRes.rows.map((r: any) => [r.batch_id, r.uploaded_at]));
      const finalUploaderMap: Record<string, string> = Object.fromEntries(finalDateRes.rows.filter((r: any) => r.uploaded_by).map((r: any) => [r.batch_id, r.uploaded_by]));

      const collections: any[] = [];
      groups.forEach(g => {
        g.tags = Array.from(g.tags);
        g.price = priceMap[g.id] || 0;
        g.uploadedAt = finalDateMap[g.id] || null;
        g.uploadedBy = finalUploaderMap[g.id] || null;
        collections.push(g);
      });

      res.json(collections);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch images" });
    }
  });

  // Upload image
  app.post('/api/upload', requirePermission('upload_collection'), upload.single('image'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "Upload failed" });
    const batchId = req.body.batchId;
    if (batchId) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO collection_upload_dates (batch_id, uploaded_at, uploaded_by) VALUES (?, ?, ?)', args: [batchId, new Date().toISOString(), req.user.username] });
    }
    const resource = req.file;
    res.json({ success: true, file: { id: resource.public_id || resource.filename, title: req.body.title || "Unnamed", filename: resource.path || resource.secure_url, tags: req.body.tags ? req.body.tags.split(',') : [] } });
  });

  // Set price
  app.post('/api/set-price', requirePermission('upload_collection'), async (req, res) => {
    const { collectionId, price } = req.body;
    if (!collectionId) return res.status(400).json({ error: 'Missing collectionId' });
    await db.execute({ sql: 'INSERT OR REPLACE INTO collection_prices (batch_id, price) VALUES (?, ?)', args: [collectionId, Number(price) || 0] });
    res.json({ success: true });
  });

  // Update title
  app.post('/api/update-title', requirePermission('edit_tags'), async (req, res) => {
    const { collectionId, title } = req.body;
    if (!collectionId || !title) return res.status(400).json({ error: 'Missing fields' });
    await db.execute({ sql: 'INSERT OR REPLACE INTO collection_titles (batch_id, title) VALUES (?, ?)', args: [collectionId, title.trim()] });
    res.json({ success: true });
  });

  // Update tags
  app.post('/api/update-tags', requirePermission('edit_tags'), async (req, res) => {
    try {
      const { publicIds, tags } = req.body;
      if (!publicIds || !Array.isArray(publicIds)) return res.status(400).json({ error: "Missing IDs" });
      if (!tags || tags.length === 0) await cloudinary.uploader.remove_all_tags(publicIds);
      else await cloudinary.uploader.replace_tag(tags, publicIds);
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to update tags" }); }
  });

  // Delete image
  app.delete('/api/delete-image', requirePermission('remove_collection'), async (req, res) => {
    try {
      const { id, batchId } = req.query;
      if (!id) return res.status(400).json({ error: "Missing ID" });
      const cleanId = (id as string).split('.')[0];
      let result = await cloudinary.uploader.destroy(cleanId, { resource_type: 'image', invalidate: true });

      const cleanupBatch = async () => {
        if (!batchId) return;
        const bid = batchId as string;
        const remaining = await cloudinary.search.expression(`folder:clothing_gallery AND context.batchId=${bid}`).max_results(1).execute();
        if (remaining.resources.length === 0) {
          await db.execute({ sql: 'DELETE FROM collection_upload_dates WHERE batch_id = ?', args: [bid] });
          await db.execute({ sql: 'DELETE FROM collection_prices WHERE batch_id = ?', args: [bid] });
          await db.execute({ sql: 'DELETE FROM collection_titles WHERE batch_id = ?', args: [bid] });
        }
      };

      if (result.result === 'ok' || result.result === 'deleted') { await cleanupBatch(); return res.json({ success: true }); }
      if (result.result === 'not found' && !(cleanId).startsWith('clothing_gallery/')) {
        result = await cloudinary.uploader.destroy(`clothing_gallery/${cleanId}`, { resource_type: 'image', invalidate: true });
        if (result.result === 'ok' || result.result === 'deleted') { await cleanupBatch(); return res.json({ success: true }); }
      }
      if (result.result === 'not found') { await cleanupBatch(); return res.json({ success: true }); }
      res.status(500).json({ success: false, error: result.result });
    } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Tags
  app.get('/api/tags', async (_req, res) => {
    const r = await db.execute('SELECT name FROM tags ORDER BY name');
    res.json(r.rows.map((r: any) => r.name));
  });

  // Admin: get all users
  app.get('/api/admin/users', requirePermission('admin'), async (_req, res) => {
    const [usersR, permsR, groupsR] = await Promise.all([
      db.execute('SELECT id, username, locked FROM users ORDER BY id'),
      db.execute('SELECT user_id, permission FROM permissions'),
      db.execute('SELECT user_id, group_name FROM user_groups'),
    ]);
    const permMap: Record<number, string[]> = {};
    permsR.rows.forEach((p: any) => { if (!permMap[p.user_id]) permMap[p.user_id] = []; permMap[p.user_id].push(p.permission); });
    const groupMap: Record<number, string[]> = {};
    groupsR.rows.forEach((g: any) => { if (!groupMap[g.user_id]) groupMap[g.user_id] = []; groupMap[g.user_id].push(g.group_name); });
    res.json(usersR.rows.map((u: any) => ({ ...u, permissions: permMap[Number(u.id)] || [], groups: groupMap[Number(u.id)] || [] })));
  });

  // Admin: create user
  app.post('/api/admin/users', requirePermission('admin'), async (req, res) => {
    const { username, password, permissions, groups } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    try {
      const hash = bcrypt.hashSync(password, 10);
      const r = await db.execute({ sql: 'INSERT INTO users (username, password) VALUES (?, ?)', args: [username, hash] });
      const uid = Number(r.lastInsertRowid);
      if (Array.isArray(permissions)) {
        for (const p of permissions) await db.execute({ sql: 'INSERT INTO permissions (user_id, permission) VALUES (?, ?)', args: [uid, p] });
      }
      if (Array.isArray(groups)) {
        for (const g of groups) await db.execute({ sql: 'INSERT OR IGNORE INTO user_groups (user_id, group_name) VALUES (?, ?)', args: [uid, g] });
      }
      res.json({ success: true, id: uid });
    } catch { res.status(400).json({ error: 'Username already exists' }); }
  });

  // Admin: update user
  app.put('/api/admin/users/:id', requirePermission('admin'), async (req, res) => {
    const id = Number(req.params.id);
    const { username, password, permissions, groups } = req.body;
    if (username) await db.execute({ sql: 'UPDATE users SET username = ? WHERE id = ?', args: [username, id] });
    if (password) await db.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [bcrypt.hashSync(password, 10), id] });
    if (Array.isArray(permissions)) {
      await db.execute({ sql: 'DELETE FROM permissions WHERE user_id = ?', args: [id] });
      for (const p of permissions) await db.execute({ sql: 'INSERT INTO permissions (user_id, permission) VALUES (?, ?)', args: [id, p] });
    }
    if (Array.isArray(groups)) {
      await db.execute({ sql: 'DELETE FROM user_groups WHERE user_id = ?', args: [id] });
      for (const g of groups) await db.execute({ sql: 'INSERT INTO user_groups (user_id, group_name) VALUES (?, ?)', args: [id, g] });
    }
    res.json({ success: true });
  });

  // Admin: toggle lock
  app.patch('/api/admin/users/:id/lock', requirePermission('admin'), async (req: any, res) => {
    const id = Number(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: "Cannot lock yourself" });
    const r = await db.execute({ sql: 'SELECT locked FROM users WHERE id = ?', args: [id] });
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    const locked = r.rows[0].locked;
    await db.execute({ sql: 'UPDATE users SET locked = ? WHERE id = ?', args: [locked ? 0 : 1, id] });
    res.json({ success: true, locked: !locked });
  });

  // Admin: delete user
  app.delete('/api/admin/users/:id', requirePermission('admin'), async (req: any, res) => {
    const id = Number(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: "Cannot delete yourself" });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    res.json({ success: true });
  });

  // Admin: add tag
  app.post('/api/admin/tags', requirePermission('admin'), async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Tag name required' });
    const tag = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
    await db.execute({ sql: 'INSERT OR IGNORE INTO tags (name) VALUES (?)', args: [tag] });
    res.json({ success: true, name: tag });
  });

  // Admin: delete tag
  app.delete('/api/admin/tags/:name', requirePermission('admin'), async (req, res) => {
    await db.execute({ sql: 'DELETE FROM tags WHERE name = ?', args: [req.params.name] });
    res.json({ success: true });
  });

  // Submit interested list (buyer)
  app.post('/api/interested-lists', requirePermission('send_interested'), async (req: any, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });
    const r = await db.execute({ sql: 'INSERT INTO interested_lists (buyer_username, sent_at) VALUES (?, ?)', args: [req.user.username, new Date().toISOString()] });
    const listId = Number(r.lastInsertRowid);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const priceR = await db.execute({ sql: 'SELECT price FROM collection_prices WHERE batch_id = ?', args: [item.id] });
      const actualPrice = priceR.rows[0] ? (priceR.rows[0] as any).price : null;
      await db.execute({ sql: 'INSERT INTO interested_list_items (list_id, position, collection_id, collection_title, representative_image, price) VALUES (?, ?, ?, ?, ?, ?)', args: [listId, i + 1, item.id, item.title, item.representativeImage || null, actualPrice] });
    }
    res.json({ success: true, listId });
  });

  // Get my sent lists (buyer)
  app.get('/api/my-interested-lists', requirePermission('send_interested'), async (req: any, res) => {
    const [listsR, itemsR] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM interested_lists WHERE buyer_username = ? ORDER BY sent_at DESC', args: [req.user.username] }),
      db.execute('SELECT * FROM interested_list_items ORDER BY list_id, position'),
    ]);
    const itemsByList: Record<number, any[]> = {};
    itemsR.rows.forEach((item: any) => { if (!itemsByList[item.list_id]) itemsByList[item.list_id] = []; itemsByList[item.list_id].push(item); });
    res.json(listsR.rows.map((l: any) => ({ ...l, items: itemsByList[Number(l.id)] || [] })));
  });

  // Get all interested lists (shoper)
  app.get('/api/interested-lists', requirePermission('view_interested_lists'), async (req: any, res) => {
    const [listsR, allItemsR, uploaderR, handlesR] = await Promise.all([
      db.execute('SELECT * FROM interested_lists ORDER BY sent_at DESC'),
      db.execute('SELECT * FROM interested_list_items ORDER BY list_id, position'),
      db.execute('SELECT batch_id, uploaded_by FROM collection_upload_dates'),
      db.execute('SELECT * FROM interested_list_shoper_handles'),
    ]);

    const uploaderMap = Object.fromEntries(uploaderR.rows.map((r: any) => [r.batch_id, r.uploaded_by]));
    const allHandles = handlesR.rows as any[];
    const isSuperViewer = (req.user.groups || []).some((g: string) => SUPER_VIEWER_GROUPS.has(g));

    let visibleItems = allItemsR.rows as any[];
    if (!isSuperViewer) {
      const myR = await db.execute({ sql: 'SELECT batch_id FROM collection_upload_dates WHERE uploaded_by = ? OR uploaded_by IS NULL', args: [req.user.username] });
      const myBatchIds = new Set(myR.rows.map((r: any) => r.batch_id));
      visibleItems = visibleItems.filter((item: any) => myBatchIds.has(item.collection_id));
    }

    const enrichedItems = visibleItems.map((item: any) => ({ ...item, uploaded_by: uploaderMap[item.collection_id] || null }));
    const itemsByList: Record<number, any[]> = {};
    enrichedItems.forEach((item: any) => { if (!itemsByList[item.list_id]) itemsByList[item.list_id] = []; itemsByList[item.list_id].push(item); });

    const handlesByList: Record<number, any[]> = {};
    allHandles.forEach((h: any) => { if (!handlesByList[h.list_id]) handlesByList[h.list_id] = []; handlesByList[h.list_id].push(h); });

    const visibleLists = isSuperViewer ? listsR.rows : listsR.rows.filter((l: any) => (itemsByList[Number(l.id)]?.length ?? 0) > 0);

    res.json(visibleLists.map((l: any) => {
      const listItems = itemsByList[Number(l.id)] || [];
      const handles = handlesByList[Number(l.id)] || [];
      const handledUsernames = new Set(handles.map((h: any) => h.shoper_username));
      const uploaders = new Set(listItems.map((i: any) => i.uploaded_by).filter(Boolean));
      const all_shopers_handled = uploaders.size > 0 && [...uploaders].every(u => handledUsernames.has(u));
      const my_handled_at = handles.find((h: any) => h.shoper_username === req.user.username)?.handled_at || null;
      return { ...l, items: listItems, shoper_handles: handles, all_shopers_handled, my_handled_at };
    }));
  });

  // Shoper marks their portion handled
  app.patch('/api/interested-lists/:id/shoper-handle', requirePermission('view_interested_lists'), async (req: any, res) => {
    const id = Number(req.params.id);
    await db.execute({ sql: 'INSERT OR REPLACE INTO interested_list_shoper_handles (list_id, shoper_username, handled_at) VALUES (?, ?, ?)', args: [id, req.user.username, new Date().toISOString()] });
    res.json({ success: true });
  });

  // mega_shoper marks full list handled
  app.patch('/api/interested-lists/:id/handle', requirePermission('view_interested_lists'), async (req: any, res) => {
    await db.execute({ sql: 'UPDATE interested_lists SET handled_at = ?, handled_by = ? WHERE id = ?', args: [new Date().toISOString(), req.user.username, Number(req.params.id)] });
    res.json({ success: true });
  });

  // Delete interested list
  app.delete('/api/interested-lists/:id', requirePermission('view_interested_lists'), async (req, res) => {
    await db.execute({ sql: 'DELETE FROM interested_lists WHERE id = ? AND handled_at IS NOT NULL', args: [Number(req.params.id)] });
    res.json({ success: true });
  });

  // Send cart order (buyer)
  app.post('/api/cart-orders', requirePermission('view_cart'), async (req: any, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });
    const r = await db.execute({ sql: 'INSERT INTO cart_orders (buyer_username, sent_at) VALUES (?, ?)', args: [req.user.username, new Date().toISOString()] });
    const orderId = Number(r.lastInsertRowid);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const priceR = await db.execute({ sql: 'SELECT price FROM collection_prices WHERE batch_id = ?', args: [item.id] });
      const actualPrice = priceR.rows[0] ? (priceR.rows[0] as any).price : null;
      const quantity = Math.min(Math.max(1, Math.floor(Number(item.quantity) || 1)), 999);
      await db.execute({ sql: 'INSERT INTO cart_order_items (order_id, position, collection_id, collection_title, representative_image, price, quantity, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [orderId, i + 1, item.id, item.title, item.imageUrl || null, actualPrice, quantity, item.size || null] });
    }
    res.json({ success: true, orderId });
  });

  // Get my cart orders (buyer)
  app.get('/api/my-cart-orders', requirePermission('view_cart'), async (req: any, res) => {
    const [ordersR, itemsR] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM cart_orders WHERE buyer_username = ? ORDER BY sent_at DESC', args: [req.user.username] }),
      db.execute('SELECT * FROM cart_order_items ORDER BY order_id, position'),
    ]);
    const itemsByOrder: Record<number, any[]> = {};
    itemsR.rows.forEach((item: any) => { if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []; itemsByOrder[item.order_id].push(item); });
    res.json(ordersR.rows.map((o: any) => ({ ...o, items: itemsByOrder[Number(o.id)] || [] })));
  });

  // Get all cart orders (shoper)
  app.get('/api/cart-orders', requirePermission('view_interested_lists'), async (_req, res) => {
    const [ordersR, itemsR] = await Promise.all([
      db.execute('SELECT * FROM cart_orders ORDER BY sent_at DESC'),
      db.execute('SELECT * FROM cart_order_items ORDER BY order_id, position'),
    ]);
    const itemsByOrder: Record<number, any[]> = {};
    itemsR.rows.forEach((item: any) => { if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []; itemsByOrder[item.order_id].push(item); });
    res.json(ordersR.rows.map((o: any) => ({ ...o, items: itemsByOrder[Number(o.id)] || [] })));
  });

  // Mark cart order handled
  app.patch('/api/cart-orders/:id/handle', requirePermission('view_interested_lists'), async (req: any, res) => {
    await db.execute({ sql: 'UPDATE cart_orders SET handled_at = ?, handled_by = ? WHERE id = ?', args: [new Date().toISOString(), req.user.username, Number(req.params.id)] });
    res.json({ success: true });
  });

  // Delete cart order
  app.delete('/api/cart-orders/:id', requirePermission('view_interested_lists'), async (req, res) => {
    await db.execute({ sql: 'DELETE FROM cart_orders WHERE id = ? AND handled_at IS NOT NULL', args: [Number(req.params.id)] });
    res.json({ success: true });
  });

  // Vite / static
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer().catch(err => { console.error("Failed to start server:", err); process.exit(1); });
