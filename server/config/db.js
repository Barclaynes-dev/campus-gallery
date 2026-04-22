// ============================================================
//  server/config/db.js — MySQL Connection Pool
//  Uses mysql2 which supports async/await (much cleaner code)
// ============================================================

const mysql = require("mysql2/promise");

// A "pool" manages multiple database connections efficiently.
// It automatically reuses connections instead of opening a new
// one for every single request.
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "campus_gallery",
  waitForConnections: true,
  connectionLimit:    10,   // Max 10 simultaneous DB connections
  queueLimit:         0,
});

// Test the connection when the server starts
pool.getConnection()
  .then((conn) => {
    console.log("✅ MySQL connected successfully");
    conn.release(); // Always release connections back to the pool
  })
  .catch((err) => {
    console.error("❌ MySQL connection failed:", err.message);
    console.error("   Check your .env DB credentials and that MySQL Server is running.");
  });

module.exports = pool;
