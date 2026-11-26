const { Client } = require('pg');
const getDbConfig = require('./src/config/dbEnv').getDbConfig;
const db = getDbConfig('STUDENT');
const client = new Client({
  user: db.user,
  host: db.host,
  database: db.database,
  password: db.password,
  port: db.port,
});

client.connect()
  .then(() => client.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'absensi_siswa'"))
  .then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
