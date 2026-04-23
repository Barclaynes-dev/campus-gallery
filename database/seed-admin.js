require("dotenv").config();
const bcrypt   = require("bcryptjs");
const mysql    = require("mysql2/promise");
const readline = require("readline");

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(question, (answer) => { rl.close(); resolve(answer); }); });
}

async function seedAdmin() {
  console.log("\n🎞️  Campus Gallery — Admin Account Setup\n");
  const username    = (await prompt("Enter admin username [default: admin]: ")).trim() || "admin";
  const displayName = (await prompt("Enter display name [default: Gallery Admin]: ")).trim() || "Gallery Admin";
  const password    = (await prompt("Enter admin password: ")).trim();

  if (!password || password.length < 6) {
    console.error("\n❌ Password must be at least 6 characters.\n");
    process.exit(1);
  }

  console.log("\n⏳ Hashing password...");
  const passwordHash = await bcrypt.hash(password, 12);

  let connection;
  try {
    connection = await mysql.createConnection({
      host:     process.env.DB_HOST     || "localhost",
      user:     process.env.DB_USER     || "root",
      port:     process.env.DB_PORT     || 3306,      
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME     || "campus_gallery",
    });

    console.log("✅ Connected to database\n");

    await connection.execute(
      `INSERT INTO users (username, display_name, password_hash, role)
       VALUES (?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), password_hash = VALUES(password_hash)`,
      [username, displayName, passwordHash]
    );

    console.log(`✅ Admin account '${username}' created successfully!`);
    console.log(`\n   You can now log in at: http://localhost:3000/login.html\n`);

  } catch (err) {
    console.error("\n❌ Database error:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seedAdmin();