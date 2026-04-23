const express    = require("express");
const cloudinary = require("cloudinary").v2;
const multer     = require("multer");
const db         = require("../config/db");
const { requireAdmin, requireLogin } = require("../middleware/authMiddleware");
const router     = express.Router();

// ── Cloudinary Configuration ─────────────────────────────────
function cleanEnv(value) {
  if (typeof value !== "string") return "";
  // Railway env values occasionally get copied with spaces/quotes.
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function readCloudinaryConfigFromEnv() {
  let cloudName = "";
  let apiKey = "";
  let apiSecret = "";
  let source = "none";

  // Prefer CLOUDINARY_URL in production to avoid mixed/stale env vars.
  if (process.env.CLOUDINARY_URL) {
    try {
      const parsed = new URL(cleanEnv(process.env.CLOUDINARY_URL));
      if (parsed.protocol === "cloudinary:") {
        cloudName = cleanEnv(parsed.hostname);
        apiKey = cleanEnv(decodeURIComponent(parsed.username || ""));
        apiSecret = cleanEnv(decodeURIComponent(parsed.password || ""));
        source = "CLOUDINARY_URL";
      }
    } catch (err) {
      console.error("Invalid CLOUDINARY_URL format:", err.message);
    }
  }

  // Fallback to separate vars only when URL isn't present/usable.
  if (!cloudName || !apiKey || !apiSecret) {
    cloudName = cleanEnv(process.env.CLOUDINARY_CLOUD_NAME);
    apiKey = cleanEnv(process.env.CLOUDINARY_API_KEY);
    apiSecret = cleanEnv(process.env.CLOUDINARY_API_SECRET);
    source = "CLOUDINARY_*";
  }

  return { cloudName, apiKey, apiSecret, source };
}

const { cloudName, apiKey, apiSecret, source } = readCloudinaryConfigFromEnv();
if (!cloudName || !apiKey || !apiSecret) {
  console.error("Missing Cloudinary env values. Check CLOUDINARY_* variables in Railway.");
} else {
  console.log(`[Cloudinary] Config loaded from ${source}. cloud=${cloudName}, keyPrefix=${apiKey.slice(0, 4)}***, secretLength=${apiSecret.length}`);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

// Use memory storage to handle the file buffer manually
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ── GET ROUTES ───────────────────────────────────────────────
router.get("/", requireLogin, async (req, res) => {
  try {
    const [photos] = await db.execute("SELECT * FROM photos ORDER BY created_at DESC");
    res.json(photos);
  } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

router.get("/daily", async (req, res) => {
  try {
    const [photos] = await db.execute("SELECT * FROM photos");
    if (photos.length === 0) return res.json(null);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
    const seed = today.split("-").join("");
    const index = parseInt(seed) % photos.length;
    res.json(photos[index]);
  } catch (err) { res.status(500).json({ error: "Daily error" }); }
});

// ── POST /api/photos — THE FINAL FIX ──────────────────────────
// We removed the requireAdmin temporarily as we discussed earlier
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image provided" });

    // This method creates a direct stream to Cloudinary,
    // letting the SDK handle all the signature math for you.
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "campus-gallery" },
      async (error, result) => {
        if (error) {
          console.error("Cloudinary Stream Error:", error);
          return res.status(500).json({ 
            error: "Cloudinary Fail", 
            details: error.message,
            cloudinary_config_source: source,
            cloudinary_cloud_name: cloudName
          });
        }

        try {
          const { title, people_names, location, photographer, year } = req.body;
          
          // Using the columns verified in your Railway MySQL table
          await db.execute(
            `INSERT INTO photos (title, image_url, cloudinary_public_id, people_names, location, photographer, year) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, result.secure_url, result.public_id, people_names, location, photographer, year]
          );

          return res.status(201).json({ message: "SUCCESS!", url: result.secure_url });
        } catch (dbErr) {
          console.error("DB Save Error:", dbErr);
          return res.status(500).json({ error: "Database Fail", details: dbErr.message });
        }
      }
    );

    // Send the file buffer directly to the stream
    uploadStream.end(req.file.buffer);

  } catch (globalErr) {
    res.status(500).json({ error: "Server Error", details: globalErr.message });
  }
});

// ── DELETE ROUTE ─────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT cloudinary_public_id FROM photos WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    await cloudinary.uploader.destroy(rows[0].cloudinary_public_id);
    await db.execute("DELETE FROM photos WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: "Delete error" }); }
});

module.exports = router;