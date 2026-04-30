// FullBackend/config/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

let pool;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set in .env");
  }

  pool = mysql.createPool(process.env.DATABASE_URL);

  console.log("✅ MySQL pool created successfully");
} catch (err) {
  console.error("❌ Failed to create MySQL pool:", err.message);
  process.exit(1);
}

module.exports = { pool };
