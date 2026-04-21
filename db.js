const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'pesantren',
  password: process.env.DB_PASS || 'pesantren123',
  database: process.env.DB_NAME || 'pesantren_saas',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Helper: INSERT and return inserted id
async function dbInsert(table, data) {
  const keys = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const [result] = await pool.execute(sql, vals);
  return result.insertId;
}

// Helper: UPDATE by id
async function dbUpdate(table, data, where, whereVals = []) {
  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(data), ...whereVals];
  const sql = `UPDATE ${table} SET ${sets} WHERE ${where}`;
  const [result] = await pool.execute(sql, vals);
  return result.affectedRows;
}

// Helper: DELETE by condition
async function dbDelete(table, where, vals = []) {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  const [result] = await pool.execute(sql, vals);
  return result.affectedRows;
}

// Helper: SELECT with optional where
async function dbQuery(sql, vals = []) {
  const [rows] = await pool.execute(sql, vals);
  return rows;
}

// Helper: SELECT single row
async function dbGet(sql, vals = []) {
  const [rows] = await pool.execute(sql, vals);
  return rows[0] || null;
}

module.exports = { pool, dbInsert, dbUpdate, dbDelete, dbQuery, dbGet };
