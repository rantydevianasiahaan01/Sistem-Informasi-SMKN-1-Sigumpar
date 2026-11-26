const { Client } = require('pg');
const getDbConfig = require('./src/config/dbEnv').getDbConfig;
const db = getDbConfig('ACADEMIC');

async function run() {
  const client = new Client({
    user: db.user,
    host: db.host,
    database: db.database,
    password: db.password,
    port: db.port,
  });

  try {
    await client.connect();
    const result = await client.query("SELECT id, nama_kelas, wali_kelas_id, wali_kelas_nama FROM kelas;");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
