import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary Configuration
if (process.env.CLOUDINARY_URL) {
  // If CLOUDINARY_URL is present, the SDK handles it automatically.
  // We only set additional options like secure: true.
  cloudinary.config({
    secure: true
  });
} else {
  cloudinary.config({
    cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'YOUR_NAME',
    api_key: process.env.VITE_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || 'YOUR_KEY',
    api_secret: process.env.VITE_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || 'YOUR_SECRET',
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

      const images = resources.map((resource: any) => ({
        id: resource.public_id,
        title: (resource.context && resource.context.caption) || "Unnamed",
        batchId: (resource.context && resource.context.batchId) || resource.public_id,
        filename: resource.secure_url,
        tags: resource.tags || []
      }));

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

      // Convert Sets to Arrays
      groups.forEach((group) => {
        group.tags = Array.from(group.tags);
        collections.push(group);
      });

      res.json(collections);
    } catch (error: any) {
      console.error("Fetch images error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch images from Cloudinary" });
    }
  });

  // Upload image
  app.post('/api/upload', upload.single('image'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "Upload failed" });
    
    const resource = req.file;
    const newItem = {
      id: resource.public_id || resource.filename,
      title: req.body.title || "Unnamed",
      filename: resource.path || resource.secure_url,
      tags: req.body.tags ? req.body.tags.split(',') : []
    };
    
    res.json({ success: true, file: newItem });
  });

  // Update tags
  app.post('/api/update-tags', async (req, res) => {
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
  app.delete('/api/delete-image', async (req, res) => {
    try {
      const { id } = req.query;
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

      // Successfully deleted or not found (which means it's already gone)
      if (result.result === 'ok' || result.result === 'deleted') {
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
          return res.json({ success: true, result: result.result });
        }
      }

      // If we reach here and it's 'not found', it's functionally gone
      if (result.result === 'not found') {
        return res.json({ success: true, message: "Item was not found but considered removed" });
      }

      res.status(500).json({ success: false, error: result.result || "Cloudinary deletion failed" });
    } catch (error: any) {
      console.error("[Delete] Exception:", error);
      res.status(500).json({ success: false, error: error.message || "Internal server error during deletion" });
    }
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
