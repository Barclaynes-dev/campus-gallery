// ============================================================
//  server/routes/photos.js — Photo CRUD + Upload
// ============================================================

const express    = require("express");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer     = require("multer");
const db         = require("../config/db");
const { requireAdmin, requireLogin } = require("../middleware/authMiddleware");
const router     = express.Router();

// ── Cloudinary Configuration ─────────────────────────────────
// Credentials come from your .env file
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Tell multer to upload directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "campus-gallery",          // Folder name in your Cloudinary account
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto" }], // Auto-optimize quality
  },
});
const upload = multer({ storage });

// ── GET /api/photos — Fetch all photos (optional year filter) ─
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
// Returns a consistent random photo for the current calendar day
router.get("/daily", async (req, res) => {
  try {
    const [photos] = await db.execute("SELECT * FROM photos");
    if (photos.length === 0) return res.json(null);

    // Use Uganda time (Africa/Kampala) so the photo changes exactly at midnight local time
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }); // "YYYY-MM-DD"
    const seed  = today.split("-").join(""); // "YYYYMMDD"
    const index = parseInt(seed) % photos.length;
    res.json(photos[index]);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch daily photo." });
  }
});

// ── GET /api/photos/recent — For the infinite scroll band ────
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

// ── POST /api/photos — Upload a new photo (Admin only) ───────
router.post("/", requireAdmin, upload.single("image"), async (req, res) => {
  const { title, people_names, location, photographer, year } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  try {
    // Cloudinary returns the uploaded file info in req.file
    const imageUrl      = req.file.path;         // Full Cloudinary URL
    const publicId      = req.file.filename;     // Cloudinary public_id
    const originalWidth = req.file.width  || 0;
    const originalHeight= req.file.height || 0;

    await db.execute(
      `INSERT INTO photos 
        (title, image_url, cloudinary_public_id, people_names, location, photographer, year)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, imageUrl, publicId, people_names, location, photographer, year]
    );

    res.status(201).json({ message: "Photo uploaded successfully.", url: imageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed." });
  }
});

// ── DELETE /api/photos/:id — Delete a photo (Admin only) ─────
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get the Cloudinary public_id so we can delete from cloud too
    const [rows] = await db.execute(
      "SELECT cloudinary_public_id FROM photos WHERE id = ?", [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Photo not found." });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(rows[0].cloudinary_public_id);

    // Delete from database
    await db.execute("DELETE FROM photos WHERE id = ?", [id]);

    res.json({ message: "Photo deleted successfully." });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Could not delete photo." });
  }
});

module.exports = router;
