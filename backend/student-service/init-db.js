const fs = require('fs');
const { Client } = require('pg');
const getDbConfig = require('./src/config/dbEnv').getDbConfig;

async function run() {
  const db = getDbConfig('STUDENT');
  const client = new Client({
    user: db.user,
    host: db.host,
    database: db.database,
    password: db.password,
    port: db.port,
  });

  try {
    await client.connect();
    
    // Read init.sql
    const initSql = fs.readFileSync('./init.sql', 'utf8');
    console.log('Executing init.sql...');
    await client.query(initSql);
    
    // Read migrations
    const files = fs.readdirSync('.').filter(f => f.startsWith('migration_') && f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(f, 'utf8');
      console.log(`Executing ${f}...`);
      await client.query(sql);
    }
    
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await client.end();
  }
}

run();
