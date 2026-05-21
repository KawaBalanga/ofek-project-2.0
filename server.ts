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
import rateLimit from "express-rate-limit";
import db from "./database.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Server will not start.");
  process.exit(1);
}

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

// Cloudinary Configuration
// dotenv runs before this block, but ES module imports are hoisted, so the SDK
// never auto-reads CLOUDINARY_URL at import time — we must parse and set it explicitly.
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
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Multer Storage Configuration for Cloudinary
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const tags = req.body.tags ? req.body.tags.split(',') : [];
      const title = req.body.title || "Unnamed";
      const batchId = req.body.batchId || `batch_${Date.now()}`;
      
      return {
        folder: 'clothing_gallery',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        tags: tags,
        context: { caption: title, batchId: batchId },
        resource_type: 'image'
      };
    },
  });

  const upload = multer({ storage: storage });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/auth/login", loginLimiter, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    if (user.locked) {
      return res.status(403).json({ error: "This account has been locked. Contact an administrator." });
    }
    const permissions = (db.prepare("SELECT permission FROM permissions WHERE user_id = ?").all(user.id) as any[]).map(p => p.permission);
    const token = jwt.sign({ id: user.id, username: user.username, permissions }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, permissions } });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      res.json({ id: payload.id, username: payload.username, permissions: payload.permissions });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Get all images
  app.get('/api/images', async (req, res) => {
    try {
      // Check if configured
      const config = cloudinary.config();
      if (!config.cloud_name || config.cloud_name === 'YOUR_NAME') {
        throw new Error("Cloudinary is not configured. Please set CLOUDINARY_URL in your environment variables.");
      }

      // Use Search API for more reliable and up-to-date results
      const { resources } = await cloudinary.search
        .expression('folder:clothing_gallery')
        .with_field('context')
        .with_field('tags')
        .sort_by('created_at', 'desc')
        .max_results(500)
        .execute();

      const priceRows = db.prepare('SELECT batch_id, price FROM collection_prices').all() as any[];
      const priceMap: Record<string, number> = Object.fromEntries(priceRows.map(r => [r.batch_id, r.price]));

      const titleRows = db.prepare('SELECT batch_id, title FROM collection_titles').all() as any[];
      const titleMap: Record<string, string> = Object.fromEntries(titleRows.map(r => [r.batch_id, r.title]));

      const dateRows = db.prepare('SELECT batch_id, uploaded_at FROM collection_upload_dates').all() as any[];
      const dateMap: Record<string, string> = Object.fromEntries(dateRows.map(r => [r.batch_id, r.uploaded_at]));

      const images = resources.map((resource: any) => {
        const batchId = (resource.context && resource.context.batchId) || resource.public_id;
        return {
          id: resource.public_id,
          title: titleMap[batchId] || (resource.context && resource.context.caption) || "Unnamed",
          batchId,
          filename: resource.secure_url,
          tags: resource.tags || []
        };
      });

      // Group images by batchId to form collections
      const collections: any[] = [];
      const groups = new Map<string, any>();

      images.forEach((img: any) => {
        if (!groups.has(img.batchId)) {
          groups.set(img.batchId, {
            id: img.batchId,
            title: img.title,
            representativeImage: img.filename,
            images: [],
            tags: new Set()
          });
        }
        const group = groups.get(img.batchId);
        group.images.push({ id: img.id, url: img.filename });
        img.tags.forEach((tag: string) => group.tags.add(tag));
      });

      // Seed today's date for any batch not yet in DB; clean up orphaned DB entries
      const today = new Date().toISOString();
      const liveBatchIds = new Set(groups.keys());
      const insertDate = db.prepare('INSERT OR IGNORE INTO collection_upload_dates (batch_id, uploaded_at) VALUES (?, ?)');
      liveBatchIds.forEach(batchId => insertDate.run(batchId, today));

      const orphanedIds = Object.keys(dateMap).filter(id => !liveBatchIds.has(id));
      if (orphanedIds.length > 0) {
        const del = db.prepare('DELETE FROM collection_upload_dates WHERE batch_id = ?');
        orphanedIds.forEach(id => del.run(id));
      }

      // Re-read dates after seeding
      const finalDateRows = db.prepare('SELECT batch_id, uploaded_at FROM collection_upload_dates').all() as any[];
      const finalDateMap: Record<string, string> = Object.fromEntries(finalDateRows.map(r => [r.batch_id, r.uploaded_at]));

      // Convert Sets to Arrays
      groups.forEach((group) => {
        group.tags = Array.from(group.tags);
        group.price = priceMap[group.id] || 0;
        group.uploadedAt = finalDateMap[group.id] || null;
        collections.push(group);
      });

      res.json(collections);
    } catch (error: any) {
      console.error("Fetch images error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch images from Cloudinary" });
    }
  });

  // Upload image
  app.post('/api/upload', requirePermission('upload_collection'), upload.single('image'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "Upload failed" });

    const batchId = req.body.batchId;
    if (batchId) {
      db.prepare('INSERT OR IGNORE INTO collection_upload_dates (batch_id, uploaded_at, uploaded_by) VALUES (?, ?, ?)').run(batchId, new Date().toISOString(), req.user.username);
    }

    const resource = req.file;
    const newItem = {
      id: resource.public_id || resource.filename,
      title: req.body.title || "Unnamed",
      filename: resource.path || resource.secure_url,
      tags: req.body.tags ? req.body.tags.split(',') : []
    };

    res.json({ success: true, file: newItem });
  });

  // Set price for a collection
  app.post('/api/set-price', requirePermission('upload_collection'), (req, res) => {
    const { collectionId, price } = req.body;
    if (!collectionId) return res.status(400).json({ error: 'Missing collectionId' });
    db.prepare('INSERT OR REPLACE INTO collection_prices (batch_id, price) VALUES (?, ?)').run(collectionId, Number(price) || 0);
    res.json({ success: true });
  });

  // Update collection title
  app.post('/api/update-title', requirePermission('edit_tags'), (req, res) => {
    const { collectionId, title } = req.body;
    if (!collectionId || !title) return res.status(400).json({ error: 'Missing fields' });
    db.prepare('INSERT OR REPLACE INTO collection_titles (batch_id, title) VALUES (?, ?)').run(collectionId, title.trim());
    res.json({ success: true });
  });

  // Update tags
  app.post('/api/update-tags', requirePermission('edit_tags'), async (req, res) => {
    try {
      const { publicIds, tags } = req.body;
      if (!publicIds || !Array.isArray(publicIds)) return res.status(400).json({ error: "Missing IDs" });

      console.log(`Updating tags for ${publicIds.length} items:`, tags);

      if (!tags || tags.length === 0) {
        await cloudinary.uploader.remove_all_tags(publicIds);
      } else {
        await cloudinary.uploader.replace_tag(tags, publicIds);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: "Failed to update tags" });
    }
  });

  // Delete image
  app.delete('/api/delete-image', requirePermission('remove_collection'), async (req, res) => {
    try {
      const { id, batchId } = req.query;
      if (!id) return res.status(400).json({ error: "Missing ID" });
      
      let publicId = id as string;
      console.log(`[Delete] Request for ID: ${publicId}`);

      // Cloudinary destroy expects public_id without extension
      const cleanId = publicId.split('.')[0];
      
      // Try destroying as specified
      let result = await cloudinary.uploader.destroy(cleanId, { 
        resource_type: 'image', 
        invalidate: true 
      });
      
      console.log(`[Delete] Primary attempt for ${cleanId}:`, result);

      const cleanupBatch = async () => {
        if (!batchId) return;
        const bid = batchId as string;
        const remaining = await cloudinary.search
          .expression(`folder:clothing_gallery AND context.batchId=${bid}`)
          .max_results(1)
          .execute();
        if (remaining.resources.length === 0) {
          db.prepare('DELETE FROM collection_upload_dates WHERE batch_id = ?').run(bid);
          db.prepare('DELETE FROM collection_prices WHERE batch_id = ?').run(bid);
          db.prepare('DELETE FROM collection_titles WHERE batch_id = ?').run(bid);
        }
      };

      // Successfully deleted or not found (which means it's already gone)
      if (result.result === 'ok' || result.result === 'deleted') {
        await cleanupBatch();
        return res.json({ success: true, result: result.result });
      }

      // If primary failed, try with folder prefix if it's missing
      if (result.result === 'not found' && !cleanId.startsWith('clothing_gallery/')) {
        const altId = `clothing_gallery/${cleanId}`;
        console.log(`[Delete] Retrying with folder: ${altId}`);
        result = await cloudinary.uploader.destroy(altId, {
          resource_type: 'image',
          invalidate: true
        });
        console.log(`[Delete] Retry result:`, result);

        if (result.result === 'ok' || result.result === 'deleted') {
          await cleanupBatch();
          return res.json({ success: true, result: result.result });
        }
      }

      // If we reach here and it's 'not found', it's functionally gone
      if (result.result === 'not found') {
        await cleanupBatch();
        return res.json({ success: true, message: "Item was not found but considered removed" });
      }

      res.status(500).json({ success: false, error: result.result || "Cloudinary deletion failed" });
    } catch (error: any) {
      console.error("[Delete] Exception:", error);
      res.status(500).json({ success: false, error: error.message || "Internal server error during deletion" });
    }
  });

  // Public: get tags
  app.get('/api/tags', (_req, res) => {
    const tags = (db.prepare('SELECT name FROM tags ORDER BY name').all() as any[]).map(r => r.name);
    res.json(tags);
  });

  // Admin: get all users
  app.get('/api/admin/users', requirePermission('admin'), (_req, res) => {
    const users = db.prepare('SELECT id, username, locked FROM users ORDER BY id').all() as any[];
    const perms = db.prepare('SELECT user_id, permission FROM permissions').all() as any[];
    const permMap: Record<number, string[]> = {};
    perms.forEach((p: any) => { if (!permMap[p.user_id]) permMap[p.user_id] = []; permMap[p.user_id].push(p.permission); });
    res.json(users.map(u => ({ ...u, permissions: permMap[u.id] || [] })));
  });

  // Admin: create user
  app.post('/api/admin/users', requirePermission('admin'), (req, res) => {
    const { username, password, permissions } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    try {
      const hash = bcrypt.hashSync(password, 10);
      const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
      const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
      if (Array.isArray(permissions)) permissions.forEach((p: string) => insertPerm.run(lastInsertRowid, p));
      res.json({ success: true, id: Number(lastInsertRowid) });
    } catch { res.status(400).json({ error: 'Username already exists' }); }
  });

  // Admin: update user
  app.put('/api/admin/users/:id', requirePermission('admin'), (req, res) => {
    const id = Number(req.params.id);
    const { username, password, permissions } = req.body;
    if (username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
    if (password) db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
    if (Array.isArray(permissions)) {
      db.prepare('DELETE FROM permissions WHERE user_id = ?').run(id);
      const insertPerm = db.prepare('INSERT INTO permissions (user_id, permission) VALUES (?, ?)');
      permissions.forEach((p: string) => insertPerm.run(id, p));
    }
    res.json({ success: true });
  });

  // Admin: toggle user lock
  app.patch('/api/admin/users/:id/lock', requirePermission('admin'), (req: any, res) => {
    const id = Number(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: "Cannot lock yourself" });
    const user = db.prepare('SELECT locked FROM users WHERE id = ?').get(id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.prepare('UPDATE users SET locked = ? WHERE id = ?').run(user.locked ? 0 : 1, id);
    res.json({ success: true, locked: !user.locked });
  });

  // Admin: delete user
  app.delete('/api/admin/users/:id', requirePermission('admin'), (req: any, res) => {
    const id = Number(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: "Cannot delete yourself" });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Admin: add tag
  app.post('/api/admin/tags', requirePermission('admin'), (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Tag name required' });
    const tag = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag);
    res.json({ success: true, name: tag });
  });

  // Admin: delete tag
  app.delete('/api/admin/tags/:name', requirePermission('admin'), (req, res) => {
    db.prepare('DELETE FROM tags WHERE name = ?').run(req.params.name);
    res.json({ success: true });
  });

  // Submit an interested list (buyer)
  app.post('/api/interested-lists', requirePermission('send_interested'), (req: any, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });
    const { lastInsertRowid } = db.prepare('INSERT INTO interested_lists (buyer_username, sent_at) VALUES (?, ?)').run(req.user.username, new Date().toISOString());
    const insertItem = db.prepare('INSERT INTO interested_list_items (list_id, position, collection_id, collection_title, representative_image, price) VALUES (?, ?, ?, ?, ?, ?)');
    items.forEach((item: any, idx: number) => {
      const priceRow = db.prepare('SELECT price FROM collection_prices WHERE batch_id = ?').get(item.id) as any;
      const actualPrice = priceRow ? priceRow.price : null;
      insertItem.run(lastInsertRowid, idx + 1, item.id, item.title, item.representativeImage || null, actualPrice);
    });
    res.json({ success: true, listId: Number(lastInsertRowid) });
  });

  // Get my sent lists (buyer)
  app.get('/api/my-interested-lists', requirePermission('send_interested'), (req: any, res) => {
    const lists = db.prepare('SELECT * FROM interested_lists WHERE buyer_username = ? ORDER BY sent_at DESC').all(req.user.username) as any[];
    const items = db.prepare('SELECT * FROM interested_list_items ORDER BY list_id, position').all() as any[];
    const itemsByList: Record<number, any[]> = {};
    items.forEach((item: any) => {
      if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
      itemsByList[item.list_id].push(item);
    });
    res.json(lists.map(l => ({ ...l, items: itemsByList[l.id] || [] })));
  });

  // Get all interested lists (shoper) — mega_shoper sees everything, others see only their uploaded items
  app.get('/api/interested-lists', requirePermission('view_interested_lists'), (req: any, res) => {
    const lists = db.prepare('SELECT * FROM interested_lists ORDER BY sent_at DESC').all() as any[];
    const allItems = db.prepare('SELECT * FROM interested_list_items ORDER BY list_id, position').all() as any[];
    const uploaderMap = Object.fromEntries(
      (db.prepare('SELECT batch_id, uploaded_by FROM collection_upload_dates').all() as any[])
        .map((r: any) => [r.batch_id, r.uploaded_by])
    );
    const allHandles = db.prepare('SELECT * FROM interested_list_shoper_handles').all() as any[];

    const isSuperViewer = req.user.username === 'mega_shoper' || req.user.permissions.includes('admin');
    let visibleItems = allItems;
    if (!isSuperViewer) {
      const myCollections = db.prepare('SELECT batch_id FROM collection_upload_dates WHERE uploaded_by = ?').all(req.user.username) as any[];
      const myBatchIds = new Set(myCollections.map((r: any) => r.batch_id));
      visibleItems = allItems.filter((item: any) => myBatchIds.has(item.collection_id));
    }

    const enrichedItems = visibleItems.map((item: any) => ({ ...item, uploaded_by: uploaderMap[item.collection_id] || null }));

    const itemsByList: Record<number, any[]> = {};
    enrichedItems.forEach((item: any) => {
      if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
      itemsByList[item.list_id].push(item);
    });

    const handlesByList: Record<number, any[]> = {};
    allHandles.forEach((h: any) => {
      if (!handlesByList[h.list_id]) handlesByList[h.list_id] = [];
      handlesByList[h.list_id].push(h);
    });

    const visibleLists = isSuperViewer
      ? lists
      : lists.filter((l: any) => (itemsByList[l.id]?.length ?? 0) > 0);

    res.json(visibleLists.map((l: any) => {
      const listItems = itemsByList[l.id] || [];
      const handles = handlesByList[l.id] || [];
      const handledUsernames = new Set(handles.map((h: any) => h.shoper_username));
      const uploaders = new Set(listItems.map((i: any) => i.uploaded_by).filter(Boolean));
      const all_shopers_handled = uploaders.size > 0 && [...uploaders].every(u => handledUsernames.has(u));
      const my_handled_at = handles.find((h: any) => h.shoper_username === req.user.username)?.handled_at || null;
      return { ...l, items: listItems, shoper_handles: handles, all_shopers_handled, my_handled_at };
    }));
  });

  // Mark shoper's portion of interested list as handled
  app.patch('/api/interested-lists/:id/shoper-handle', requirePermission('view_interested_lists'), (req: any, res) => {
    const id = Number(req.params.id);
    db.prepare('INSERT OR REPLACE INTO interested_list_shoper_handles (list_id, shoper_username, handled_at) VALUES (?, ?, ?)').run(id, req.user.username, new Date().toISOString());
    res.json({ success: true });
  });

  // Mark full interested list as handled (mega_shoper only, after all shopers handled)
  app.patch('/api/interested-lists/:id/handle', requirePermission('view_interested_lists'), (req: any, res) => {
    const { id } = req.params;
    db.prepare('UPDATE interested_lists SET handled_at = ?, handled_by = ? WHERE id = ?').run(new Date().toISOString(), req.user.username, Number(id));
    res.json({ success: true });
  });

  // Send cart as order (buyer)
  app.post('/api/cart-orders', requirePermission('view_cart'), (req: any, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });
    const { lastInsertRowid } = db.prepare('INSERT INTO cart_orders (buyer_username, sent_at) VALUES (?, ?)').run(req.user.username, new Date().toISOString());
    const insertItem = db.prepare('INSERT INTO cart_order_items (order_id, position, collection_id, collection_title, representative_image, price, quantity, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    items.forEach((item: any, idx: number) => {
      const priceRow = db.prepare('SELECT price FROM collection_prices WHERE batch_id = ?').get(item.id) as any;
      const actualPrice = priceRow ? priceRow.price : null;
      const quantity = Math.min(Math.max(1, Math.floor(Number(item.quantity) || 1)), 999);
      insertItem.run(lastInsertRowid, idx + 1, item.id, item.title, item.imageUrl || null, actualPrice, quantity, item.size || null);
    });
    res.json({ success: true, orderId: Number(lastInsertRowid) });
  });

  // Get my cart orders (buyer)
  app.get('/api/my-cart-orders', requirePermission('view_cart'), (req: any, res) => {
    const orders = db.prepare('SELECT * FROM cart_orders WHERE buyer_username = ? ORDER BY sent_at DESC').all(req.user.username) as any[];
    const allItems = db.prepare('SELECT * FROM cart_order_items ORDER BY order_id, position').all() as any[];
    const itemsByOrder: Record<number, any[]> = {};
    allItems.forEach((item: any) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });
    res.json(orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })));
  });

  // Get all cart orders (shoper)
  app.get('/api/cart-orders', requirePermission('view_interested_lists'), (_req, res) => {
    const orders = db.prepare('SELECT * FROM cart_orders ORDER BY sent_at DESC').all() as any[];
    const allItems = db.prepare('SELECT * FROM cart_order_items ORDER BY order_id, position').all() as any[];
    const itemsByOrder: Record<number, any[]> = {};
    allItems.forEach((item: any) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });
    res.json(orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })));
  });

  // Mark cart order as handled (shoper)
  app.patch('/api/cart-orders/:id/handle', requirePermission('view_interested_lists'), (req: any, res) => {
    const { id } = req.params;
    db.prepare('UPDATE cart_orders SET handled_at = ?, handled_by = ? WHERE id = ?').run(new Date().toISOString(), req.user.username, Number(id));
    res.json({ success: true });
  });

  // Delete interested list from inbox (shoper, only if handled)
  app.delete('/api/interested-lists/:id', requirePermission('view_interested_lists'), (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM interested_lists WHERE id = ? AND handled_at IS NOT NULL').run(Number(id));
    res.json({ success: true });
  });

  // Delete cart order from inbox (shoper, only if handled)
  app.delete('/api/cart-orders/:id', requirePermission('view_interested_lists'), (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM cart_orders WHERE id = ? AND handled_at IS NOT NULL').run(Number(id));
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
