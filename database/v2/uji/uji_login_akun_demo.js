// Cek setiap akun demo bisa login dengan password demo, memakai fungsi
// cocok() yang SAMA dengan auth-service (backend/auth-service/src/services/sandi.js).
// Pemakaian (dari root repo, setelah npm install di auth-service):
//   DATABASE_URL=... node database/v2/uji/uji_login_akun_demo.js
const path = require("path");
const { Client } = require(path.resolve("backend/auth-service/node_modules/pg"));
const sandi = require(path.resolve("backend/auth-service/src/services/sandi"));

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rows } = await db.query(
    `SELECT u.username, r.nama AS role, u.password_hash
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.username LIKE '%.demo' ORDER BY r.id`);
  let gagal = 0;
  for (const u of rows) {
    const ok = await sandi.cocok("Sigumpar#2026", u.password_hash);
    if (!ok) gagal++;
    console.log(`${ok ? "LULUS" : "GAGAL"}  ${u.username.padEnd(16)} role=${u.role}`);
  }
  console.log(`\n${rows.length - gagal} dari ${rows.length} akun berhasil diverifikasi`);
  await db.end();
  process.exit(gagal ? 1 : 0);
})();
