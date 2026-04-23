// ============================================================
//  server/routes/photos.js — FINAL STABLE VERSION
// ============================================================

const express    = require("express");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer     = require("multer");
const db         = require("../config/db");
const { requireAdmin, requireLogin } = require("../middleware/authMiddleware");
const router     = express.Router();

// ── Cloudinary Configuration ─────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Cleaned Storage Config (Fixes Invalid Signature) ──────────
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "campus-gallery",
    format: "jpg", // Simplified to a single format to fix signature handshake
  },
});
const upload = multer({ storage });

// ── GET /api/photos — Fetch all photos ───────────────────────
router.get("/", requireLogin, async (req, res) => {
  const { year } = req.query;
  try {
    let query  = "SELECT * FROM photos ORDER BY created_at DESC";
    let params = [];
    if (year) {
      query  = "SELECT * FROM photos WHERE year = ? ORDER BY created_at DESC";
      params = [year];
    }
    const [photos] = await db.execute(query, params);
    res.json(photos);
  } catch (err) {
    console.error("Fetch photos error:", err);
    res.status(500).json({ error: "Could not fetch photos." });
  }
});

// ── GET /api/photos/daily — Picture of the Day ───────────────
router.get("/daily", async (req, res) => {
  try {
    const [photos] = await db.execute("SELECT * FROM photos");
    if (photos.length === 0) return res.json(null);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
    const seed  = today.split("-").join("");
    const index = parseInt(seed) % photos.length;
    res.json(photos[index]);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch daily photo." });
  }
});

// ── GET /api/photos/recent — For infinite scroll ─────────────
router.get("/recent", async (req, res) => {
  try {
    const [photos] = await db.execute(
      "SELECT * FROM photos ORDER BY created_at DESC LIMIT 20"
    );
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch recent photos." });
  }
});

// ── POST /api/photos — Stable Upload Route ───────────────────
router.post("/", (req, res) => {
  // We use the manual callback to catch any Cloudinary or DB errors
  upload.single("image")(req, res, async (err) => {
    if (err) {
      console.error("CLOUDINARY ERROR:", err);
      return res.status(500).json({ 
        error: "Cloudinary Engine Crash", 
        details: err.message || err 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No image file reached the server." });
    }

    try {
      const { title, people_names, location, photographer, year } = req.body;
      const imageUrl = req.file.path;
      const publicId = req.file.filename;

      // Inserting into your existing Railway columns
      await db.execute(
        `INSERT INTO photos (title, image_url, cloudinary_public_id, people_names, location, photographer, year) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, imageUrl, publicId, people_names, location, photographer, year]
      );

      res.status(201).json({ message: "SUCCESS!", url: imageUrl });

    } catch (dbErr) {
      console.error("DATABASE ERROR:", dbErr);
      res.status(500).json({ 
        error: "Database Save Failed", 
        details: dbErr.message 
      });
    }
  });
});

// ── DELETE /api/photos/:id — Delete a photo ──────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      "SELECT cloudinary_public_id FROM photos WHERE id = ?", [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Photo not found." });
    await cloudinary.uploader.destroy(rows[0].cloudinary_public_id);
    await db.execute("DELETE FROM photos WHERE id = ?", [id]);
    res.json({ message: "Photo deleted successfully." });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Could not delete photo." });
  }
});

module.exports = router;