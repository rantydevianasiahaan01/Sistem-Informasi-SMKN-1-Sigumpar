const { Pool } = require('pg');
const { getDbConfig } = require('./dbEnv');

const db = getDbConfig('ASSET');
const pool = new Pool({
  user: db.user,
  host: db.host,
  database: db.database,
  password: db.password,
  port: db.port,
});
module.exports = pool;

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Koneksi Database Gagal:', err.stack);
  } else {
    console.log(`Koneksi Database Berhasil (${db.user}@${db.host}:${db.port}/${db.database}) pada:`, res.rows[0].now);
  }
});