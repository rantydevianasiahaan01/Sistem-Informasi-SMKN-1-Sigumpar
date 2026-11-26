const { Pool } = require("pg");
const { getDbConfig } = require("./dbEnv");

const db = getDbConfig("AUTH");
const pool = new Pool({
  user: db.user,
  host: db.host,
  database: db.database,
  password: db.password,
  port: db.port,
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Koneksi database auth-service gagal:", err.stack);
  } else {
    console.log(
      `Koneksi database auth-service berhasil (${db.user}@${db.host}:${db.port}/${db.database}) pada:`,
      res.rows[0].now,
    );
  }
});

module.exports = pool;
