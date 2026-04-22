// ============================================================
//  server/routes/favorites.js — Favorites & Categories
// ============================================================

const express = require("express");
const db = require("../config/db");
const { requireFriend } = require("../middleware/authMiddleware");
const router = express.Router();

// ── GET /api/favorites — Get current user's favorites ────────
router.get("/", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [favorites] = await db.execute(
      `SELECT p.*, f.id, f.category_id, f.created_at AS favorite_created_at, c.name AS category_name
       FROM favorites f
       JOIN photos p ON f.photo_id = p.id
       LEFT JOIN categories c ON f.category_id = c.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch favorites." });
  }
});

// ── POST /api/favorites — Save a photo as favorite ───────────
router.post("/", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  const { photo_id } = req.body;

  if (!photo_id) return res.status(400).json({ error: "photo_id is required." });

  try {
    // Prevent duplicate favorites
    const [existing] = await db.execute(
      "SELECT id FROM favorites WHERE user_id = ? AND photo_id = ?",
      [userId, photo_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Already in favorites." });
    }

    await db.execute(
      "INSERT INTO favorites (user_id, photo_id) VALUES (?, ?)",
      [userId, photo_id]
    );
    res.status(201).json({ message: "Added to favorites." });
  } catch (err) {
    res.status(500).json({ error: "Could not save favorite." });
  }
});

// ── DELETE /api/favorites/:id — Remove from favorites ────────
router.delete("/:id", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;
  try {
    await db.execute(
      "DELETE FROM favorites WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    res.json({ message: "Removed from favorites." });
  } catch (err) {
    res.status(500).json({ error: "Could not remove favorite." });
  }
});

// ── PATCH /api/favorites/:id/category — Assign to category ──
router.patch("/:id/category", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;
  const { category_id } = req.body;
  try {
    await db.execute(
      "UPDATE favorites SET category_id = ? WHERE id = ? AND user_id = ?",
      [category_id || null, id, userId]
    );
    res.json({ message: "Category assigned." });
  } catch (err) {
    res.status(500).json({ error: "Could not assign category." });
  }
});

// ── GET /api/favorites/categories — Get user's categories ────
router.get("/categories", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [cats] = await db.execute(
      "SELECT * FROM categories WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch categories." });
  }
});

// ── POST /api/favorites/categories — Create a category ───────
router.post("/categories", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Category name is required." });

  try {
    await db.execute(
      "INSERT INTO categories (user_id, name) VALUES (?, ?)",
      [userId, name]
    );
    res.status(201).json({ message: `Category '${name}' created.` });
  } catch (err) {
    res.status(500).json({ error: "Could not create category." });
  }
});

// ── DELETE /api/favorites/categories/:id ─────────────────────
router.delete("/categories/:id", requireFriend, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;
  try {
    await db.execute(
      "DELETE FROM categories WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    res.json({ message: "Category deleted." });
  } catch (err) {
    res.status(500).json({ error: "Could not delete category." });
  }
});

module.exports = router;
