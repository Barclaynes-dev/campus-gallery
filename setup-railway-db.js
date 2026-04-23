const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function setup() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('✅ Connected to Railway MySQL');
  
  const schema = fs.readFileSync('./database/schema.sql', 'utf8');
  await connection.query(schema);
  
  console.log('✅ Tables created successfully');
  await connection.end();
}

setup().catch(console.error);