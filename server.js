// ============================================================
//  server.js — Campus Gallery · Main Entry Point
//  Run with: node server.js  (or npm run dev with nodemon)
// ============================================================

require("dotenv").config(); // Load .env variables first

const express    = require("express");
const session    = require("express-session");
const path       = require("path");
const cors       = require("cors");

// ── Route Imports ────────────────────────────────────────────
const authRoutes      = require("./server/routes/auth");
const photoRoutes     = require("./server/routes/photos");
const userRoutes      = require("./server/routes/users");
const favoriteRoutes  = require("./server/routes/favorites");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the public folder (your HTML, CSS, JS, assets)
app.use(express.static(path.join(__dirname, "public")));

// ── Session Setup ────────────────────────────────────────────
// Sessions keep users logged in across requests.
// The secret key comes from your .env file — never share it.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "campus_gallery_dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      maxAge: 1000 * 60 * 60 * 24 * 7,              // 7 days
    },
  })
);

// ── API Routes ───────────────────────────────────────────────
// All API calls are prefixed with /api/
app.use("/api/auth",      authRoutes);
app.use("/api/photos",    photoRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/favorites", favoriteRoutes);

// ── Catch-All: Serve index.html for any non-API route ────────
// This enables client-side navigation (SPA-style fallback)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎞️  Campus Gallery server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Mode:    ${process.env.NODE_ENV || "development"}\n`);
});
