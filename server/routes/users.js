// ============================================================
//  server/routes/users.js — User Management (Admin only)
// ============================================================

const express = require("express");
const bcrypt  = require("bcryptjs");
const db      = require("../config/db");
const { requireAdmin } = require("../middleware/authMiddleware");
const router  = express.Router();

// ── GET /api/users — List all friend accounts ────────────────
router.get("/", requireAdmin, async (req, res) => {
  try {
    const [users] = await db.execute(
      "SELECT id, username, display_name, role, created_at FROM users WHERE role = 'friend'"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch users." });
  }
});

// ── POST /api/users — Create a new friend account ────────────
router.post("/", requireAdmin, async (req, res) => {
  const { username, display_name, password } = req.body;

  if (!username || !password || !display_name) {
    return res.status(400).json({ error: "Username, display name, and password are required." });
  }

  try {
    // Check if username already exists
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE username = ?", [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Username already taken." });
    }

    // Hash the password before storing (NEVER store plain text passwords)
    const passwordHash = await bcrypt.hash(password, 12);

    await db.execute(
      "INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, 'friend')",
      [username, display_name, passwordHash]
    );

    res.status(201).json({ message: `Friend account '${username}' created.` });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Could not create user." });
  }
});

// ── DELETE /api/users/:id — Remove a friend account ──────────
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      "SELECT role FROM users WHERE id = ?", [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "User not found." });

    // Prevent accidental deletion of admin accounts via this route
    if (rows[0].role === "admin") {
      return res.status(403).json({ error: "Cannot delete admin accounts via this route." });
    }

    await db.execute("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "Friend account removed." });
  } catch (err) {
    res.status(500).json({ error: "Could not delete user." });
  }
});

module.exports = router;
