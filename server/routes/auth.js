// ============================================================
//  server/routes/auth.js — Login / Logout / Session
// ============================================================

const express  = require("express");
const bcrypt   = require("bcryptjs");
const db       = require("../config/db");
const router   = express.Router();

// ── POST /api/auth/login ─────────────────────────────────────
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    // Find user in DB by username
    const [rows] = await db.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = rows[0];

    // Compare submitted password to the hashed password in DB
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Store safe user info in session (never store the password hash!)
    req.session.user = {
      id:       user.id,
      username: user.username,
      role:     user.role,        // "admin" or "friend"
      name:     user.display_name,
    };

    res.json({
      message:  "Login successful.",
      role:     user.role,
      redirect: user.role === "admin" ? "/admin/dashboard.html" : "/friend/dashboard.html",
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login." });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out." });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────
// Frontend can call this to check who is currently logged in
router.get("/me", (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;
